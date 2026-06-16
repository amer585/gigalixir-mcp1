'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  RefreshCw, 
  Terminal, 
  Cpu, 
  Database, 
  Github, 
  Sliders, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  CloudLightning,
  CornerDownRight,
  BookOpen,
  ArrowRight,
  Plus,
  Trash2,
  Settings,
  Layers,
  Globe,
  BarChart2
} from 'lucide-react';

interface ToolDefinition {
  name: string;
  description: string;
  category: 'gigalixir' | 'turso' | 'github' | 'devops' | 'infinicloud';
  defaultArgs: Record<string, any>;
  fields: { name: string; type: string; description: string; required: boolean }[];
}

const TOOLS_SCHEMA: ToolDefinition[] = [
  {
    name: 'list_apps',
    description: 'Retrieve all Gigalixir applications in your account',
    category: 'gigalixir',
    defaultArgs: {},
    fields: []
  },
  {
    name: 'get_app',
    description: 'Get deep metadata for a specific Gigalixir app',
    category: 'gigalixir',
    defaultArgs: { app_name: 'amer' },
    fields: [{ name: 'app_name', type: 'string', description: 'Application name', required: true }]
  },
  {
    name: 'get_replicas',
    description: 'Fetch running container replicas details from orchestrator status',
    category: 'gigalixir',
    defaultArgs: { app_name: 'amer' },
    fields: [{ name: 'app_name', type: 'string', description: 'Application name', required: true }]
  },
  {
    name: 'get_logs',
    description: 'Read the latest log entries of your app containers',
    category: 'gigalixir',
    defaultArgs: { app_name: 'amer', num_lines: 30 },
    fields: [
      { name: 'app_name', type: 'string', description: 'Application name', required: true },
      { name: 'num_lines', type: 'number', description: 'Number of lines to read', required: false }
    ]
  },
  {
    name: 'scale',
    description: 'Scale active replica pool size or change container tier',
    category: 'gigalixir',
    defaultArgs: { app_name: 'amer', replicas: 1 },
    fields: [
      { name: 'app_name', type: 'string', description: 'Application name', required: true },
      { name: 'replicas', type: 'number', description: 'Number of active replicas to scale to', required: true }
    ]
  },
  {
    name: 'diagnose_and_repair_app',
    description: 'Run diagnostic engine scans and trigger self-healing if app is offline',
    category: 'devops',
    defaultArgs: { app_name: 'amer' },
    fields: [{ name: 'app_name', type: 'string', description: 'Gigalixir app identifier', required: true }]
  },
  {
    name: 'orchestrate_deploy_pipeline',
    description: 'Perform safety validations, cache purge setup, and deploy trigger',
    category: 'devops',
    defaultArgs: { app_name: 'amer' },
    fields: [{ name: 'app_name', type: 'string', description: 'Gigalixir app identifier', required: true }]
  },
  {
    name: 'help',
    description: 'Returns a JSON map detailing all available tools, their descriptions, and parameters',
    category: 'devops',
    defaultArgs: {},
    fields: [
      { name: 'filter_by_tool', type: 'string', description: 'Filter result to explain a single specific tool', required: false }
    ]
  },
  {
    name: 'get_configs',
    description: 'Retrieve active environment configuration variables',
    category: 'gigalixir',
    defaultArgs: { app_name: 'amer' },
    fields: [{ name: 'app_name', type: 'string', description: 'Application name', required: true }]
  },
  {
    name: 'set_config',
    description: 'Set custom environment variable and refresh containers',
    category: 'gigalixir',
    defaultArgs: { app_name: 'amer', key: 'NODE_MODULES_CACHE', value: 'false' },
    fields: [
      { name: 'app_name', type: 'string', description: 'Application name', required: true },
      { name: 'key', type: 'string', description: 'Config key name', required: true },
      { name: 'value', type: 'string', description: 'Config value to set', required: true }
    ]
  },
  {
    name: 'turso_query',
    description: 'Execute a read-only SQL lookup query (SELECT) with parameter injection',
    category: 'turso',
    defaultArgs: { sql: 'SELECT * FROM test_users LIMIT 10;' },
    fields: [
      { name: 'sql', type: 'string', description: 'Full SQLite SELECT statement', required: true },
      { name: 'db_url', type: 'string', description: 'Optional target DB connection URL', required: false },
      { name: 'db_token', type: 'string', description: 'Optional target DB authorization token', required: false }
    ]
  },
  {
    name: 'turso_execute',
    description: 'Execute state changing SQL statements (INSERT, UPDATE, DELETE, CREATE, DROP)',
    category: 'turso',
    defaultArgs: { sql: 'CREATE TABLE IF NOT EXISTS sample (id INT, item TEXT);' },
    fields: [
      { name: 'sql', type: 'string', description: 'Full SQLite write query', required: true },
      { name: 'db_url', type: 'string', description: 'Optional target DB connection URL', required: false },
      { name: 'db_token', type: 'string', description: 'Optional target DB authorization token', required: false }
    ]
  },
  {
    name: 'turso_list_tables',
    description: 'List database tables in your integrated Turso storage database',
    category: 'turso',
    defaultArgs: {},
    fields: [
      { name: 'db_url', type: 'string', description: 'Optional target DB connection URL', required: false },
      { name: 'db_token', type: 'string', description: 'Optional target DB authorization token', required: false }
    ]
  },
  {
    name: 'turso_describe_table',
    description: 'Describe definitions, properties, column types, and structures of a target table',
    category: 'turso',
    defaultArgs: { table: 'test_users' },
    fields: [
      { name: 'table', type: 'string', description: 'Full target Table name', required: true },
      { name: 'db_url', type: 'string', description: 'Optional target DB connection URL', required: false },
      { name: 'db_token', type: 'string', description: 'Optional target DB authorization token', required: false }
    ]
  },
  {
    name: 'turso_create_database',
    description: 'Create a brand new SQLite database in your Turso cloud account programmatically',
    category: 'turso',
    defaultArgs: { db_name: 'sandbox-db' },
    fields: [
      { name: 'db_name', type: 'string', description: 'Unique database identifier (lowercase with dashes)', required: true },
      { name: 'org_name', type: 'string', description: 'Optional Turso organization / username', required: false },
      { name: 'api_token', type: 'string', description: 'Optional Turso Platform Access API Token', required: false }
    ]
  },
  {
    name: 'turso_list_databases',
    description: 'List all running Turso databases registered inside your Cloud Platform account',
    category: 'turso',
    defaultArgs: {},
    fields: [
      { name: 'org_name', type: 'string', description: 'Optional Turso organization name', required: false },
      { name: 'api_token', type: 'string', description: 'Optional Turso Platform Access API Token', required: false }
    ]
  },
  {
    name: 'turso_get_database_pool',
    description: 'Retrieve the server-side list of registered databases and which one is currently selected as active',
    category: 'turso',
    defaultArgs: {},
    fields: []
  },
  {
    name: 'turso_add_database_to_pool',
    description: 'Register a database connection under a distinct name inside the server-side pool',
    category: 'turso',
    defaultArgs: { name: 'sandbox', url: 'libsql://sandbox-amer.turso.io', token: '' },
    fields: [
      { name: 'name', type: 'string', description: 'Identifier for this database connection', required: true },
      { name: 'url', type: 'string', description: 'Connection URL (libsql:// or https://)', required: true },
      { name: 'token', type: 'string', description: 'Database authentication token', required: false },
      { name: 'set_active', type: 'boolean', description: 'Set as active default target immediately', required: false }
    ]
  },
  {
    name: 'turso_set_active_database',
    description: 'Switch the default active database target inside the pool',
    category: 'turso',
    defaultArgs: { name: 'sandbox' },
    fields: [
      { name: 'name', type: 'string', description: 'Name of the database from the pool to activate', required: true }
    ]
  },
  {
    name: 'turso_remove_database_from_pool',
    description: 'Delete a database registration from the server-side pool',
    category: 'turso',
    defaultArgs: { name: 'sandbox' },
    fields: [
      { name: 'name', type: 'string', description: 'Name of the database from the pool to remove', required: true }
    ]
  },
  {
    name: 'turso_get_database_usage',
    description: 'Query Turso Platform API to retrieve read/write usage statistics and storage bytes used for a specific database',
    category: 'turso',
    defaultArgs: { db_name: 'sandbox' },
    fields: [
      { name: 'db_name', type: 'string', description: 'Name of the database', required: true },
      { name: 'org_name', type: 'string', description: 'Optional Turso organization name', required: false },
      { name: 'api_token', type: 'string', description: 'Optional Turso Platform Access API Token', required: false }
    ]
  },
  {
    name: 'github_list_repos',
    description: 'Retrieve linked repositories to inspect deployment sources',
    category: 'github',
    defaultArgs: {},
    fields: []
  },
  {
    name: 'github_get_repo',
    description: 'Fetch complete metadata of a repository',
    category: 'github',
    defaultArgs: { owner: 'amer585', repo: 'gigalixir-mcp1' },
    fields: [
      { name: 'owner', type: 'string', description: 'Organization/Username owner', required: true },
      { name: 'repo', type: 'string', description: 'Repository Name', required: true }
    ]
  },
  {
    name: 'github_list_files',
    description: 'Recurse directories and fetch file statuses inside a repository',
    category: 'github',
    defaultArgs: { owner: 'amer585', repo: 'gigalixir-mcp1', path: '' },
    fields: [
      { name: 'owner', type: 'string', description: 'Organization/Username owner', required: true },
      { name: 'repo', type: 'string', description: 'Repository Name', required: true },
      { name: 'path', type: 'string', description: 'Directory path', required: false },
      { name: 'branch', type: 'string', description: 'Target branch (default is main)', required: false }
    ]
  },
  {
    name: 'github_get_file',
    description: 'Read the parsed lines inside a repository file',
    category: 'github',
    defaultArgs: { owner: 'amer585', repo: 'gigalixir-mcp1', path: 'README.md' },
    fields: [
      { name: 'owner', type: 'string', description: 'Organization/Username owner', required: true },
      { name: 'repo', type: 'string', description: 'Repository Name', required: true },
      { name: 'path', type: 'string', description: 'File path', required: true },
      { name: 'branch', type: 'string', description: 'Target branch (default is main)', required: false }
    ]
  },
  {
    name: 'github_create_file',
    description: 'Create a brand new file in a repository',
    category: 'github',
    defaultArgs: { owner: 'amer585', repo: 'gigalixir-mcp1', path: 'test_file.txt', content: 'Hello World', message: 'create test_file.txt' },
    fields: [
      { name: 'owner', type: 'string', description: 'Organization/Username owner', required: true },
      { name: 'repo', type: 'string', description: 'Repository Name', required: true },
      { name: 'path', type: 'string', description: 'File path', required: true },
      { name: 'content', type: 'string', description: 'UTF-8 file content', required: true },
      { name: 'message', type: 'string', description: 'Commit message', required: true },
      { name: 'branch', type: 'string', description: 'Target branch (default is main)', required: false }
    ]
  },
  {
    name: 'github_update_file',
    description: 'Modify an existing file matching its tree SHA reference automatically',
    category: 'github',
    defaultArgs: { owner: 'amer585', repo: 'gigalixir-mcp1', path: 'test_file.txt', content: 'Hello World updated', message: 'update test_file.txt' },
    fields: [
      { name: 'owner', type: 'string', description: 'Organization/Username owner', required: true },
      { name: 'repo', type: 'string', description: 'Repository Name', required: true },
      { name: 'path', type: 'string', description: 'File path', required: true },
      { name: 'content', type: 'string', description: 'UTF-8 file content', required: true },
      { name: 'message', type: 'string', description: 'Commit message', required: true },
      { name: 'branch', type: 'string', description: 'Target branch (default is main)', required: false }
    ]
  },
  {
    name: 'github_get_diff',
    description: 'Compare two branches or commits and return the diff format representation or JSON file checklist',
    category: 'github',
    defaultArgs: { owner: 'amer585', repo: 'gigalixir-mcp1', base: 'main', head: 'main', raw_diff: false },
    fields: [
      { name: 'owner', type: 'string', description: 'GitHub username or organization Token', required: true },
      { name: 'repo', type: 'string', description: 'Repository Name', required: true },
      { name: 'base', type: 'string', description: 'Base branch or commit SHA', required: true },
      { name: 'head', type: 'string', description: 'Head branch or commit SHA', required: true },
      { name: 'raw_diff', type: 'boolean', description: 'Display raw unified diff text format', required: false }
    ]
  },
  {
    name: 'github_commit',
    description: 'Commit multiple file changes atomically using the low-level Git trees and reference API',
    category: 'github',
    defaultArgs: { owner: 'amer585', repo: 'gigalixir-mcp1', branch: 'main', message: 'feat: dynamic update from dashboard', changes: [{ path: 'dashboard_note.txt', content: 'Testing automated committing!' }] },
    fields: [
      { name: 'owner', type: 'string', description: 'GitHub username or organization', required: true },
      { name: 'repo', type: 'string', description: 'Repository Name', required: true },
      { name: 'branch', type: 'string', description: 'Target branch name (default is main)', required: true },
      { name: 'message', type: 'string', description: 'Commit message', required: true },
      { name: 'changes', type: 'array', description: 'JSON array of files to commit, e.g. [{"path":"hello.txt","content":"hi"}]', required: true }
    ]
  },
  {
    name: 'github_actions_workflow_control',
    description: 'Check status, retrieve lists, trigger, or cancel GitHub Actions workflow runs',
    category: 'devops',
    defaultArgs: { owner: 'amer585', repo: 'gigalixir-mcp1', action_type: 'list_workflows', workflow_id: 'gigalixir-deploy.yml', run_id: '', branch: 'main' },
    fields: [
      { name: 'owner', type: 'string', description: 'GitHub username or organization', required: true },
      { name: 'repo', type: 'string', description: 'Repository Name', required: true },
      { name: 'action_type', type: 'string', description: 'list_workflows, list_runs, trigger_workflow, cancel_run', required: true },
      { name: 'workflow_id', type: 'string', description: 'Workflow ID or filename for trigger action', required: false },
      { name: 'run_id', type: 'string', description: 'Run ID to cancel', required: false },
      { name: 'branch', type: 'string', description: 'Target branch name', required: false }
    ]
  },
  {
    name: 'turso_explain_query',
    description: 'Prepend EXPLAIN QUERY PLAN to your SQL query to evaluate indices and optimize search structures',
    category: 'turso',
    defaultArgs: { sql: 'SELECT * FROM sqlite_master;', db_url: 'libsql://ewe-amer.aws-eu-west-1.turso.io', db_token: '' },
    fields: [
      { name: 'sql', type: 'string', description: 'Query statement to evaluate', required: true },
      { name: 'db_url', type: 'string', description: 'Optional target DB connection URL', required: false },
      { name: 'db_token', type: 'string', description: 'Optional target DB authorization token', required: false }
    ]
  },
  {
    name: 'turso_backup',
    description: 'Fetch complete DDL schemas and structured SQL inserts to generate an offline backup file',
    category: 'turso',
    defaultArgs: { db_name: 'production-db', db_url: 'libsql://ewe-amer.aws-eu-west-1.turso.io', db_token: '' },
    fields: [
      { name: 'db_name', type: 'string', description: 'Active database display label', required: false },
      { name: 'db_url', type: 'string', description: 'Optional target DB connection URL', required: false },
      { name: 'db_token', type: 'string', description: 'Optional target DB authorization token', required: false }
    ]
  },
  {
    name: 'promote_environment',
    description: 'Promote active custom environments from Staging to Production, comparing layouts, environment keys, and deployment scopes',
    category: 'devops',
    defaultArgs: { source_app: 'amer-staging', target_app: 'amer-production' },
    fields: [
      { name: 'source_app', type: 'string', description: 'Staging app name', required: true },
      { name: 'target_app', type: 'string', description: 'Production app name', required: true }
    ]
  },
  {
    name: 'gigalixir_manage_domains',
    description: 'Add, list, or remove custom domains for Gigalixir application targets',
    category: 'gigalixir',
    defaultArgs: { app_name: 'amer', action: 'list', domain: 'custom.mydomain.com' },
    fields: [
      { name: 'app_name', type: 'string', description: 'Gigalixir App Name', required: true },
      { name: 'action', type: 'string', description: 'list, add, or delete', required: true },
      { name: 'domain', type: 'string', description: 'Target custom domain name (FQDN)', required: false }
    ]
  },
  {
    name: 'gigalixir_manage_ssl',
    description: 'Track and verify SSL Certificate provisioning and routing setups on custom app domains',
    category: 'gigalixir',
    defaultArgs: { app_name: 'amer', domain: 'custom.mydomain.com' },
    fields: [
      { name: 'app_name', type: 'string', description: 'Gigalixir App Name', required: true },
      { name: 'domain', type: 'string', description: 'Custom domain hostname (FQDN)', required: true }
    ]
  },
  {
    name: 'deploy_preview',
    description: 'Instantly compile, build-wrap, and launch a preview sandbox environment for active feature inspection',
    category: 'devops',
    defaultArgs: { app_name: 'amer', owner: 'amer585', repo: 'gigalixir-mcp1', branch: 'feature-preview' },
    fields: [
      { name: 'app_name', type: 'string', description: 'Staging target base', required: true },
      { name: 'owner', type: 'string', description: 'GitHub owner', required: true },
      { name: 'repo', type: 'string', description: 'GitHub repo', required: true },
      { name: 'branch', type: 'string', description: 'Branch to build preview/sandbox from', required: false }
    ]
  },
  {
    name: 'deploy_production',
    description: 'Trigger full-scale production environment build, synchronization, rolling deployment cycles, and safety metrics scan',
    category: 'devops',
    defaultArgs: { app_name: 'amer', owner: 'amer585', repo: 'gigalixir-mcp1', branch: 'main' },
    fields: [
      { name: 'app_name', type: 'string', description: 'Active production App identifier', required: true },
      { name: 'owner', type: 'string', description: 'GitHub repo owner', required: true },
      { name: 'repo', type: 'string', description: 'GitHub repo name', required: true },
      { name: 'branch', type: 'string', description: 'Source production branch (usually main)', required: false }
    ]
  },
  {
    name: 'infinicloud_list_files',
    description: 'Retrieve real-time directories, archives, and structured files over WebDAV from InfiniCLOUD node',
    category: 'infinicloud',
    defaultArgs: { path: '/' },
    fields: [
      { name: 'path', type: 'string', description: 'WebDAV directory relative path (e.g. "/" or "backups")', required: true }
    ]
  },
  {
    name: 'infinicloud_get_file',
    description: 'Download and read the full text content of an existing file stored on your InfiniCLOUD storage node',
    category: 'infinicloud',
    defaultArgs: { path: 'notes.txt' },
    fields: [
      { name: 'path', type: 'string', description: 'Relative path of the target file', required: true }
    ]
  },
  {
    name: 'infinicloud_create_file',
    description: 'Create directories, files, configurations, or overwrite arbitrary text files over WebDAV on InfiniCLOUD',
    category: 'infinicloud',
    defaultArgs: { path: 'notes.txt', content: 'WebDAV upload initiated successfully.' },
    fields: [
      { name: 'path', type: 'string', description: 'Relative target path for creation', required: true },
      { name: 'content', type: 'string', description: 'Raw file contents', required: true }
    ]
  },
  {
    name: 'infinicloud_delete_file',
    description: 'Remove folders, database backups, or active files from InfiniCLOUD permanently',
    category: 'infinicloud',
    defaultArgs: { path: 'notes.txt' },
    fields: [
      { name: 'path', type: 'string', description: 'Path to target item for deletion', required: true }
    ]
  },
  {
    name: 'infinicloud_create_directory',
    description: 'Structure and compile a new custom directory folder path inside InfiniCLOUD storage via WebDAV MKCOL',
    category: 'infinicloud',
    defaultArgs: { path: 'backups' },
    fields: [
      { name: 'path', type: 'string', description: 'Relative folder path to compile', required: true }
    ]
  }
];

