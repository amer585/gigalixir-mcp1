// Gigalixir & Turso & GitHub MCP Server — Cloudflare Worker (2024-11-05 protocol)
// Deploy: wrangler deploy
// Secrets: wrangler secret put GIGALIXIR_EMAIL
//          wrangler secret put GIGALIXIR_API_KEY
//          wrangler secret put TURSO_DB_URL
//          wrangler secret put TURSO_AUTH_TOKEN
//          wrangler secret put GITHUB_TOKEN

const GIGALIXIR_BASE = 'https://api.gigalixir.com';

// ── UTILITIES ────────────────────────────────────────────────────────────────

function getGigalixirAuth(env) {
  const email = env.GIGALIXIR_EMAIL || '';
  const apiKey = env.GIGALIXIR_API_KEY || '';
  // Support either Node.js Buffer or standard btoa in Workers
  const str = `${email}:${apiKey}`;
  if (typeof Buffer !== 'undefined') {
    return 'Basic ' + Buffer.from(str).toString('base64');
  }
  return 'Basic ' + btoa(str);
}

// Durable fetch with timeout
async function fetchWithTimeout(url, options, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Safe REST client wrapper
async function gigalixirRequest(env, method, path, body = null) {
  const authHeader = getGigalixirAuth(env);
  const options = {
    method,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  };

  const res = await fetchWithTimeout(`${GIGALIXIR_BASE}${path}`, options, 8000);
  const text = await res.text();
  
  if (!res.ok) {
    throw new Error(`Gigalixir API Error (${res.status}): ${text || res.statusText}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ── TURSO DATABASE LAYER ─────────────────────────────────────────────────────

async function executeTursoQueries(env, statements) {
  const dbUrl = env.TURSO_DB_URL;
  const dbToken = env.TURSO_AUTH_TOKEN;
  if (!dbUrl) {
    throw new Error('TURSO_DB_URL is not configured in the environment');
  }

  const url = `${dbUrl}/v2/pipeline`.replace('libsql://', 'https://');
  
  // Convert standard statement format to libSQL request format
  const requests = statements.map(st => ({
    type: 'execute',
    stmt: {
      sql: st.sql,
      args: (st.args || []).map(arg => {
        if (arg === null) return { type: 'null' };
        if (typeof arg === 'number') return { type: 'integer', value: String(arg) };
        if (typeof arg === 'boolean') return { type: 'integer', value: arg ? '1' : '0' };
        return { type: 'text', value: String(arg) };
      })
    }
  }));

  // Append closing request to pipeline
  requests.push({ type: 'close' });

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${dbToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  }, 10000);

  if (!res.ok) {
    throw new Error(`Turso HTTP Error (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  return data;
}

// Execute single Turso statement helper
async function tursoSingle(env, sql, args = []) {
  const pipeline = await executeTursoQueries(env, [{ sql, args }]);
  const resultObj = pipeline?.results?.[0];
  
  if (resultObj?.type === 'error') {
    throw new Error(`SQLite Error: ${resultObj.error?.message || 'Unknown error'}`);
  }

  const result = resultObj?.response?.result;
  if (!result) {
    throw new Error(`Malformed Database pipeline response: ${JSON.stringify(pipeline)}`);
  }

  const cols = result.cols.map(c => c.name);
  const rows = result.rows.map(row =>
    Object.fromEntries(row.map((cell, i) => {
      const colName = cols[i];
      const val = cell?.value ?? null;
      return [colName, val];
    }))
  );

  return {
    columns: cols,
    rows,
    rowsAffected: result.affected_row_count ?? 0,
    lastInsertRowid: result.last_insert_rowid ?? null,
  };
}

// ── GITHUB REST API ──────────────────────────────────────────────────────────

async function githubRequest(env, method, path, body = null) {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is not configured in the environment');
  }

  const res = await fetchWithTimeout(`https://api.github.com${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gigalixir-mcp-engine',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  }, 8000);

  if (res.status === 204) return { success: true };
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`GitHub API Error (${res.status}): ${text || res.statusText}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function getGitHubFileSha(env, owner, repo, path, branch = 'main') {
  try {
    const data = await githubRequest(env, 'GET', `/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
    return data?.sha ?? null;
  } catch {
    return null;
  }
}

// ── MCP CENTRAL REGISTRY AND DEFINITIONS ─────────────────────────────────────

const TOOLS = [
  // ── Gigalixir Tools ──
  {
    name: 'list_apps',
    description: 'List all Gigalixir applications in your account',
    inputSchema: { type: 'object', properties: {} },
    handler: async (env) => {
      const data = await gigalixirRequest(env, 'GET', '/api/apps');
      return { success: true, apps: data?.data ?? data };
    }
  },
  {
    name: 'get_app',
    description: 'Get details about a specific Gigalixir app',
    inputSchema: {
      type: 'object',
      properties: { app_name: { type: 'string', description: 'Application name' } },
      required: ['app_name']
    },
    handler: async (env, args) => {
      const data = await gigalixirRequest(env, 'GET', `/api/apps/${args.app_name}`);
      return data;
    }
  },
  {
    name: 'get_configs',
    description: 'Get custom environment variables/configs for a Gigalixir app',
    inputSchema: {
      type: 'object',
      properties: { app_name: { type: 'string', description: 'Application name' } },
      required: ['app_name']
    },
    handler: async (env, args) => {
      // Safe fallback: try singular /config first, then plural /configs if it fails
      try {
        const res = await gigalixirRequest(env, 'GET', `/api/apps/${args.app_name}/config`);
        return res;
      } catch (err) {
        return gigalixirRequest(env, 'GET', `/api/apps/${args.app_name}/configs`);
      }
    }
  },
  {
    name: 'set_config',
    description: 'Set custom environment variable(s) for a Gigalixir app (triggers rolling restart)',
    inputSchema: {
      type: 'object',
      properties: {
        app_name: { type: 'string', description: 'Application name' },
        key: { type: 'string', description: 'Config key name' },
        value: { type: 'string', description: 'Config value' }
      },
      required: ['app_name', 'key', 'value']
    },
    handler: async (env, args) => {
      // Try singular /config with standard nested payload format, fall back to configurations format
      try {
        return await gigalixirRequest(env, 'PUT', `/api/apps/${args.app_name}/config`, {
          config: { [args.key]: args.value }
        });
      } catch {
        try {
          return await gigalixirRequest(env, 'PUT', `/api/apps/${args.app_name}/configs`, {
            [args.key]: args.value
          });
        } catch (finalErr) {
          throw new Error(`Failed to set config using both /config and /configs endpoints. Details: ${finalErr.message}`);
        }
      }
    }
  },
  {
    name: 'delete_config',
    description: 'Delete/remove an environment variable from a Gigalixir app',
    inputSchema: {
      type: 'object',
      properties: {
        app_name: { type: 'string', description: 'Application name' },
        key: { type: 'string', description: 'Environment variable name to delete' }
      },
      required: ['app_name', 'key']
    },
    handler: async (env, args) => {
      try {
        return await gigalixirRequest(env, 'DELETE', `/api/apps/${args.app_name}/config/${args.key}`);
      } catch {
        return gigalixirRequest(env, 'DELETE', `/api/apps/${args.app_name}/configs/${args.key}`);
      }
    }
  },
  {
    name: 'get_replicas',
    description: 'Get the replica counts and statuses for a Gigalixir app',
    inputSchema: {
      type: 'object',
      properties: { app_name: { type: 'string', description: 'Application name' } },
      required: ['app_name']
    },
    handler: async (env, args) => {
      return gigalixirRequest(env, 'GET', `/api/apps/${args.app_name}/replicas`);
    }
  },
  {
    name: 'scale',
    description: 'Scale a Gigalixir app to a given number of replicas',
    inputSchema: {
      type: 'object',
      properties: {
        app_name: { type: 'string', description: 'Application name' },
        replicas: { type: 'number', description: 'Number of active replicas' }
      },
      required: ['app_name', 'replicas']
    },
    handler: async (env, args) => {
      return gigalixirRequest(env, 'PUT', `/api/apps/${args.app_name}/replicas`, {
        replicas: args.replicas
      });
    }
  },
  {
    name: 'list_releases',
    description: 'List historical deployments/releases for a Gigalixir app',
    inputSchema: {
      type: 'object',
      properties: { app_name: { type: 'string', description: 'Application name' } },
      required: ['app_name']
    },
    handler: async (env, args) => {
      return gigalixirRequest(env, 'GET', `/api/apps/${args.app_name}/releases`);
    }
  },
  {
    name: 'rollback',
    description: 'Rollback a Gigalixir app to a previous build version',
    inputSchema: {
      type: 'object',
      properties: {
        app_name: { type: 'string', description: 'Application name' },
        version: { type: 'number', description: 'Target version number' }
      },
      required: ['app_name', 'version']
    },
    handler: async (env, args) => {
      return gigalixirRequest(env, 'POST', `/api/apps/${args.app_name}/releases`, {
        version: args.version
      });
    }
  },
  {
    name: 'restart',
    description: 'Gracefully restart a Gigalixir app by scaling and restore cyclic state',
    inputSchema: {
      type: 'object',
      properties: { app_name: { type: 'string', description: 'Application name' } },
      required: ['app_name']
    },
    handler: async (env, args) => {
      const replicaInfo = await gigalixirRequest(env, 'GET', `/api/apps/${args.app_name}/replicas`);
      const targetCount = replicaInfo?.data?.replicas_count ?? 1;
      // Cycle to 0
      await gigalixirRequest(env, 'PUT', `/api/apps/${args.app_name}/replicas`, { replicas: 0 });
      // Pause slightly
      await new Promise(r => setTimeout(r, 1500));
      // Restore counts
      return gigalixirRequest(env, 'PUT', `/api/apps/${args.app_name}/replicas`, { replicas: targetCount });
    }
  },
  {
    name: 'get_logs',
    description: 'Get recent application log entries without hanging or timing out',
    inputSchema: {
      type: 'object',
      properties: {
        app_name: { type: 'string', description: 'Application name' },
        num_lines: { type: 'number', description: 'Line count threshold (default 50, max 250)' }
      },
      required: ['app_name']
    },
    handler: async (env, args) => {
      const numLines = Math.min(args.num_lines || 50, 250);
      const url = `${GIGALIXIR_BASE}/api/apps/${args.app_name}/logs?num_lines=${numLines}`;
      
      const controller = new AbortController();
      // Hard maximum response processing limit of 3 seconds to guarantee no MCP timeout
      const fallbackId = setTimeout(() => controller.abort(), 3000);

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Authorization': getGigalixirAuth(env) },
          signal: controller.signal
        });

        clearTimeout(fallbackId);

        if (!res.ok) {
          return { error: `Gigalixir returned HTTP status ${res.status}: ${await res.text() || res.statusText}` };
        }

        if (!res.body) {
          return { logs: '(Empty response body returned)' };
        }

        // Chunked stream reader with custom threshold parsing to guarantee instant returns
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let list = [];
        const absoluteTimeout = Date.now() + 2000; // Limit processing to 2 seconds

        while (list.length < numLines && Date.now() < absoluteTimeout) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split(/\r?\n/);
          buffer = parts.pop() || '';
          list.push(...parts);

          if (list.length >= numLines) {
            reader.cancel('Limit matched').catch(() => {});
            break;
          }
        }

        if (buffer && list.length < numLines) {
          list.push(buffer);
        }

        return {
          lines_requested: numLines,
          lines_retrieved: list.length,
          logs: list.slice(-numLines).join('\n')
        };
      } catch (err) {
        clearTimeout(fallbackId);
        if (err.name === 'AbortError') {
          return {
            error: 'Retrieving logs was completed prematurely to prevent a gateway timeout',
            partial: true
          };
        }
        throw err;
      }
    }
  },
  {
    name: 'create_app',
    description: 'Provision a brand new Gigalixir application',
    inputSchema: {
      type: 'object',
      properties: {
        app_name: { type: 'string', description: 'Unique lowcase subdomain' },
        cloud: { type: 'string', description: 'Cloud deployment target: gcp or aws (default gcp)' },
        region: { type: 'string', description: 'GCP/AWS region identifier' }
      },
      required: ['app_name']
    },
    handler: async (env, args) => {
      const body = { unique_name: args.app_name };
      if (args.cloud) body.cloud = args.cloud;
      if (args.region) body.region = args.region;
      return gigalixirRequest(env, 'POST', '/api/apps', body);
    }
  },

  // ── Turso Enhanced Database Tools ──
  {
    name: 'turso_query',
    description: 'Execute a read-only SQL lookup query (SELECT) with parameter injection',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'Full sqlite SELECT query' },
        args: { type: 'array', items: { type: 'string' }, description: 'Prepared positional arguments' }
      },
      required: ['sql']
    },
    handler: async (env, args) => {
      const sqlText = args.sql.trim();
      if (!/^\s*(select|pragma|with|explain)\b/i.test(sqlText)) {
        throw new Error('Write operations are forbidden on turso_query. Please employ turso_execute instead.');
      }
      return tursoSingle(env, sqlText, args.args || []);
    }
  },
  {
    name: 'turso_execute',
    description: 'Execute state changing SQL statements (INSERT, UPDATE, DELETE, CREATE, DROP)',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SQL statement' },
        args: { type: 'array', items: { type: 'string' }, description: 'Prepared positional parameters' }
      },
      required: ['sql']
    },
    handler: async (env, args) => {
      return tursoSingle(env, args.sql, args.args || []);
    }
  },
  {
    name: 'turso_list_tables',
    description: 'List all internal tables inside your Turso database',
    inputSchema: { type: 'object', properties: {} },
    handler: async (env) => {
      const listSql = "SELECT name, tbl_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
      return tursoSingle(env, listSql);
    }
  },
  {
    name: 'turso_describe_table',
    description: 'Describe table schema definitions, properties, types and schemas',
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string', description: 'Full SQLite table name' } },
      required: ['table']
    },
    handler: async (env, args) => {
      const schemaSql = `PRAGMA table_info(${args.table})`;
      const indexSql = `PRAGMA index_list(${args.table})`;
      
      const columns = await tursoSingle(env, schemaSql);
      let indexes = { rows: [] };
      try {
        indexes = await tursoSingle(env, indexSql);
      } catch {
        // Fallback for custom virtual views
      }

      return {
        table: args.table,
        columns: columns.rows,
        indexes: indexes.rows
      };
    }
  },
  {
    name: 'turso_transaction',
    description: 'Execute multiple stateful SQL instructions inside a safe BEGIN/COMMIT transaction roll',
    inputSchema: {
      type: 'object',
      properties: {
        statements: {
          type: 'array',
          description: 'Array of SQL statements with optional prepared queries',
          items: {
            type: 'object',
            properties: {
              sql: { type: 'string' },
              args: { type: 'array', items: { type: 'string' } }
            },
            required: ['sql']
          }
        }
      },
      required: ['statements']
    },
    handler: async (env, args) => {
      const rawStmts = args.statements;
      if (!rawStmts || rawStmts?.length === 0) {
        throw new Error('Statements list cannot be empty');
      }

      // Build Transaction list explicitly
      const list = [
        { sql: 'BEGIN TRANSACTION', args: [] },
        ...rawStmts,
        { sql: 'COMMIT', args: [] }
      ];

      try {
        const res = await executeTursoQueries(env, list);
        // Look for errors anywhere in the pipeline response
        const errorIndex = res.results?.findIndex(r => r.type === 'error');
        if (errorIndex !== -1 && errorIndex !== undefined) {
          const failed = res.results[errorIndex];
          // Issue automatic rollback safety query
          await executeTursoQueries(env, [{ sql: 'ROLLBACK', args: [] }]);
          return {
            success: false,
            error: `Statement at index ${errorIndex - 1} failed: ${failed.error?.message || 'Transaction aborted'}`,
            results: res.results
          };
        }
        return { success: true, transaction_response: res };
      } catch (err) {
        // Safe rollback
        try {
          await executeTursoQueries(env, [{ sql: 'ROLLBACK', args: [] }]);
        } catch {
          // ignore double rollback faults
        }
        throw err;
      }
    }
  },

  // ── GitHub Workspace Tools ──
  {
    name: 'github_list_repos',
    description: 'List user repositories',
    inputSchema: {
      type: 'object',
      properties: { type: { type: 'string', description: 'all, owner, public, private, member' } }
    },
    handler: async (env, args) => {
      const type = args.type || 'all';
      return githubRequest(env, 'GET', `/user/repos?type=${type}&per_page=50&sort=updated`);
    }
  },
  {
    name: 'github_get_repo',
    description: 'Fetch complete metadata of a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Owner organization or username' },
        repo: { type: 'string', description: 'Target Repository name' }
      },
      required: ['owner', 'repo']
    },
    handler: async (env, args) => {
      return githubRequest(env, 'GET', `/repos/${args.owner}/${args.repo}`);
    }
  },
  {
    name: 'github_create_repo',
    description: 'Instantiate a brand new GitHub Repository in your account',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Repository Identifier' },
        description: { type: 'string' },
        private: { type: 'boolean', default: false },
        auto_init: { type: 'boolean', default: true }
      },
      required: ['name']
    },
    handler: async (env, args) => {
      return githubRequest(env, 'POST', '/user/repos', {
        name: args.name,
        description: args.description || '',
        private: !!args.private,
        auto_init: args.auto_init !== false
      });
    }
  },
  {
    name: 'github_list_files',
    description: 'Recurse directories and fetch file statuses',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        path: { type: 'string', description: 'Folder path' },
        branch: { type: 'string', default: 'main' }
      },
      required: ['owner', 'repo']
    },
    handler: async (env, args) => {
      const p = args.path || '';
      const b = args.branch || 'main';
      return githubRequest(env, 'GET', `/repos/${args.owner}/${args.repo}/contents/${p}?ref=${b}`);
    }
  },
  {
    name: 'github_get_file',
    description: 'Read the parsed UTF-8 lines inside a file',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        path: { type: 'string' },
        branch: { type: 'string', default: 'main' }
      },
      required: ['owner', 'repo', 'path']
    },
    handler: async (env, args) => {
      const b = args.branch || 'main';
      const data = await githubRequest(env, 'GET', `/repos/${args.owner}/${args.repo}/contents/${args.path}?ref=${b}`);
      if (data?.content) {
        const decoded = typeof Buffer !== 'undefined'
          ? Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf-8')
          : atob(data.content.replace(/\s/g, ''));
        data.decoded_content = decoded;
      }
      return data;
    }
  },
  {
    name: 'github_create_file',
    description: 'Create a brand new file in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        path: { type: 'string' },
        content: { type: 'string' },
        message: { type: 'string' },
        branch: { type: 'string', default: 'main' }
      },
      required: ['owner', 'repo', 'path', 'content', 'message']
    },
    handler: async (env, args) => {
      const b = args.branch || 'main';
      const b64 = typeof Buffer !== 'undefined'
        ? Buffer.from(args.content, 'utf-8').toString('base64')
        : btoa(unescape(encodeURIComponent(args.content)));
      return githubRequest(env, 'PUT', `/repos/${args.owner}/${args.repo}/contents/${args.path}`, {
        message: args.message,
        content: b64,
        branch: b
      });
    }
  },
  {
    name: 'github_update_file',
    description: 'Modify an existing file matching its tree SHA reference automatically',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        path: { type: 'string' },
        content: { type: 'string' },
        message: { type: 'string' },
        branch: { type: 'string', default: 'main' }
      },
      required: ['owner', 'repo', 'path', 'content', 'message']
    },
    handler: async (env, args) => {
      const b = args.branch || 'main';
      const sha = await getGitHubFileSha(env, args.owner, args.repo, args.path, b);
      if (!sha) {
        throw new Error(`The file at ${args.path} was not located, please verify path & branch.`);
      }
      const b64 = typeof Buffer !== 'undefined'
        ? Buffer.from(args.content, 'utf-8').toString('base64')
        : btoa(unescape(encodeURIComponent(args.content)));
      return githubRequest(env, 'PUT', `/repos/${args.owner}/${args.repo}/contents/${args.path}`, {
        message: args.message,
        content: b64,
        sha,
        branch: b
      });
    }
  },
  {
    name: 'github_delete_file',
    description: 'Delete a file from the repository securely',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        path: { type: 'string' },
        message: { type: 'string' },
        branch: { type: 'string', default: 'main' }
      },
      required: ['owner', 'repo', 'path', 'message']
    },
    handler: async (env, args) => {
      const b = args.branch || 'main';
      const sha = await getGitHubFileSha(env, args.owner, args.repo, args.path, b);
      if (!sha) {
        throw new Error(`The file at ${args.path} was not located.`);
      }
      return githubRequest(env, 'DELETE', `/repos/${args.owner}/${args.repo}/contents/${args.path}`, {
        message: args.message,
        sha,
        branch: b
      });
    }
  },
  {
    name: 'github_create_pr',
    description: 'Generate standard target pull request records',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
        head: { type: 'string', description: 'Branch with edits' },
        base: { type: 'string', default: 'main', description: 'Target branch' }
      },
      required: ['owner', 'repo', 'title', 'head']
    },
    handler: async (env, args) => {
      return githubRequest(env, 'POST', `/repos/${args.owner}/${args.repo}/pulls`, {
        title: args.title,
        body: args.body || '',
        head: args.head,
        base: args.base || 'main'
      });
    }
  }
];

// Unified, high-performance execution pipeline with normalized errors and request logs
async function executeTool(env, name, args) {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) {
    throw new Error(`Missing tool registry for: ${name}`);
  }

  // PLAN - Validate parameter schemas
  const properties = tool.inputSchema.properties || {};
  const required = tool.inputSchema.required || [];
  
  for (const key of required) {
    if (args[key] === undefined || args[key] === null) {
      throw new Error(`Schema mismatch on ${name}: Parameter '${key}' is required.`);
    }
  }

  // EXECUTE & VERIFY & LOG
  const startTime = Date.now();
  try {
    const data = await tool.handler(env, args);
    const duration = Date.now() - startTime;
    return {
      status: 'success',
      executionMetadata: {
        tool: name,
        durationMs: duration,
        timestamp: new Date().toISOString()
      },
      data
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    return {
      status: 'failed',
      executionMetadata: {
        tool: name,
        durationMs: duration,
        timestamp: new Date().toISOString()
      },
      error: err.message || err.toString()
    };
  }
}

// ── MCP STREAMING HANDLER ───────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
};

function formatJSONResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    }
  });
}

export async function handleMCPRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method === 'GET') {
    // Standard MCP metadata endpoint
    return formatJSONResponse({
      name: 'gigalixir-mcp',
      version: '1.2.0',
      status: 'ok',
      tools: TOOLS.length,
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid Request JSON body', { status: 400, headers: CORS_HEADERS });
  }

  const { jsonrpc = '2.0', id = null, method, params } = body;

  try {
    switch (method) {
      case 'initialize':
        return formatJSONResponse({
          jsonrpc,
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'gigalixir-mcp', version: '1.2.0' },
          }
        });

      case 'notifications/initialized':
        return new Response(null, { status: 204, headers: CORS_HEADERS });

      case 'tools/list':
        // Return protocol tools description schema
        return formatJSONResponse({
          jsonrpc,
          id,
          result: {
            tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
          }
        });

      case 'tools/call': {
        const { name, arguments: args } = params || {};
        const result = await executeTool(env, name, args || {});
        
        // Wrap responses inside unified structural content objects
        return formatJSONResponse({
          jsonrpc,
          id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }],
            isError: result.status === 'failed'
          }
        });
      }

      default:
        return formatJSONResponse({
          jsonrpc,
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        });
    }
  } catch (err) {
    return formatJSONResponse({
      jsonrpc,
      id,
      error: { code: -32603, message: err.message || 'Internal RPC error' }
    });
  }
}

// Default export wrapper for Cloudflare Workers
const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/mcp' || url.pathname === '/') {
      return handleMCPRequest(request, env);
    }
    return new Response('Resource Not Found', { status: 404, headers: CORS_HEADERS });
  }
};

export default worker;
