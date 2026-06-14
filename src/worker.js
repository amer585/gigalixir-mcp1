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