export interface GigalixirAccount {
  name: string;
  gigalixir_api_key: string;
  email: string;
}

export interface InfinicloudAccount {
  name: string;
  dav_url: string;
  username: string;
  password: string;
}

export default function Dashboard() {
  const [selectedTool, setSelectedTool] = useState<ToolDefinition>(TOOLS_SCHEMA[5]); // 'diagnose_and_repair_app' as default
  const [toolArgs, setToolArgs] = useState<Record<string, any>>(TOOLS_SCHEMA[5].defaultArgs);
  const [running, setRunning] = useState<boolean>(false);
  const [mcpMetadata, setMcpMetadata] = useState<any>(null);
  const [consoleLogs, setConsoleLogs] = useState<{ time: string; text: string; type: 'info' | 'success' | 'error' | 'input' }[]>([
    { time: new Date().toLocaleTimeString(), text: 'DevOps & MCP Web GUI Dashboard initialised.', type: 'info' }
  ]);
  const [rawResponse, setRawResponse] = useState<string>('');
  
  const [workerUrl, setWorkerUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mcp_worker_url') || '';
    }
    return '';
  });

  const fetchGateway = useCallback((path: string, options?: RequestInit) => {
    const target = workerUrl ? workerUrl : '/';
    return fetch(target, options);
  }, [workerUrl]);
  
  // ── Turso Cluster State and Handlers ─────────────────────────────────────
  const [tursoPlatformToken, setTursoPlatformToken] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('turso_platform_token') || '';
    }
    return '';
  });
  const [tursoPlatformOrg, setTursoPlatformOrg] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('turso_platform_org') || 'amer';
    }
    return 'amer';
  });
  const [tursoDbs, setTursoDbs] = useState<Array<{ name: string; url: string; token: string }>>(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('turso_registered_dbs');
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {
          // fallback
        }
      }
    }
    return [
      { name: 'meow', url: 'libsql://meow-amer.aws-eu-west-1.turso.io', token: '' },
      { name: 'default', url: 'libsql://default-amer.aws-eu-west-1.turso.io', token: '' }
    ];
  });
  const [activeTursoDb, setActiveTursoDb] = useState<{ name: string; url: string; token: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('turso_active_db');
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {
          // ignore
        }
      }
      const rawDbs = localStorage.getItem('turso_registered_dbs');
      if (rawDbs) {
        try {
          const parsed = JSON.parse(rawDbs);
          if (parsed.length > 0) return parsed[0];
        } catch {
          // ignore
        }
      }
    }
    return { name: 'meow', url: 'libsql://meow-amer.aws-eu-west-1.turso.io', token: '' };
  });
  const [newDbName, setNewDbName] = useState<string>('');
  const [sqlInput, setSqlInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('turso_sql_input') || 'SELECT * FROM test_users LIMIT 10;';
    }
    return 'SELECT * FROM test_users LIMIT 10;';
  });
  const [sqlRunning, setSqlRunning] = useState<boolean>(false);
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string>('');
  const [tableDataLoading, setTableDataLoading] = useState<boolean>(false);

  // Manual register form state
  const [manualDbName, setManualDbName] = useState<string>('');
  const [manualDbUrl, setManualDbUrl] = useState<string>('');
  const [manualDbToken, setManualDbToken] = useState<string>('');

  const appendLog = useCallback((text: string, type: 'info' | 'success' | 'error' | 'input' = 'info') => {
    setConsoleLogs(prev => [
      ...prev,
      { time: new Date().toLocaleTimeString(), text, type }
    ]);
  }, []);

  const updateWorkerUrl = (url: string) => {
    const cleanUrl = url.trim();
    setWorkerUrl(cleanUrl);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mcp_worker_url', cleanUrl);
    }
    appendLog(`Switched MCP Gateway connection endpoint to: ${cleanUrl || 'Local Server Node'}`, 'success');
    
    // Immediately fetch updated state from the new target
    setTimeout(() => {
      fetchMcpMetadata();
      fetchAppStatus('amer');
    }, 50);
  };

  // ── Gigalixir Accounts State & Helpers ────────────────────────────────────
  const [gigalixirAccounts, setGigalixirAccounts] = useState<GigalixirAccount[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('gigalixir_accounts');
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        console.error("Failed to parse gigalixir_accounts in dashboard:", e);
      }
    }
    return [];
  });

  const [activeAccountName, setActiveAccountName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('active_gigalixir_account_name') || '';
    }
    return '';
  });

  // State fields for the "Add Account" form
  const [newAccName, setNewAccName] = useState('');
  const [newAccEmail, setNewAccEmail] = useState('');
  const [newAccApiKey, setNewAccApiKey] = useState('');

  const activeAccount = gigalixirAccounts.find(acc => acc.name === activeAccountName) || null;

  const selectGigalixirAccount = useCallback((name: string) => {
    setActiveAccountName(name);
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_gigalixir_account_name', name);
    }
    if (name) {
      const acc = gigalixirAccounts.find(a => a.name === name);
      appendLog(`Switched active Gigalixir account to: "${name}" (${acc?.email})`, "success");
    } else {
      appendLog("Switched active Gigalixir account to: [Default env variables]", "info");
    }
  }, [gigalixirAccounts, appendLog]);

  const addGigalixirAccount = useCallback((name: string, email: string, apiKey: string) => {
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanApiKey = apiKey.trim();
    if (!cleanName || !cleanEmail || !cleanApiKey) {
      appendLog("Error: Name, email, and API key are required to add a Gigalixir account.", "error");
      return;
    }

    if (gigalixirAccounts.some(acc => acc.name.toLowerCase() === cleanName.toLowerCase())) {
      appendLog(`Error: Account name "${cleanName}" already exists.`, "error");
      return;
    }

    const updated = [...gigalixirAccounts, { name: cleanName, email: cleanEmail, gigalixir_api_key: cleanApiKey }];
    setGigalixirAccounts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gigalixir_accounts', JSON.stringify(updated));
    }
    appendLog(`Added Gigalixir API account profile: "${cleanName}" (${cleanEmail})`, "success");

    // Automatically set as active if it's the only one or if none active
    if (!activeAccountName) {
      setActiveAccountName(cleanName);
      localStorage.setItem('active_gigalixir_account_name', cleanName);
    }

    // Reset inputs
    setNewAccName('');
    setNewAccEmail('');
    setNewAccApiKey('');
  }, [gigalixirAccounts, activeAccountName, appendLog, setNewAccName, setNewAccEmail, setNewAccApiKey]);

  const removeGigalixirAccount = useCallback((name: string) => {
    const updated = gigalixirAccounts.filter(acc => acc.name !== name);
    setGigalixirAccounts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gigalixir_accounts', JSON.stringify(updated));
    }
    appendLog(`Removed Gigalixir account: "${name}"`, "info");

    if (activeAccountName === name) {
      const nextActive = updated.length > 0 ? updated[0].name : '';
      setActiveAccountName(nextActive);
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_gigalixir_account_name', nextActive);
      }
    }
  }, [gigalixirAccounts, activeAccountName, appendLog]);

  // ── InfiniCLOUD WebDAV Profiles State & Helpers ───────────────────────────
  const [infinicloudAccounts, setInfinicloudAccounts] = useState<InfinicloudAccount[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('infinicloud_accounts');
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        console.error("Failed to parse infinicloud_accounts in dashboard:", e);
      }
    }
    return [];
  });

  const [activeInfinicloudAccountName, setActiveInfinicloudAccountName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('active_infinicloud_account_name') || '';
    }
    return '';
  });

  // State fields for the "Add InfiniCLOUD Profile" form
  const [newCloudName, setNewCloudName] = useState('');
  const [newCloudUrl, setNewCloudUrl] = useState('');
  const [newCloudUser, setNewCloudUser] = useState('');
  const [newCloudPass, setNewCloudPass] = useState('');

  const activeInfinicloudAccount = infinicloudAccounts.find(acc => acc.name === activeInfinicloudAccountName) || null;

  const selectInfinicloudAccount = useCallback((name: string) => {
    setActiveInfinicloudAccountName(name);
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_infinicloud_account_name', name);
    }
    if (name) {
      const acc = infinicloudAccounts.find(a => a.name === name);
      appendLog(`Switched active InfiniCLOUD profile to: "${name}" (${acc?.username})`, "success");
    } else {
      appendLog("Switched active InfiniCLOUD profile to: [Default env variables]", "info");
    }
  }, [infinicloudAccounts, appendLog]);

  const addInfinicloudAccount = useCallback((name: string, url: string, user: string, pass: string) => {
    const cleanName = name.trim();
    const cleanUrl = url.trim();
    const cleanUser = user.trim();
    const cleanPass = pass.trim();
    if (!cleanName || !cleanUrl || !cleanUser || !cleanPass) {
      appendLog("Error: Name, connection URL, Username, and password are required to add an InfiniCLOUD WebDAV profile.", "error");
      return;
    }

    if (infinicloudAccounts.some(acc => acc.name.toLowerCase() === cleanName.toLowerCase())) {
      appendLog(`Error: Profile name "${cleanName}" already exists.`, "error");
      return;
    }

    const updated = [...infinicloudAccounts, { name: cleanName, dav_url: cleanUrl, username: cleanUser, password: cleanPass }];
    setInfinicloudAccounts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('infinicloud_accounts', JSON.stringify(updated));
    }
    appendLog(`Added InfiniCLOUD WebDAV account profile: "${cleanName}" (${cleanUser})`, "success");

    // Automatically set as active if it's the only one or if none active
    if (!activeInfinicloudAccountName) {
      setActiveInfinicloudAccountName(cleanName);
      localStorage.setItem('active_infinicloud_account_name', cleanName);
    }

    // Reset inputs
    setNewCloudName('');
    setNewCloudUrl('');
    setNewCloudUser('');
    setNewCloudPass('');
  }, [infinicloudAccounts, activeInfinicloudAccountName, appendLog, setNewCloudName, setNewCloudUrl, setNewCloudUser, setNewCloudPass]);

  const removeInfinicloudAccount = useCallback((name: string) => {
    const updated = infinicloudAccounts.filter(acc => acc.name !== name);
    setInfinicloudAccounts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('infinicloud_accounts', JSON.stringify(updated));
    }
    appendLog(`Removed InfiniCLOUD WebDAV profile: "${name}"`, "info");

    if (activeInfinicloudAccountName === name) {
      const nextActive = updated.length > 0 ? updated[0].name : '';
      setActiveInfinicloudAccountName(nextActive);
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_infinicloud_account_name', nextActive);
      }
    }
  }, [infinicloudAccounts, activeInfinicloudAccountName, appendLog]);

  const [dbStats, setDbStats] = useState<Record<string, { rows_read: number; rows_written: number; storage_bytes_used: number; loading: boolean }>>({});

  // Sync server pool with client local pool
  const syncPoolWithServer = useCallback(async () => {
    try {
      const payload = {
        jsonrpc: '2.0',
        id: `get-pool-${Date.now()}`,
        method: 'tools/call',
        params: { name: 'turso_get_database_pool', arguments: {} }
      };
      const res = await fetchGateway('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const rpcData = await res.json();
        const text = rpcData.result?.content?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed.success && Array.isArray(parsed.databases)) {
            const serverDbs = parsed.databases;
            if (serverDbs.length > 0) {
              setTursoDbs(prev => {
                const merged = [...prev];
                serverDbs.forEach((s: any) => {
                  const sIdx = merged.findIndex(m => m.name === s.name);
                  if (sIdx !== -1) {
                    merged[sIdx] = s;
                  } else {
                    merged.push(s);
                  }
                });
                if (typeof window !== 'undefined') {
                  localStorage.setItem('turso_registered_dbs', JSON.stringify(merged));
                }
                return merged;
              });

              if (parsed.active_database) {
                const foundActive = serverDbs.find((d: any) => d.name === parsed.active_database);
                if (foundActive) {
                  setActiveTursoDb(foundActive);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('turso_active_db', JSON.stringify(foundActive));
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch server-side database pool:", e);
    }
  }, [fetchGateway]);

  useEffect(() => {
    const timer = setTimeout(() => {
      syncPoolWithServer();
    }, 100);
    return () => clearTimeout(timer);
  }, [syncPoolWithServer]);

  const saveDbs = async (dbs: typeof tursoDbs) => {
    setTursoDbs(dbs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('turso_registered_dbs', JSON.stringify(dbs));
    }
  };

  const selectActiveDb = async (db: typeof activeTursoDb) => {
    setActiveTursoDb(db);
    if (db) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('turso_active_db', JSON.stringify(db));
      }
      appendLog(`Switched active database target to: "${db.name}"`, 'info');
      // Sync choice to server
      try {
        await fetchGateway('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `set-active-${Date.now()}`,
            method: 'tools/call',
            params: {
              name: 'turso_set_active_database',
              arguments: { name: db.name }
            }
          })
        });
      } catch (e) {
        console.error(e);
      }
    } else {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('turso_active_db');
      }
    }
  };

  const fetchTablesList = useCallback(async (targetDb: { name: string; url: string; token: string }) => {
    setTableDataLoading(true);
    try {
      const payload = {
        jsonrpc: '2.0',
        id: `tables-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: 'turso_list_tables',
          arguments: {
            db_url: targetDb.url,
            db_token: targetDb.token
          }
        }
      };

      const res = await fetchGateway('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();
      const contentText = data.result?.content?.[0]?.text;
      
      if (contentText) {
        const parsedResult = JSON.parse(contentText);
        if (parsedResult.success && parsedResult.rows) {
          const names = parsedResult.rows.map((row: any) => row.name || row.tbl_name);
          setTables(names);
          if (names.length > 0) {
            setActiveTable(names[0]);
          } else {
            setActiveTable('');
          }
          appendLog(`Retrieved schemas & ${names.length} tables from "${targetDb.name}".`, 'info');
        } else {
          setTables([]);
          setActiveTable('');
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setTableDataLoading(false);
    }
  }, [appendLog, fetchGateway]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTursoDb) {
        fetchTablesList(activeTursoDb);
      } else {
        setTables([]);
        setActiveTable('');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTursoDb, fetchTablesList]);

  const runCustomSql = async (isQuery: boolean = true) => {
    if (!activeTursoDb) {
      appendLog("Please select or add an active database first.", "error");
      return;
    }
    setSqlRunning(true);
    setSqlResult(null);
    appendLog(`Executing SQL statement on "${activeTursoDb.name}"...`, 'input');
    if (typeof window !== 'undefined') {
      localStorage.setItem('turso_sql_input', sqlInput);
    }

    try {
      const payload = {
        jsonrpc: '2.0',
        id: `sql-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: isQuery ? 'turso_query' : 'turso_execute',
          arguments: {
            sql: sqlInput,
            db_url: activeTursoDb.url,
            db_token: activeTursoDb.token
          }
        }
      };

      const res = await fetchGateway('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const rpcData = await res.json();
      const text = rpcData.result?.content?.[0]?.text;
      
      if (text) {
        const data = JSON.parse(text);
        setSqlResult(data);
        if (data.error) {
          appendLog(`SQL Error on index execution: ${data.error}`, 'error');
        } else {
          appendLog(`SQL execution completed. Affected: ${data.rowsAffected ?? 0} rows.`, 'success');
          if (!isQuery && /create|alter|drop|rename/i.test(sqlInput)) {
            fetchTablesList(activeTursoDb);
          }
        }
      }
    } catch (err: any) {
      appendLog(`SQL connection exception: ${err.message}`, 'error');
    } finally {
      setSqlRunning(false);
    }
  };

  const viewTableDetails = async (tableName: string) => {
    if (!activeTursoDb || !tableName) return;
    setSqlInput(`SELECT * FROM ${tableName} LIMIT 50;`);
    setSqlRunning(true);
    setSqlResult(null);
    appendLog(`Fetching contents from table "${tableName}" on database "${activeTursoDb.name}"...`, 'input');
    
    try {
      const payload = {
        jsonrpc: '2.0',
        id: `sql-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: 'turso_query',
          arguments: {
            sql: `SELECT * FROM ${tableName} LIMIT 50;`,
            db_url: activeTursoDb.url,
            db_token: activeTursoDb.token
          }
        }
      };

      const res = await fetchGateway('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const rpcData = await res.json();
      const text = rpcData.result?.content?.[0]?.text;
      if (text) {
        const data = JSON.parse(text);
        setSqlResult(data);
        if (data.error) {
          appendLog(`Query failed: ${data.error}`, 'error');
        } else {
          appendLog(`Loaded ${data.rows?.length ?? 0} records from "${tableName}".`, 'success');
        }
      }
    } catch (err: any) {
      appendLog(`Table query exception: ${err.message}`, 'error');
    } finally {
      setSqlRunning(false);
    }
  };

  const fetchDbUsageStats = async (dbName: string) => {
    if (!tursoPlatformToken) {
      appendLog("A Turso Platform API Access token is required to load usage statistics.", "error");
      return;
    }
    setDbStats(prev => ({
      ...prev,
      [dbName]: { ...(prev[dbName] || { rows_read: 0, rows_written: 0, storage_bytes_used: 0 }), loading: true }
    }));
    try {
      const payload = {
        jsonrpc: '2.0',
        id: `usage-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: 'turso_get_database_usage',
          arguments: {
            db_name: dbName,
            org_name: tursoPlatformOrg,
            api_token: tursoPlatformToken
          }
        }
      };

      const res = await fetchGateway('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rpcData = await res.json();
      const text = rpcData.result?.content?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed.success && parsed.usage) {
          setDbStats(prev => ({
            ...prev,
            [dbName]: {
              rows_read: parsed.usage.rows_read,
              rows_written: parsed.usage.rows_written,
              storage_bytes_used: parsed.usage.storage_bytes_used,
              loading: false
            }
          }));
          appendLog(`Usage details for "${dbName}": Reads: ${parsed.usage.rows_read}, Writes: ${parsed.usage.rows_written}.`, 'success');
        } else {
          throw new Error(parsed.error || "No usage returned");
        }
      }
    } catch (err: any) {
      console.error(err);
      setDbStats(prev => ({
        ...prev,
        [dbName]: { ...(prev[dbName] || { rows_read: 0, rows_written: 0, storage_bytes_used: 0 }), loading: false }
      }));
      appendLog(`Usage stat check failed for "${dbName}": ${err.message}`, 'error');
    }
  };

  const syncDatabasesFromTurso = async () => {
    if (!tursoPlatformToken) {
      appendLog("A Turso Platform API Access token is required to list account databases.", "error");
      return;
    }
    setRunning(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('turso_platform_token', tursoPlatformToken);
      localStorage.setItem('turso_platform_org', tursoPlatformOrg);
    }
    appendLog(`Syncing databases for organization "${tursoPlatformOrg}" from Turso Cloud...`, 'input');
    try {
      const payload = {
        jsonrpc: '2.0',
        id: `sync-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: 'turso_list_databases',
          arguments: {
            org_name: tursoPlatformOrg,
            api_token: tursoPlatformToken
          }
        }
      };

      const res = await fetchGateway('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const rpcData = await res.json();
      const contentText = rpcData.result?.content?.[0]?.text;
      
      if (contentText) {
        const parsedResult = JSON.parse(contentText);
        if (parsedResult.success && parsedResult.databases) {
          const formatted = parsedResult.databases.map((db: any) => ({
            name: db.name,
            url: db.url,
            token: tursoDbs.find(d => d.name === db.name)?.token || ''
          }));
          
          saveDbs(formatted);
          if (formatted.length > 0) {
            selectActiveDb(formatted[0]);
          }

          // Register all found databases inside the server pool too (runs asynchronously)
          for (const db of formatted) {
            fetchGateway('/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: `sync-reg-${db.name}`,
                method: 'tools/call',
                params: {
                  name: 'turso_add_database_to_pool',
                  arguments: { name: db.name, url: db.url, token: db.token, set_active: false }
                }
              })
            }).catch(() => {});
          }

          appendLog(`Discovered & synchronized ${formatted.length} databases from your account.`, 'success');
        } else {
          appendLog(`Authorization failed or no databases returned.`, 'error');
        }
      }
    } catch (err: any) {
      appendLog(`Synchronization failure: ${err.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const createNewTursoDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDbName.trim()) return;
    if (!tursoPlatformToken) {
      appendLog("Platform Access token is required to deploy a new database.", "error");
      return;
    }
    setRunning(true);
    const dbNameClean = newDbName.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
    appendLog(`Deploying and provisioning brand-new serverless database "${dbNameClean}"...`, 'input');

    try {
      const payload = {
        jsonrpc: '2.0',
        id: `create-db-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: 'turso_create_database',
          arguments: {
            db_name: dbNameClean,
            org_name: tursoPlatformOrg,
            api_token: tursoPlatformToken
          }
        }
      };

      const res = await fetchGateway('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const rpcData = await res.json();
      const contentText = rpcData.result?.content?.[0]?.text;
      
      if (contentText) {
        const data = JSON.parse(contentText);
        if (data.success) {
          const newDb = {
            name: data.database_name,
            url: data.db_url,
            token: data.db_token
          };
          const updatedDbs = [...tursoDbs.filter(d => d.name !== newDb.name), newDb];
          saveDbs(updatedDbs);
          selectActiveDb(newDb);
          setNewDbName('');

          // Sync with server-side pool immediately!
          await fetchGateway('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: `create-reg-${newDb.name}`,
              method: 'tools/call',
              params: {
                name: 'turso_add_database_to_pool',
                arguments: { name: newDb.name, url: newDb.url, token: newDb.token, set_active: true }
              }
            })
          });

          appendLog(`Success! Database "${newDb.name}" has been created and registered as active query target.`, 'success');
        } else {
          appendLog(`Creation aborted: ${data.error || 'Check access rights'}`, 'error');
        }
      }
    } catch (err: any) {
      appendLog(`Creation failed: ${err.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const registerManualDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDbName.trim() || !manualDbUrl.trim()) {
      appendLog("Database name and link are required.", "error");
      return;
    }
    const cleanName = manualDbName.trim().toLowerCase();
    const cleanUrl = manualDbUrl.trim();
    const cleanToken = manualDbToken.trim();

    const db = { name: cleanName, url: cleanUrl, token: cleanToken };
    const updatedDbs = [...tursoDbs.filter(d => d.name !== cleanName), db];
    saveDbs(updatedDbs);
    selectActiveDb(db);

    // Sync with server-side pool immediately!
    try {
      await fetchGateway('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `manual-reg-${cleanName}`,
          method: 'tools/call',
          params: {
            name: 'turso_add_database_to_pool',
            arguments: { name: cleanName, url: cleanUrl, token: cleanToken, set_active: true }
          }
        })
      });
    } catch (e) {
      console.error(e);
    }
    
    setManualDbName('');
    setManualDbUrl('');
    setManualDbToken('');
    appendLog(`Manually registered database "${cleanName}" in explorer and selected it.`, 'success');
  };

  const removeDatabaseFromPool = async (dbName: string) => {
    const updated = tursoDbs.filter(d => d.name !== dbName);
    saveDbs(updated);
    if (activeTursoDb?.name === dbName) {
      selectActiveDb(updated.length > 0 ? updated[0] : null);
    }

    // Sync removal on server
    try {
      await fetchGateway('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `manual-remove-${dbName}`,
          method: 'tools/call',
          params: {
            name: 'turso_remove_database_from_pool',
            arguments: { name: dbName }
          }
        })
      });
    } catch (e) {
      console.error(e);
    }

    appendLog(`Database "${dbName}" removed from your explorer pool.`, 'info');
  };

  // Real-time status indicators
  const [appStatus, setAppStatus] = useState<{
    appName: string;
    state: string;
    replicasRunning: number;
    replicasDesired: number;
    lastChecked: string;
    loading: boolean;
  }>({
    appName: 'amer',
    state: 'polling...',
    replicasRunning: 0,
    replicasDesired: 0,
    lastChecked: 'Never',
    loading: false
  });

  const fetchAppStatus = useCallback(async (appId = 'amer') => {
    setAppStatus(prev => ({ ...prev, loading: true }));
    try {
      const gigaCreds = activeAccount ? {
        giga_email: activeAccount.email,
        giga_api_key: activeAccount.gigalixir_api_key
      } : {};

      const payload = {
        jsonrpc: '2.0',
        id: `status-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: 'get_app',
          arguments: { app_name: appId, ...gigaCreds }
        }
      };

      const res = await fetchGateway('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();
      const contentText = data.result?.content?.[0]?.text;
      
      if (contentText) {
        const parsed = JSON.parse(contentText);
        // Note: checking return structure on either parsed or parsed.data
        const actualApp = parsed.data || parsed;
        
        // Let's also fetch running replicas if possible
        let runningCount = 0;
        try {
          const repRes = await fetchGateway('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: `rep-${Date.now()}`,
              method: 'tools/call',
              params: { name: 'get_replicas', arguments: { app_name: appId, ...gigaCreds } }
            })
          });
          const repData = await repRes.json();
          const repText = repData.result?.content?.[0]?.text;
          if (repText) {
            const parsedRep = JSON.parse(repText);
            runningCount = parsedRep.data?.replicas_running ?? parsedRep.replicas_running ?? 0;
          }
        } catch (e) {
          console.error("Failed to read replica counts:", e);
        }

        setAppStatus({
          appName: actualApp.unique_name || actualApp.name || appId,
          state: actualApp.state || 'ACTIVE',
          replicasRunning: runningCount,
          replicasDesired: actualApp.replicas ?? 0,
          lastChecked: new Date().toLocaleTimeString(),
          loading: false
        });
        
        appendLog(`Successfully synchronized status for application: ${appId}.`, 'success');
      } else {
        throw new Error("No tool content returned");
      }
    } catch (err: any) {
      setAppStatus(prev => ({ ...prev, state: 'OFFLINE_OR_UNAUTHORIZED', loading: false }));
      appendLog(`App state query warning: Unable to pull live data. Secrets may need configuring. (${err.message})`, 'error');
    }
  }, [appendLog, fetchGateway, activeAccount]);

  const fetchMcpMetadata = useCallback(async () => {
    try {
      const res = await fetchGateway('/');
      if (res.ok) {
        const data = await res.json();
        setMcpMetadata(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [fetchGateway]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMcpMetadata();
      fetchAppStatus('amer');
    }, 100);
    return () => clearTimeout(timer);
  }, [fetchMcpMetadata, fetchAppStatus, activeAccount]);

  const selectTool = (t: ToolDefinition) => {
    setSelectedTool(t);
    setToolArgs(t.defaultArgs);
  };

  const executeToolCall = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRunning(true);
    setRawResponse('');
    appendLog(`Invoking task: [${selectedTool.name}] ...`, 'input');

    try {
      const gigaCreds = (selectedTool.category === 'gigalixir' && activeAccount) ? {
        giga_email: activeAccount.email,
        giga_api_key: activeAccount.gigalixir_api_key
      } : {};

      const infiniCreds = (selectedTool.category === 'infinicloud' && activeInfinicloudAccount) ? {
        dav_url: activeInfinicloudAccount.dav_url,
        username: activeInfinicloudAccount.username,
        password: activeInfinicloudAccount.password
      } : {};

      const payload = {
        jsonrpc: '2.0',
        id: `call-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: selectedTool.name,
          arguments: { ...toolArgs, ...gigaCreds, ...infiniCreds }
        }
      };

      const res = await fetchGateway('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Server returned error status: ${res.status}`);
      }

      const data = await res.json();
      setRawResponse(JSON.stringify(data, null, 2));

      if (data.error) {
        appendLog(`[ERROR] ${data.error.message || 'RPC Error'}`, 'error');
      } else {
        const textResult = data.result?.content?.[0]?.text || '';
        appendLog(`Tool [${selectedTool.name}] call completed. Output received.`, 'success');
        
        // Scroll the terminal
        setTimeout(() => {
          const term = document.getElementById('terminal-view');
          if (term) term.scrollTop = term.scrollHeight;
        }, 80);

        // If we scaled the app or diagnosed/repaired, renew the core status indicators
        if (selectedTool.name === 'scale' || selectedTool.name === 'diagnose_and_repair_app' || selectedTool.name === 'set_config') {
          setTimeout(() => fetchAppStatus(toolArgs.app_name || 'amer'), 1000);
        }
      }
    } catch (err: any) {
      appendLog(`Execution interrupted: ${err.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const runQuickAction = async (action: 'diagnose' | 'scale1' | 'restart') => {
    setRunning(true);
    let toolName = 'diagnose_and_repair_app';
    let args: Record<string, any> = { app_name: 'amer' };

    if (action === 'diagnose') {
      appendLog(`Quick Action: Starting continuous self-healing diagnosis diagnostics on 'amer'...`, 'info');
      toolName = 'diagnose_and_repair_app';
    } else if (action === 'scale1') {
      appendLog(`Quick Action: Triggering container pool scale up to replicas=1...`, 'info');
      toolName = 'scale';
      args = { app_name: 'amer', replicas: 1 };
    } else if (action === 'restart') {
      appendLog(`Quick Action: Dispatching rolling pod restart request...`, 'info');
      toolName = 'restart';
    }

    try {
      const gigaCreds = activeAccount ? {
        giga_email: activeAccount.email,
        giga_api_key: activeAccount.gigalixir_api_key
      } : {};

      const payload = {
        jsonrpc: '2.0',
        id: `action-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: { ...args, ...gigaCreds }
        }
      };

      const res = await fetchGateway('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setRawResponse(JSON.stringify(data, null, 2));
      
      if (data.error) {
        appendLog(`[ACTION ERROR] ${data.error.message}`, 'error');
      } else {
        appendLog(`Quick Action [${toolName}] executed successfully.`, 'success');
        fetchAppStatus('amer');
      }
    } catch (e: any) {
      appendLog(`Action failure: ${e.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  // Human readable category tabs
  const categories = [
    { id: 'all', title: 'All Tools' },
    { id: 'gigalixir', title: 'Gigalixir' },
    { id: 'devops', title: 'Orchestrator' },
    { id: 'turso', title: 'Turso' },
    { id: 'github', title: 'GitHub' },
    { id: 'infinicloud', title: 'InfiniCLOUD' }
  ];
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredTools = activeCategory === 'all' 
    ? TOOLS_SCHEMA 
    : TOOLS_SCHEMA.filter(t => t.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#0d0f12] text-gray-200 font-sans antialiased selection:bg-cyan-500/20" id="main-admin-panel">
      {/* Background radial highlight */}
      <div className="absolute top-0 left-0 right-0 h-[450px] bg-gradient-to-b from-cyan-950/20 via-slate-950/0 pointer-events-none" />

      {/* Header Bar */}
      <header className="relative border-b border-gray-800 bg-[#0e1115]/90 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <CloudLightning className="h-4.5 w-4.5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              Gigalixir DevOps MCP Server
              <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                v{mcpMetadata?.version || '1.2.0'}
              </span>
            </h1>
            <p className="text-[11px] text-gray-400 font-mono">Next.js Microcontainer Management Plane</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-900 border border-gray-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-gray-400">STATUS:</span>
            <span className="text-emerald-400 font-medium font-mono">ONLINE</span>
          </div>
          <button 
            onClick={() => fetchAppStatus('amer')}
            className="flex items-center gap-1.5 hover:text-white text-gray-400 py-1.5 px-3 rounded-md hover:bg-gray-900 border border-transparent hover:border-gray-800 transition"
          >
            <RefreshCw className={`h-3 w-3 ${appStatus.loading ? 'animate-spin' : ''}`} />
            Refresh Control Plane
          </button>
        </div>
      </header>

      {/* MCP Gateway Connection Hub */}
      <div className="relative max-w-7xl mx-auto px-6 pt-6" id="mcp-gateway-hub">
        <div className="rounded-xl border border-cyan-800/20 bg-gradient-to-r from-cyan-950/25 to-slate-900/40 p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg shadow-cyan-950/10">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-cyan-400 shrink-0" />
            <div>
              <h3 className="text-xs font-semibold text-white tracking-tight">Active Gateway & Cloudflare Worker Router</h3>
              <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                Target: <span className="text-cyan-300 font-semibold">{workerUrl || "Local Next.js Node Proxy (Active)"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto max-w-md shrink-0">
            <input 
              type="text"
              placeholder="e.g. https://your-worker.workers.dev"
              value={workerUrl}
              onChange={(e) => updateWorkerUrl(e.target.value)}
              className="bg-gray-950 border border-gray-800 text-xs text-white rounded px-3 py-1.5 w-full md:w-64 placeholder-gray-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <button
              onClick={() => updateWorkerUrl('')}
              className="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-[10px] uppercase font-mono tracking-wider px-2.5 py-1.5 rounded shrink-0 transition"
              title="Reset to local Next.js proxy"
            >
              Reset
            </button>
            <button
              onClick={() => updateWorkerUrl('https://gigalixir-mcp1.ameremadapdelkalek.workers.dev/')}
              className="bg-cyan-900/30 hover:bg-cyan-800/40 border border-cyan-800/40 text-cyan-300 text-[10px] uppercase font-mono tracking-wider px-3 py-1.5 rounded shrink-0 transition font-semibold"
              title="Connect to the official Cloudflare Worker link"
            >
              Set Official Link
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Workspace */}
      <main className="relative max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: App Overview + Direct Telemetry Controls (5 Cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Diagnostic Widget */}
          <div className="rounded-xl border border-gray-800 bg-[#111419] p-5 relative overflow-hidden" id="app-status-box">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/20">
                  Target Application
                </span>
                <h2 className="text-lg font-bold text-white mt-1.5 tracking-tight font-mono">
                  amer.gigalixirapp.com
                </h2>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                appStatus.replicasRunning > 0 
                  ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/30' 
                  : 'bg-amber-950/50 text-amber-500 border-amber-800/30'
              }`}>
                {appStatus.replicasRunning > 0 ? 'ACTIVE' : 'IDLE / COLD'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-3 my-4 border-y border-gray-800/60 font-mono text-xs">
              <div>
                <span className="text-gray-400 block mb-0.5">Running Replicas:</span>
                <span className={`text-[17px] font-bold ${appStatus.replicasRunning > 0 ? 'text-emerald-400' : 'text-amber-500'}`}>
                  {appStatus.replicasRunning}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">Desired Replicas:</span>
                <span className="text-[17px] font-bold text-white">
                  {appStatus.replicasDesired}
                </span>
              </div>
            </div>

            {appStatus.replicasRunning === 0 && (
              <div className="mb-4 p-3 rounded bg-amber-950/30 border border-amber-800/20 flex gap-2 items-start text-[11px] leading-snug">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-amber-300">
                  <span className="font-semibold">Replica Pool Empty:</span> Deploy is completed, but active host processes are offline. You must scaled-up to at least 1 replica or launch diagnostics to restore app traffic!
                </div>
              </div>
            )}

            {/* Quick DevOps Healing Operations */}
            <div className="space-y-2 mt-4">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 font-semibold block mb-2">
                Devops Self-Healing Suite
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => runQuickAction('diagnose')}
                  disabled={running}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-xs py-2.5 px-3 rounded-lg transition disabled:opacity-50 cursor-pointer shadow-md shadow-cyan-500/5 hover:-translate-y-0.5 active:translate-y-0"
                  title="Run diagnose_and_repair_app tool"
                >
                  <Activity className="h-3.5 w-3.5" />
                  Self-Healing Scan
                </button>
                <button
                  onClick={() => runQuickAction('scale1')}
                  disabled={running || appStatus.replicasRunning > 0}
                  className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-medium text-xs py-2.5 px-3 rounded-lg border border-gray-700 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                  title="Scale up directly to 1 replica"
                >
                  <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                  Scale to 1 Rep
                </button>
              </div>
              <button
                onClick={() => runQuickAction('restart')}
                disabled={running}
                className="w-full flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-gray-850 text-gray-300 border border-gray-800 hover:border-gray-700 text-xs py-2 rounded-lg transition"
              >
                <RefreshCw className="h-3 w-3" />
                Trigger Rolling Restart
              </button>
            </div>
            
            <div className="text-[10px] text-gray-500 font-mono mt-3 flex items-center justify-between">
              <span>Host state: {appStatus.state}</span>
              <span>Updated: {appStatus.lastChecked}</span>
            </div>
          </div>

          {/* Gigalixir Accounts & API configurations Profiles manager */}
          <div className="rounded-xl border border-gray-800 bg-[#111419] p-5 relative overflow-hidden flex flex-col gap-4" id="gigalixir-profiles-manager">
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
              <div className="flex items-center gap-2">
                <CloudLightning className="h-4.5 w-4.5 text-cyan-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white font-mono">
                  Gigalixir API Multi-Accounts
                </h2>
              </div>
              <span className="text-[10px] font-mono font-normal px-2.5 py-0.5 rounded-full bg-[#0b0c0f] border border-gray-800 text-cyan-400">
                {gigalixirAccounts.length} {gigalixirAccounts.length === 1 ? 'Profile' : 'Profiles'}
              </span>
            </div>

            {/* Profile Selection List */}
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 font-semibold block mb-1">
                Active Credentials Profile
              </span>
              
              {/* Default Env option */}
              <div 
                onClick={() => selectGigalixirAccount('')}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                  activeAccountName === '' 
                    ? 'bg-cyan-950/20 border-cyan-800/40 text-cyan-200 shadow-sm' 
                    : 'bg-[#0e1115]/60 border-transparent text-gray-400 hover:bg-[#0e1115]/90 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${activeAccountName === '' ? 'bg-cyan-400 animate-pulse' : 'bg-gray-700'}`} />
                  <div className="font-mono text-left truncate">
                    <p className="font-semibold text-[11px] leading-tight">System Defaults</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Using environment variables</p>
                  </div>
                </div>
                <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-gray-900 text-gray-500 border border-gray-800/50">Default</span>
              </div>

              {/* Custom Accounts */}
              {gigalixirAccounts.map((acc) => (
                <div 
                  key={acc.name}
                  onClick={() => selectGigalixirAccount(acc.name)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between gap-2 ${
                    activeAccountName === acc.name 
                      ? 'bg-cyan-950/25 border-cyan-700/50 text-cyan-200 shadow-sm' 
                      : 'bg-[#0e1115]/60 border-transparent text-gray-400 hover:bg-[#0e1115]/90 hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${activeAccountName === acc.name ? 'bg-cyan-400 animate-pulse' : 'bg-gray-700'}`} />
                    <div className="font-mono text-left truncate">
                      <p className="font-semibold text-[11px] leading-tight text-white truncate max-w-[170px]">{acc.name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[170px]">{acc.email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGigalixirAccount(acc.name);
                    }}
                    className="p-1 rounded hover:bg-red-950/40 hover:text-red-400 text-gray-500 transition cursor-pointer shrink-0"
                    title="Remove Account Profile"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Register Account Form */}
            <div className="mt-2 border-t border-gray-800/85 pt-3.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 font-semibold block mb-2">
                Register New Credentials Profile
              </span>
              <div className="space-y-2">
                <input 
                  type="text" 
                  placeholder="Profile Name (e.g. Account-A, Primary)"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full bg-[#0b0c0f] border border-gray-800 focus:border-cyan-500 text-xs text-white rounded px-3 py-2 focus:outline-none font-mono placeholder-gray-600 transition"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input 
                    type="email" 
                    placeholder="Account Email"
                    value={newAccEmail}
                    onChange={(e) => setNewAccEmail(e.target.value)}
                    className="w-full bg-[#0b0c0f] border border-gray-800 focus:border-cyan-500 text-xs text-white rounded px-3 py-2 focus:outline-none font-mono placeholder-gray-600 transition"
                  />
                  <input 
                    type="password" 
                    placeholder="Gigalixir API Key"
                    value={newAccApiKey}
                    onChange={(e) => setNewAccApiKey(e.target.value)}
                    className="w-full bg-[#0b0c0f] border border-gray-800 focus:border-cyan-500 text-xs text-white rounded px-3 py-2 focus:outline-none font-mono placeholder-gray-600 transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => addGigalixirAccount(newAccName, newAccEmail, newAccApiKey)}
                  className="w-full flex items-center justify-center gap-1.5 bg-cyan-950/30 hover:bg-cyan-900/40 border border-cyan-800/40 hover:border-cyan-700/50 text-cyan-300 text-xs py-2 rounded-lg transition font-medium cursor-pointer shadow-md shadow-cyan-950/20"
                >
                  <Plus className="h-3.5 w-3.5 text-cyan-400" />
                  Add API Configuration Profile
                </button>
              </div>
            </div>
          </div>

          {/* InfiniCLOUD WebDAV Profiles Manager */}
          <div className="rounded-xl border border-gray-800 bg-[#111419] p-5 relative overflow-hidden flex flex-col gap-4" id="infinicloud-profiles-manager">
            <div className="flex items-center justify-between border-b border-gray-850 pb-3">
              <div className="flex items-center gap-2 flex-nowrap">
                <CloudLightning className="h-4.5 w-4.5 text-indigo-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white font-mono">
                  InfiniCLOUD WebDAV Profiles
                </h2>
              </div>
              <span className="text-[10px] font-mono font-normal px-2.5 py-0.5 rounded-full bg-[#0b0c0f] border border-gray-805 text-indigo-400">
                {infinicloudAccounts.length} {infinicloudAccounts.length === 1 ? 'Profile' : 'Profiles'}
              </span>
            </div>

            {/* Profile Selection List */}
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 font-semibold block mb-1">
                Active WebDAV Profile
              </span>
              
              {/* Default Env option */}
              <div 
                onClick={() => selectInfinicloudAccount('')}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                  activeInfinicloudAccountName === '' 
                    ? 'bg-indigo-950/20 border-indigo-800/40 text-indigo-200 shadow-sm' 
                    : 'bg-[#0e1115]/60 border-transparent text-gray-400 hover:bg-[#0e1115]/90 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${activeInfinicloudAccountName === '' ? 'bg-indigo-400 animate-pulse' : 'bg-gray-700'}`} />
                  <div className="font-mono text-left truncate">
                    <p className="font-semibold text-[11px] leading-tight flex items-center gap-1.5">System Defaults</p>
                    <p className="text-[10px] text-gray-400 opacity-60 mt-0.5">Using environment variables</p>
                  </div>
                </div>
                <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-gray-900 text-gray-500 border border-gray-800/50">Default</span>
              </div>

              {/* Custom Accounts */}
              {infinicloudAccounts.map((acc) => (
                <div 
                  key={acc.name}
                  onClick={() => selectInfinicloudAccount(acc.name)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between gap-2 ${
                    activeInfinicloudAccountName === acc.name 
                      ? 'bg-indigo-950/25 border-indigo-700/50 text-indigo-200 shadow-sm' 
                      : 'bg-[#0e1115]/60 border-transparent text-gray-400 hover:bg-[#0e1115]/90 hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${activeInfinicloudAccountName === acc.name ? 'bg-indigo-400 animate-pulse' : 'bg-gray-700'}`} />
                    <div className="font-mono text-left truncate">
                      <p className="font-semibold text-[11px] leading-tight text-white truncate max-w-[170px]">{acc.name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[170px]">{acc.username}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeInfinicloudAccount(acc.name);
                    }}
                    className="p-1 rounded hover:bg-red-950/40 hover:text-red-400 text-gray-500 transition cursor-pointer shrink-0"
                    title="Remove Profile"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Register Profile Form */}
            <div className="mt-2 border-t border-gray-800/85 pt-3.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 font-semibold block mb-2">
                Register New WebDAV Profile
              </span>
              <div className="space-y-2 font-sans">
                <input 
                  type="text" 
                  placeholder="Profile Name (e.g. Backups, Storage-N1)"
                  value={newCloudName}
                  onChange={(e) => setNewCloudName(e.target.value)}
                  className="w-full bg-[#0b0c0f] border border-gray-800 focus:border-indigo-500 text-xs text-white rounded px-3 py-2 focus:outline-none font-mono placeholder-gray-600 transition"
                />
                <input 
                  type="text" 
                  placeholder="WebDAV Connection URL (https://...)"
                  value={newCloudUrl}
                  onChange={(e) => setNewCloudUrl(e.target.value)}
                  className="w-full bg-[#0b0c0f] border border-gray-800 focus:border-indigo-500 text-xs text-white rounded px-3 py-2 focus:outline-none font-mono placeholder-gray-600 transition"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder="Username / WebDAV ID"
                    value={newCloudUser}
                    onChange={(e) => setNewCloudUser(e.target.value)}
                    className="w-full bg-[#0b0c0f] border border-gray-800 focus:border-indigo-500 text-xs text-white rounded px-3 py-2 focus:outline-none font-mono placeholder-gray-600 transition"
                  />
                  <input 
                    type="password" 
                    placeholder="Apps Password"
                    value={newCloudPass}
                    onChange={(e) => setNewCloudPass(e.target.value)}
                    className="w-full bg-[#0b0c0f] border border-gray-800 focus:border-indigo-500 text-xs text-white rounded px-3 py-2 focus:outline-none font-mono placeholder-gray-600 transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => addInfinicloudAccount(newCloudName, newCloudUrl, newCloudUser, newCloudPass)}
                  className="w-full flex items-center justify-center gap-1.5 bg-indigo-950/30 hover:bg-indigo-900/40 border border-indigo-800/40 hover:border-indigo-700/50 text-indigo-300 text-xs py-2 rounded-lg transition font-medium cursor-pointer shadow-md shadow-indigo-950/20"
                >
                  <Plus className="h-3.5 w-3.5 text-indigo-400" />
                  Add WebDAV Configuration Profile
                </button>
              </div>
            </div>
          </div>

          {/* DevOps Logs Terminal (Left Bottom) */}
          <div className="rounded-xl border border-gray-800 bg-[#0b0c0f] flex flex-col h-[350px] shadow-2xl relative">
            <div className="px-4 py-2.5 bg-[#0e1014] border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono">
                <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-gray-300">Live Orchestration Audit</span>
              </div>
              <button 
                onClick={() => setConsoleLogs([{ time: new Date().toLocaleTimeString(), text: 'Log stream cleared.', type: 'info' }])}
                className="text-[10px] hover:text-white text-gray-500 font-mono"
              >
                Clear
              </button>
            </div>

            <div 
              id="terminal-view"
              className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-2 select-text"
            >
              {consoleLogs.map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-gray-500 shrink-0 select-none">[{log.time}]</span>
                  <span className={
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-emerald-400' :
                    log.type === 'input' ? 'text-cyan-400 font-semibold' :
                    'text-gray-300'
                  }>
                    {log.type === 'input' && <span className="text-cyan-500 select-none mr-1">&gt;</span>}
                    {log.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Tool Sandbox & Schema Executor (7 Cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6" id="mcp-interactive-area">
          
          {/* Categories Tab selector */}
          <div className="p-1 rounded-lg bg-gray-900 border border-gray-800/80 flex gap-1 text-xs">
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`flex-1 text-center py-2 px-1 rounded-md font-mono cursor-pointer transition ${
                  activeCategory === c.id 
                    ? 'bg-gray-800 text-cyan-400 border border-gray-700/60 font-semibold' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>

          {activeCategory === 'turso' ? (
            <div className="flex flex-col gap-6" id="turso-cluster-manager">
              
              {/* Top Selector: Active Database Switcher & Config */}
              <div className="rounded-xl border border-gray-800 bg-[#111419] p-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-gray-800/60 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-cyan-400" />
                      <h2 className="text-base font-bold text-white tracking-tight">Turso Cluster Pool</h2>
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">Manage and query independent test databases side-by-side</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={syncDatabasesFromTurso}
                      disabled={running || !tursoPlatformToken}
                      className="px-3 py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/60 text-cyan-400 font-mono text-[11px] flex items-center gap-1.5 transition disabled:opacity-40"
                    >
                      <RefreshCw className={`h-3 w-3 ${running ? 'animate-spin' : ''}`} />
                      Cloud Sync Accounts
                    </button>
                  </div>
                </div>

                {/* Databases Pool List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {tursoDbs.map((db) => {
                    const isActive = activeTursoDb?.name === db.name;
                    return (
                      <div 
                        key={db.name}
                        className={`p-3.5 rounded-xl border transition ${
                          isActive 
                            ? 'bg-slate-900/40 border-cyan-500/50 ring-1 ring-cyan-500/20' 
                            : 'bg-gray-950/40 border-gray-800/80 hover:border-gray-700/80'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <button 
                            onClick={() => selectActiveDb(db)}
                            className="text-left font-mono cursor-pointer flex-1"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-cyan-400 animate-pulse' : 'bg-gray-600'}`} />
                              <span className="text-xs font-bold text-slate-100">{db.name.toUpperCase()}</span>
                              {isActive && (
                                <span className="text-[9px] bg-cyan-950 text-cyan-400 px-1.5 py-0.2 rounded font-semibold border border-cyan-800/35">
                                  ACTIVE TARGET
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 block truncate mt-1">
                              {db.url || 'No connection link'}
                            </span>
                          </button>

                          <div className="flex items-center">
                            <button
                              onClick={() => fetchDbUsageStats(db.name)}
                              disabled={dbStats[db.name]?.loading}
                              className={`text-gray-500 hover:text-cyan-400 p-1 rounded hover:bg-gray-900 transition mt-[-4px] mr-1 ${dbStats[db.name]?.loading ? 'animate-spin text-cyan-400' : ''}`}
                              title="Query database usage (reads/writes)"
                            >
                              <BarChart2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => removeDatabaseFromPool(db.name)}
                              className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-gray-900 transition mt-[-4px]"
                              title="Remove from pool"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Usage Statistics Block */}
                        {dbStats[db.name] && (
                          <div className="mt-2 p-2 rounded bg-slate-950/60 border border-slate-900/80 grid grid-cols-3 gap-1 text-[10px] font-mono text-gray-400">
                            <div>
                              <div className="text-[9px] uppercase tracking-wider text-gray-500">Writes</div>
                              <div className="text-amber-400 font-bold text-xs">{dbStats[db.name].rows_written.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase tracking-wider text-gray-500">Reads</div>
                              <div className="text-cyan-400 font-bold text-xs">{dbStats[db.name].rows_read.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase tracking-wider text-gray-500">Storage</div>
                              <div className="text-slate-300 font-bold text-xs">{(dbStats[db.name].storage_bytes_used / 1024).toFixed(1)} KB</div>
                            </div>
                          </div>
                        )}

                        {/* Connection Credentials editor/displayer */}
                        <div className="mt-2 text-[10px] bg-gray-950/50 p-1.5 rounded border border-gray-900 flex items-center justify-between font-mono">
                          <span className="text-gray-500">Auth Token:</span>
                          <input 
                            type="password"
                            placeholder="Optional authentication token"
                            value={db.token || ''}
                            onChange={(e) => {
                              const updated = tursoDbs.map(d => d.name === db.name ? { ...d, token: e.target.value } : d);
                              saveDbs(updated);
                              if (isActive) {
                                setActiveTursoDb({ ...db, token: e.target.value });
                              }
                            }}
                            className="bg-transparent border-none text-right font-sans text-[10px] text-gray-300 focus:outline-none flex-1 max-w-[130px]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Cloud & Manual Registers side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-800/40 pt-4 mt-2">
                  
                  {/* Form: Spawn New Cloud Database on Turso */}
                  <form onSubmit={createNewTursoDatabase} className="space-y-3 p-3 rounded-lg bg-gray-950/25 border border-gray-900">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-400/80 font-bold block">
                      Programmed DB Spawner
                    </span>
                    <p className="text-[11px] text-gray-400 font-mono leading-tight">
                      Deploy and provision a new instance inside your Turso cloud:
                    </p>
                    <div className="flex gap-2 font-mono">
                      <input 
                        type="text"
                        placeholder="new-database-name"
                        value={newDbName}
                        onChange={(e) => setNewDbName(e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={running || !newDbName.trim()}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-3 py-1.5 rounded transition disabled:opacity-40"
                      >
                        Deploy
                      </button>
                    </div>
                  </form>

                  {/* Form: Register Existing Link Manually */}
                  <form onSubmit={registerManualDatabase} className="space-y-2 p-3 rounded-lg bg-gray-950/25 border border-gray-900 font-mono">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 font-bold block">
                      Register Database Manually
                    </span>
                    <input 
                      type="text"
                      placeholder="Custom label (e.g. testing)"
                      value={manualDbName}
                      onChange={(e) => setManualDbName(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded px-2.5 py-1 text-[11px] text-white focus:outline-none block"
                    />
                    <div className="flex gap-1.5">
                      <input 
                        type="text"
                        placeholder="libsql://... (connection link)"
                        value={manualDbUrl}
                        onChange={(e) => setManualDbUrl(e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-800 rounded px-2.5 py-1 text-[11px] text-white focus:outline-none"
                      />
                      <input 
                        type="password"
                        placeholder="Auth Token"
                        value={manualDbToken}
                        onChange={(e) => setManualDbToken(e.target.value)}
                        className="max-w-[80px] bg-gray-900 border border-gray-800 rounded px-2.5 py-1 text-[11px] text-white focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!manualDbName.trim() || !manualDbUrl.trim()}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded px-2.5 py-1 text-[11px] font-semibold transition"
                      >
                        Add
                      </button>
                    </div>
                  </form>

                </div>

                {/* Turso Cloud Account Platform Settings Credentials collapsible */}
                <div className="mt-4 border-t border-gray-800/40 pt-3 relative overflow-hidden text-xs">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 font-semibold block mb-2">
                    🔑 Turso Cloud Account Configuration / Credentials
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 font-mono">
                      <label className="text-[9px] text-gray-500 uppercase">Organization Name / User Name</label>
                      <input 
                        type="text"
                        value={tursoPlatformOrg}
                        onChange={(e) => {
                          setTursoPlatformOrg(e.target.value);
                          localStorage.setItem('turso_platform_org', e.target.value);
                        }}
                        placeholder="default is amer"
                        className="bg-gray-950/60 border border-gray-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1 font-mono">
                      <label className="text-[9px] text-gray-500 uppercase">Turso Platform API Access token</label>
                      <input 
                        type="password"
                        value={tursoPlatformToken}
                        onChange={(e) => {
                          setTursoPlatformToken(e.target.value);
                          localStorage.setItem('turso_platform_token', e.target.value);
                        }}
                        placeholder="Click to insert your Turso CLI token"
                        className="bg-gray-950/60 border border-gray-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Dynamic SQL Workspace Console */}
              <div className="rounded-xl border border-gray-800 bg-[#111419] p-5">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-800/60 font-mono">
                  <div>
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4.5 w-4.5 text-cyan-400" />
                      <h2 className="text-sm font-bold text-white tracking-tight">
                        SQL Studio — {activeTursoDb ? activeTursoDb.name.toUpperCase() : 'NO SELECTED GAME'}
                      </h2>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">Write raw SQL or inspect specific schemas</p>
                  </div>

                  {/* Table selector/Dropdown loaded dynamically */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-gray-400 font-semibold uppercase text-[9px] font-mono">Tables:</span>
                    {tableDataLoading ? (
                      <span className="text-gray-500 animate-pulse text-[11px]">Loading...</span>
                    ) : (
                      <select
                        value={activeTable}
                        onChange={(e) => {
                          setActiveTable(e.target.value);
                          viewTableDetails(e.target.value);
                        }}
                        className="bg-gray-950/80 text-gray-300 border border-gray-800 rounded py-1 px-2.5 text-[11px] focus:outline-none cursor-pointer hover:border-gray-700"
                      >
                        <option value="">-- No Tables / Select --</option>
                        {tables.map(t => (
                          <option key={t} value={t}>📊 {t}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* SQL query execution console editor */}
                <div className="relative rounded-lg overflow-hidden border border-gray-800/80 bg-gray-950 mb-3 font-mono">
                  <div className="px-3.5 py-1.5 bg-[#0a0c0e]/80 text-[10px] text-gray-500 border-b border-gray-900 flex justify-between items-center select-none">
                    <span>{activeTursoDb?.url || 'libsql://unselected-db'}</span>
                    <span>SQLite Dialect READY</span>
                  </div>
                  <textarea
                    rows={4}
                    value={sqlInput}
                    onChange={(e) => setSqlInput(e.target.value)}
                    className="w-full bg-[#0d0f12] text-slate-100 p-3.5 text-xs font-mono focus:outline-none resize-y leading-relaxed select-text min-h-[90px]"
                    placeholder="e.g. SELECT * FROM test_users;"
                  />
                  <div className="border-t border-gray-950 bg-[#0d0f12]/50 p-2 flex gap-2 justify-end">
                    <button
                      onClick={() => runCustomSql(false)}
                      disabled={sqlRunning || !activeTursoDb}
                      className="bg-gray-950 hover:bg-gray-900 text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition disabled:opacity-40"
                    >
                      Run State-Change Statement (Write / Create)
                    </button>
                    <button
                      onClick={() => runCustomSql(true)}
                      disabled={sqlRunning || !activeTursoDb}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white px-4.5 py-1.5 rounded-lg text-[11px] font-semibold transition disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Execute Query (SELECT)
                    </button>
                  </div>
                </div>

                {/* Database Table Output Grid (Interactive Supabase style view) */}
                <div className="bg-gray-950 rounded-xl border border-gray-800 p-4 min-h-[220px] flex flex-col font-mono relative">
                  <h3 className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider mb-2 select-none">
                    Resulting Records / Data Outputs
                  </h3>
                  
                  {sqlRunning ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 animate-pulse py-8">
                      <RefreshCw className="h-5 w-5 animate-spin mb-1 text-cyan-500" />
                      <span className="text-[10px]">Processing SQL pipeline statements...</span>
                    </div>
                  ) : sqlResult ? (
                    sqlResult.error ? (
                      <div className="p-3 bg-red-950/20 border border-red-800/30 rounded text-red-400 text-xs">
                        <span className="font-bold block mb-1">SQL Execution Failure:</span>
                        {sqlResult.error}
                      </div>
                    ) : sqlResult.rows?.length > 0 ? (
                      <div className="overflow-x-auto w-full max-h-[280px]">
                        <table className="w-full text-left text-xs text-gray-300 border-collapse table-auto select-text">
                          <thead className="text-[10px] uppercase text-gray-500 bg-gray-900 border-b border-gray-800 sticky top-0">
                            <tr>
                              {Object.keys(sqlResult.rows[0]).map((key) => (
                                <th key={key} className="px-3 py-2 border-r border-gray-850 font-semibold">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-850">
                            {sqlResult.rows.map((row: any, i: number) => (
                              <tr key={i} className="hover:bg-slate-900/40">
                                {Object.values(row).map((val: any, j: number) => (
                                  <td key={j} className="px-3 py-1.5 border-r border-gray-850 whitespace-nowrap text-gray-300 text-[11px]">
                                    {val === null ? <span className="text-gray-600 font-semibold text-[10px]">NULL</span> : String(val)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-600 py-8 text-center bg-gray-950/40 border border-dashed border-gray-900 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 mb-1.5 text-emerald-500" />
                        <span className="text-xs text-slate-300">Statement completed successfully.</span>
                        <span className="text-[10px] text-gray-500 mt-1">Returned: {sqlResult.rowsAffected ?? 0} rows affected.</span>
                      </div>
                    )
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-600 font-mono text-[11px] py-14">
                      <BookOpen className="h-5 w-5 mb-1.5" />
                      <span>Execute a SQL query, click a table, or select columns above to render records here</span>
                    </div>
                  )}
                </div>

              </div>

            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 bg-[#111419] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Cpu className="h-4.5 w-4.5 text-cyan-400" />
                <h2 className="text-sm font-bold text-white tracking-tight">Active MCP Tool Executor</h2>
              </div>

              {/* Tool grid selector under selected tab */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                {filteredTools.map(t => (
                  <button
                    key={t.name}
                    onClick={() => selectTool(t)}
                    className={`text-left p-2 rounded-lg border text-[11px] transition cursor-pointer flex flex-col justify-between h-16 ${
                      selectedTool.name === t.name
                        ? 'bg-slate-800 border-cyan-500/50 text-white ring-1 ring-cyan-500/10'
                        : 'bg-gray-900/50 border-gray-800/80 hover:border-gray-700 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <span className="font-semibold block truncate text-xs text-slate-100 font-mono">{t.name}</span>
                    <span className="text-[10px] text-gray-400 capitalize block truncate mt-1">🏷️ {t.category}</span>
                  </button>
                ))}
              </div>

              {/* Chosen Tool Parameters Form */}
              <div className="bg-gray-950/60 rounded-xl p-5 border border-gray-800/50">
                <div className="mb-4">
                  <span className="text-[11px] font-mono text-cyan-400">{selectedTool.category.toUpperCase()} TOOL</span>
                  <h3 className="text-sm font-semibold text-white font-mono mt-0.5">{selectedTool.name}</h3>
                  <p className="text-[11px] text-gray-400 mt-1 leading-snug">{selectedTool.description}</p>
                </div>

                <form onSubmit={executeToolCall} className="space-y-4">
                  {selectedTool.fields.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {selectedTool.fields.map(field => (
                        <div key={field.name} className="flex flex-col gap-1.5 font-mono">
                          <label className="text-[10px] uppercase font-semibold text-gray-400">
                            {field.name} {field.required && <span className="text-red-400">*</span>}
                          </label>
                          <input
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={toolArgs[field.name] ?? ''}
                            onChange={(e) => {
                              const val = field.type === 'number' ? Number(e.target.value) : e.target.value;
                              setToolArgs(prev => ({ ...prev, [field.name]: val }));
                            }}
                            className="bg-[#111419] border border-gray-800 rounded-lg py-2 px-3 text-xs text-white focus:border-cyan-500 focus:outline-none transition font-sans"
                            placeholder={field.description}
                            required={field.required}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-gray-500 font-mono bg-[#111419]/40 rounded border border-dashed border-gray-800">
                      No arguments required for this tool
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={running}
                      className="flex-1 bg-[#1c7ed6] hover:bg-[#1971c2] text-white py-2.5 px-4 rounded-lg text-xs font-semibold tracking-tight transition disabled:opacity-50 cursor-pointer text-center font-sans flex items-center justify-center gap-2"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Run {selectedTool.name}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Core Response JSON Board */}
          <div className="rounded-xl border border-gray-800 bg-[#111419] p-5 flex flex-col">
            <h3 className="text-xs font-bold font-mono text-gray-300 uppercase tracking-wider mb-3">
              Formatted Response Payload
            </h3>
            <div className="bg-gray-950 rounded-lg p-4 font-mono text-[11px] text-gray-300 overflow-x-auto h-[250px] relative border border-gray-800 select-text">
              {rawResponse ? (
                <pre className="whitespace-pre-wrap">{rawResponse}</pre>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                  <BookOpen className="h-6 w-6 mb-2" />
                  <span>Execute a tool to see raw response output here</span>
                </div>
              )}
            </div>
          </div>

        </section>
      </main>

      {/* Deployment & Workflow Info Alert */}
      <footer className="max-w-7xl mx-auto px-6 pb-12">
        <div className="bg-[#111419]/50 border border-gray-800/80 rounded-xl p-5 text-xs text-gray-400 font-mono space-y-3 leading-relaxed">
          <h4 className="font-semibold text-white flex items-center gap-2">
            <Info className="h-4 w-4 text-cyan-400 shrink-0" />
            CI/CD & Deployment State Architecture Verified
          </h4>
          <p>
            Your patch for <strong>NODE_MODULES_CACHE: false</strong> has been successfully committed inside `.github/workflows/gigalixir-deploy.yml`. 
            This resolves index corruption inside Heroku node_modules buildpack cache, triggering pristine native compilation on every push.
          </p>
          <div className="flex flex-wrap gap-4 pt-1 text-gray-500">
            <span>🔹 Route Handlers: Exposing JSON-RPC 2.0 endpoint at root <code>/</code> and <code>/mcp</code></span>
            <span>🔹 Worker Resolution: Solved relative import <code>../src/worker</code> directly</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
