// Gigalixir MCP Server — Cloudflare Worker
// Implements MCP Streamable HTTP transport (2024-11-05)
// Deploy: wrangler deploy
// Secrets: wrangler secret put GIGALIXIR_EMAIL
//          wrangler secret put GIGALIXIR_API_KEY

const BASE = 'https://api.gigalixir.com';

function auth(env) {
  return 'Basic ' + btoa(`${env.GIGALIXIR_EMAIL}:${env.GIGALIXIR_API_KEY}`);
}

async function api(env, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Authorization': auth(env),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

// ── Turso libSQL HTTP API ────────────────────────────────────────────────────

async function turso(env, sql, args = []) {
  const url = `${env.TURSO_DB_URL}/v2/pipeline`.replace('libsql://', 'https://');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.TURSO_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args: args.map(v => ({ type: 'text', value: String(v) })) } },
        { type: 'close' }
      ]
    }),
  });
  const data = await res.json();
  const result = data?.results?.[0]?.response?.result;
  if (!result) return { error: data };
  const cols = result.cols.map(c => c.name);
  const rows = result.rows.map(row =>
    Object.fromEntries(row.map((cell, i) => [cols[i], cell?.value ?? null]))
  );
  return { cols, rows, affected: result.affected_row_count ?? 0 };
}

// ── GitHub REST API ──────────────────────────────────────────────────────────

async function github(env, method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gigalixir-mcp-worker',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return { success: true };
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

// Get file SHA (required for update/delete)
async function getFileSha(env, owner, repo, path, branch = 'main') {
  const data = await github(env, 'GET', `/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
  return data?.sha ?? null;
}

const TOOLS = [
  {
    name: 'list_apps',
    description: 'List all Gigalixir apps in your account',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_app',
    description: 'Get details about a specific Gigalixir app',
    inputSchema: {
      type: 'object',
      properties: { app_name: { type: 'string', description: 'App name' } },
      required: ['app_name']
    }
  },
  {
    name: 'get_configs',
    description: 'Get environment variables for a Gigalixir app',
    inputSchema: {
      type: 'object',
      properties: { app_name: { type: 'string', description: 'App name' } },
      required: ['app_name']
    }
  },
  {
    name: 'set_config',
    description: 'Set an environment variable for a Gigalixir app (triggers rolling restart)',
    inputSchema: {
      type: 'object',
      properties: {
        app_name: { type: 'string', description: 'App name' },
        key: { type: 'string', description: 'Environment variable name' },
        value: { type: 'string', description: 'Environment variable value' }
      },
      required: ['app_name', 'key', 'value']
    }
  },
  {
    name: 'delete_config',
    description: 'Delete an environment variable from a Gigalixir app',
    inputSchema: {
      type: 'object',
      properties: {
        app_name: { type: 'string', description: 'App name' },
        key: { type: 'string', description: 'Environment variable name to delete' }
      },
      required: ['app_name', 'key']
    }
  },
  {
    name: 'get_replicas',
    description: 'Get the current replica count for a Gigalixir app',
    inputSchema: {
      type: 'object',
      properties: { app_name: { type: 'string', description: 'App name' } },
      required: ['app_name']
    }
  },
  {
    name: 'scale',
    description: 'Scale a Gigalixir app to a given number of replicas (use 0 to stop the app)',
    inputSchema: {
      type: 'object',
      properties: {
        app_name: { type: 'string', description: 'App name' },
        replicas: { type: 'number', description: 'Number of replicas (0 to stop)' }
      },
      required: ['app_name', 'replicas']
    }
  },
  {
    name: 'list_releases',
    description: 'List deployments/releases for a Gigalixir app',
    inputSchema: {
      type: 'object',
      properties: { app_name: { type: 'string', description: 'App name' } },
      required: ['app_name']
    }
  },
  {
    name: 'rollback',
    description: 'Rollback a Gigalixir app to a previous release version',
    inputSchema: {
      type: 'object',
      properties: {
        app_name: { type: 'string', description: 'App name' },
        version: { type: 'number', description: 'Release version number to roll back to' }
      },
      required: ['app_name', 'version']
    }
  },
  {
    name: 'restart',
    description: 'Restart a Gigalixir app by cycling its replicas (scale to 0 then back)',
    inputSchema: {
      type: 'object',
      properties: { app_name: { type: 'string', description: 'App name' } },
      required: ['app_name']
    }
  },
  {
    name: 'get_logs',
    description: 'Get recent log lines for a Gigalixir app',
    inputSchema: {
      type: 'object',
      properties: {
        app_name: { type: 'string', description: 'App name' },
        num_lines: { type: 'number', description: 'Number of log lines to fetch (default 100)' }
      },
      required: ['app_name']
    }
  },
  {
    name: 'create_app',
    description: 'Create a new Gigalixir app',
    inputSchema: {
      type: 'object',
      properties: {
        app_name: { type: 'string', description: 'Unique name for the new app' },
        cloud: { type: 'string', description: 'Cloud provider: gcp or aws (default: gcp)' },
        region: { type: 'string', description: 'Region e.g. v2018-us-central1 (default varies by cloud)' }
      },
      required: ['app_name']
    }
  },

  // ── Turso tools ─────────────────────────────────────────────────────────────
  {
    name: 'turso_query',
    description: 'Run a read-only SQL SELECT query on the Turso database and return rows',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SQL SELECT statement to execute' },
        args: { type: 'array', items: { type: 'string' }, description: 'Optional positional args for ? placeholders' }
      },
      required: ['sql']
    }
  },
  {
    name: 'turso_execute',
    description: 'Run a write SQL statement (INSERT, UPDATE, DELETE, CREATE TABLE, DROP) on the Turso database',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SQL statement to execute' },
        args: { type: 'array', items: { type: 'string' }, description: 'Optional positional args for ? placeholders' }
      },
      required: ['sql']
    }
  },
  {
    name: 'turso_list_tables',
    description: 'List all tables in the Turso database',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'turso_describe_table',
    description: 'Get the schema/columns of a specific table in the Turso database',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' }
      },
      required: ['table']
    }
  },

  // ── GitHub tools ─────────────────────────────────────────────────────────────
  {
    name: 'github_list_repos',
    description: 'List all repositories for the authenticated GitHub user',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Filter: all, owner, public, private, member (default: all)' }
      }
    }
  },
  {
    name: 'github_get_repo',
    description: 'Get details about a specific GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner username' },
        repo: { type: 'string', description: 'Repository name' }
      },
      required: ['owner', 'repo']
    }
  },
  {
    name: 'github_create_repo',
    description: 'Create a new GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Repository name' },
        description: { type: 'string', description: 'Repository description' },
        private: { type: 'boolean', description: 'Make repo private (default: false)' },
        auto_init: { type: 'boolean', description: 'Initialize with README (default: true)' }
      },
      required: ['name']
    }
  },
  {
    name: 'github_list_files',
    description: 'List files and folders in a directory of a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner username' },
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'Directory path (default: root)' },
        branch: { type: 'string', description: 'Branch name (default: main)' }
      },
      required: ['owner', 'repo']
    }
  },
  {
    name: 'github_get_file',
    description: 'Get the contents of a file in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner username' },
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'File path' },
        branch: { type: 'string', description: 'Branch name (default: main)' }
      },
      required: ['owner', 'repo', 'path']
    }
  },
  {
    name: 'github_create_file',
    description: 'Create a new file in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner username' },
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'File path e.g. src/index.js' },
        content: { type: 'string', description: 'File content (plain text)' },
        message: { type: 'string', description: 'Commit message' },
        branch: { type: 'string', description: 'Branch name (default: main)' }
      },
      required: ['owner', 'repo', 'path', 'content', 'message']
    }
  },
  {
    name: 'github_update_file',
    description: 'Update/edit an existing file in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner username' },
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'New file content (plain text)' },
        message: { type: 'string', description: 'Commit message' },
        branch: { type: 'string', description: 'Branch name (default: main)' }
      },
      required: ['owner', 'repo', 'path', 'content', 'message']
    }
  },
  {
    name: 'github_delete_file',
    description: 'Delete a file from a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner username' },
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'File path to delete' },
        message: { type: 'string', description: 'Commit message' },
        branch: { type: 'string', description: 'Branch name (default: main)' }
      },
      required: ['owner', 'repo', 'path', 'message']
    }
  },
  {
    name: 'github_list_branches',
    description: 'List all branches in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner username' },
        repo: { type: 'string', description: 'Repository name' }
      },
      required: ['owner', 'repo']
    }
  },
  {
    name: 'github_create_branch',
    description: 'Create a new branch in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner username' },
        repo: { type: 'string', description: 'Repository name' },
        branch: { type: 'string', description: 'New branch name' },
        from_branch: { type: 'string', description: 'Branch to create from (default: main)' }
      },
      required: ['owner', 'repo', 'branch']
    }
  },
  {
    name: 'github_list_actions',
    description: 'List GitHub Actions workflow runs for a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner username' },
        repo: { type: 'string', description: 'Repository name' }
      },
      required: ['owner', 'repo']
    }
  },
  {
    name: 'github_trigger_action',
    description: 'Trigger a GitHub Actions workflow dispatch event',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner username' },
        repo: { type: 'string', description: 'Repository name' },
        workflow_id: { type: 'string', description: 'Workflow file name e.g. deploy.yml' },
        branch: { type: 'string', description: 'Branch to run on (default: main)' }
      },
      required: ['owner', 'repo', 'workflow_id']
    }
  },
  {
    name: 'github_create_pr',
    description: 'Create a pull request in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner username' },
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'PR title' },
        body: { type: 'string', description: 'PR description' },
        head: { type: 'string', description: 'Branch with changes' },
        base: { type: 'string', description: 'Branch to merge into (default: main)' }
      },
      required: ['owner', 'repo', 'title', 'head']
    }
  },
  {
    name: 'github_list_issues',
    description: 'List issues in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner username' },
        repo: { type: 'string', description: 'Repository name' },
        state: { type: 'string', description: 'open, closed, or all (default: open)' }
      },
      required: ['owner', 'repo']
    }
  },
  {
    name: 'github_create_issue',
    description: 'Create an issue in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repo owner username' },
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue description' }
      },
      required: ['owner', 'repo', 'title']
    }
  }
];

async function callTool(env, name, args) {
  switch (name) {
    case 'list_apps':
      return api(env, 'GET', '/api/apps');

    case 'get_app':
      return api(env, 'GET', `/api/apps/${args.app_name}`);

    case 'get_configs':
      return api(env, 'GET', `/api/apps/${args.app_name}/configs`);

    case 'set_config':
      return api(env, 'PUT', `/api/apps/${args.app_name}/configs`, { [args.key]: args.value });

    case 'delete_config':
      return api(env, 'DELETE', `/api/apps/${args.app_name}/configs/${args.key}`);

    case 'get_replicas':
      return api(env, 'GET', `/api/apps/${args.app_name}/replicas`);

    case 'scale':
      return api(env, 'PUT', `/api/apps/${args.app_name}/replicas`, { replicas: args.replicas });

    case 'list_releases':
      return api(env, 'GET', `/api/apps/${args.app_name}/releases`);

    case 'rollback':
      return api(env, 'POST', `/api/apps/${args.app_name}/releases`, { version: args.version });

    case 'restart': {
      const replicaData = await api(env, 'GET', `/api/apps/${args.app_name}/replicas`);
      const count = replicaData?.data?.replicas_count ?? 1;
      await api(env, 'PUT', `/api/apps/${args.app_name}/replicas`, { replicas: 0 });
      await new Promise(r => setTimeout(r, 2000));
      return api(env, 'PUT', `/api/apps/${args.app_name}/replicas`, { replicas: count });
    }

    case 'get_logs':
      return api(env, 'GET', `/api/apps/${args.app_name}/logs?num_lines=${args.num_lines ?? 100}`);

    case 'create_app': {
      const body = { unique_name: args.app_name };
      if (args.cloud) body.cloud = args.cloud;
      if (args.region) body.region = args.region;
      return api(env, 'POST', '/api/apps', body);
    }

    // ── Turso ──────────────────────────────────────────────────────────────────
    case 'turso_query':
      return turso(env, args.sql, args.args ?? []);

    case 'turso_execute':
      return turso(env, args.sql, args.args ?? []);

    case 'turso_list_tables':
      return turso(env, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");

    case 'turso_describe_table':
      return turso(env, `PRAGMA table_info(${args.table})`);

    // ── GitHub ─────────────────────────────────────────────────────────────────
    case 'github_list_repos':
      return github(env, 'GET', `/user/repos?type=${args.type ?? 'all'}&per_page=100&sort=updated`);

    case 'github_get_repo':
      return github(env, 'GET', `/repos/${args.owner}/${args.repo}`);

    case 'github_create_repo':
      return github(env, 'POST', '/user/repos', {
        name: args.name,
        description: args.description ?? '',
        private: args.private ?? false,
        auto_init: args.auto_init ?? true,
      });

    case 'github_list_files': {
      const p = args.path ?? '';
      const b = args.branch ?? 'main';
      return github(env, 'GET', `/repos/${args.owner}/${args.repo}/contents/${p}?ref=${b}`);
    }

    case 'github_get_file': {
      const b = args.branch ?? 'main';
      const data = await github(env, 'GET', `/repos/${args.owner}/${args.repo}/contents/${args.path}?ref=${b}`);
      if (data?.content) {
        data.decoded_content = atob(data.content.replace(/\n/g, ''));
      }
      return data;
    }

    case 'github_create_file': {
      const b = args.branch ?? 'main';
      return github(env, 'PUT', `/repos/${args.owner}/${args.repo}/contents/${args.path}`, {
        message: args.message,
        content: btoa(unescape(encodeURIComponent(args.content))),
        branch: b,
      });
    }

    case 'github_update_file': {
      const b = args.branch ?? 'main';
      const sha = await getFileSha(env, args.owner, args.repo, args.path, b);
      if (!sha) throw new Error(`File not found: ${args.path}`);
      return github(env, 'PUT', `/repos/${args.owner}/${args.repo}/contents/${args.path}`, {
        message: args.message,
        content: btoa(unescape(encodeURIComponent(args.content))),
        sha,
        branch: b,
      });
    }

    case 'github_delete_file': {
      const b = args.branch ?? 'main';
      const sha = await getFileSha(env, args.owner, args.repo, args.path, b);
      if (!sha) throw new Error(`File not found: ${args.path}`);
      return github(env, 'DELETE', `/repos/${args.owner}/${args.repo}/contents/${args.path}`, {
        message: args.message,
        sha,
        branch: b,
      });
    }

    case 'github_list_branches':
      return github(env, 'GET', `/repos/${args.owner}/${args.repo}/branches`);

    case 'github_create_branch': {
      const fromBranch = args.from_branch ?? 'main';
      const refData = await github(env, 'GET', `/repos/${args.owner}/${args.repo}/git/ref/heads/${fromBranch}`);
      const sha = refData?.object?.sha;
      if (!sha) throw new Error(`Branch not found: ${fromBranch}`);
      return github(env, 'POST', `/repos/${args.owner}/${args.repo}/git/refs`, {
        ref: `refs/heads/${args.branch}`,
        sha,
      });
    }

    case 'github_list_actions':
      return github(env, 'GET', `/repos/${args.owner}/${args.repo}/actions/runs?per_page=20`);

    case 'github_trigger_action':
      return github(env, 'POST', `/repos/${args.owner}/${args.repo}/actions/workflows/${args.workflow_id}/dispatches`, {
        ref: args.branch ?? 'main',
      });

    case 'github_create_pr':
      return github(env, 'POST', `/repos/${args.owner}/${args.repo}/pulls`, {
        title: args.title,
        body: args.body ?? '',
        head: args.head,
        base: args.base ?? 'main',
      });

    case 'github_list_issues':
      return github(env, 'GET', `/repos/${args.owner}/${args.repo}/issues?state=${args.state ?? 'open'}&per_page=50`);

    case 'github_create_issue':
      return github(env, 'POST', `/repos/${args.owner}/${args.repo}/issues`, {
        title: args.title,
        body: args.body ?? '',
      });

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── CORS headers ────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
  });
}

// ── MCP request handler ──────────────────────────────────────────────────────

async function handleMCP(request, env) {
  // Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Health / discovery endpoint
  if (request.method === 'GET') {
    return json({
      name: 'gigalixir-mcp',
      version: '1.1.0',
      status: 'ok',
      tools: TOOLS.length,
      transport: 'streamable-http',
      protocolVersion: '2024-11-05',
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: CORS });
  }

  const { jsonrpc = '2.0', id, method, params } = body;
  let result;

  try {
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'gigalixir-mcp', version: '1.1.0' },
        };
        break;

      case 'notifications/initialized':
        return new Response(null, { status: 204, headers: CORS });

      case 'tools/list':
        result = { tools: TOOLS };
        break;

      case 'tools/call': {
        const { name, arguments: args } = params ?? {};
        if (!name) {
          return json({ jsonrpc, id, error: { code: -32602, message: 'Missing tool name' } });
        }
        try {
          const data = await callTool(env, name, args ?? {});
          result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
        } catch (e) {
          result = {
            content: [{ type: 'text', text: `Error: ${e.message}` }],
            isError: true,
          };
        }
        break;
      }

      default:
        return json({
          jsonrpc,
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
    }
  } catch (e) {
    return json({ jsonrpc, id, error: { code: -32603, message: e.message } });
  }

  return json({ jsonrpc, id, result });
}

// ── Entry point ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/mcp' || pathname === '/') {
      return handleMCP(request, env);
    }
    return new Response('Not found', { status: 404, headers: CORS });
  },
};
