# Gigalixir & Turso & InfiniCLOUD WebDAV MCP Server

A ultra high-performance, streamlined, multi-service **Model Context Protocol (MCP)** server built for deployment to **Cloudflare Workers** (or run as an ESM module anywhere). It includes pre-integrated support for managing Gigalixir apps, querying or executing transactions on Turso databases, and managing personal cloud storage on InfiniCLOUD WebDAV.

All redundant GitHub tools have been fully removed to provide a highly optimized context size, maximum reliability, and a clean interface for integrating with AI clients (e.g. Claude, Cursor, ChatGPT).

---

## 🔒 CREDENTIALS SENSITIVE NOTICE (FOR CALLING AI OPERATORS)
If you are an AI client utilizing this MCP server through tool calls:
**You DO NOT need to look up, request, or pass any email credentials, API keys, database tokens, or secrets** (such as `giga_email`, `giga_api_key`, `db_token`, etc.) in your tool arguments. 

The hosting backend is **already pre-configured** with all required platform secrets (Gigalixir accounts, Turso DB headers, personal InfiniCLOUD WebDAV passwords) bound securely server-side. Simply specify your resource-oriented parameters (like `app_name`, `sql`, `path`, etc.) and the backend automatically handles authorization.

---

## 📦 The 5 Essential Files to Push to GitHub

To deploy this MCP server to Cloudflare Workers, you only need to push the following **5 files** to your GitHub repository:

1. 📄 **`src/worker.js`** — The unified single-file MCP core handler containing security checks, tool registry, pipeline executors, and normalized gateways.
2. 📄 **`wrangler.toml`** — Cloudflare Workers configuration file declaring compatibility flags and custom environment variables.
3. 📄 **`package.json`** — Dependency definitions and standard wrangler control scripts (`npm run build`, `npm run deploy`).
4. 📄 **`README.md`** — This documentation file explaining usage and setup instructions.
5. 📄 **`.gitignore`** — Basic configuration to prevent pushing sensitive files, `.wrangler/` builds, or `node_modules`.

---

## 🚀 Setting Up & Deploying to Cloudflare Workers

### 1. Configure Secrets & Environment Variables

Make sure to prepare the following credentials (stored as Cloudflare Worker Secrets):

* **`GIGALIXIR_EMAIL`** — Your registered Gigalixir account email.
* **`GIGALIXIR_API_KEY`** — Your Gigalixir API Key (retrieved from Gigalixir CLI using `gigalixir api_key:show`).
* **`TURSO_DB_URL`** — The URL of your Turso database (e.g. `libsql://yourdb-slug.turso.io`).
* **`TURSO_AUTH_TOKEN`** — Your Turso database authorization bearer token.
* **`INFINICLOUD_USERNAME`** — Your InfiniCLOUD WebDAV storage username.
* **`INFINICLOUD_PASSWORD`** — Your InfiniCLOUD WebDAV storage application password.
* **`INFINICLOUD_DAV_URL`** — The WebDAV endpoint for your InfiniCLOUD partition.

### 2. Install & Deploy

Clone your GitHub repository and build:

```bash
# Install dependencies
npm install

# Log in to Cloudflare
npx wrangler login

# Set environment secrets securely on Cloudflare
npx wrangler secret put GIGALIXIR_EMAIL
npx wrangler secret put GIGALIXIR_API_KEY
npx wrangler secret put TURSO_DB_URL
npx wrangler secret put TURSO_AUTH_TOKEN
npx wrangler secret put INFINICLOUD_USERNAME
npx wrangler secret put INFINICLOUD_PASSWORD
npx wrangler secret put INFINICLOUD_DAV_URL

# Deploy directly to Cloudflare edge network!
npm run deploy
```

---

## 🛠️ Integrated MCP Tools Breakdown

### 🔴 Gigalixir Management Tools (13 Tools)
* `list_apps` — Lists all Gigalixir apps in your account.
* `auto_detect_app` — Programmatically identifies the active workspace application.
* `get_app` — Gets details and status of a specific app.
* `get_configs` & `set_config` & `delete_config` — Retrieve, set, or delete environmental configs safely.
* `get_replicas` & `scale` — Read or scale your instance deployment replicas.
* `list_releases` & `rollback` — Read release versions or rollback instantly.
* `restart` — Gracefully cycles app processes through standard sequence.
* `get_logs` — High-performance chunk-streaming log reader capped to a hard limit to guarantee zero MCP gateway timeouts.

### 🔵 Turso Database Tools (14 Tools)
* `turso_query` — Execute read-only SQL SELECT queries with secure parameter parsing.
* `turso_execute` — Execute state-changing SQL operations (INSERT, UPDATE, DELETE, CREATE, DROP).
* `turso_list_tables` — List database master tables instantly.
* `turso_describe_table` — Query columns, schema metadata, types, constraints, and indexes.
* `turso_transaction` — Run multi-statement database transactions with integrated auto-rollback safety handlers if any query fails.
* `turso_get_database_pool` & `turso_add_database_to_pool` — Manage external database connections pool dynamically.

### 🟡 InfiniCLOUD WebDAV Tools (5 Tools)
* `infinicloud_list_files` — List directory partitions via WebDAV PROPFIND protocols.
* `infinicloud_get_file` — Retrieve raw contents of individual configuration file backups.
* `infinicloud_create_file` & `infinicloud_create_directory` — Upload files or create directory scopes.
* `infinicloud_delete_file` — Securely erase designated files or paths.

---

## 🛡️ Production-Grade AI DevOps & Safety Controls

The MCP server incorporates advanced guardrails, observability, and orchestration layers:

### ⚙️ 1. Safety Guardrails & Access Rules
All state-changing operations are monitored by a local guardrail layer. Accidental or destructive acts are blocked unless explicit permission bypass is granted:
* **Outage Prevention**: Scaling active deployment replicas pool size to `0` is blocked by default.
* **Secret Deletion Protection**: Deleting configurations containing database strings, credentials, tokens, URLs, or security secrets is locked.
* **Database Guardrails**: Destructive SQL commands (e.g., `DROP TABLE`) are blocked by default.
* **How to Bypass**: If you explicitly intend to execute a locked operation, pass the parameter `"bypass_safety": true` in the tool call.

### 🧪 2. Universal Dry-Run Simulator
Before executing any state-altering operations (scaling, deleting configs, SQL mutations), pass `"dry_run": true` to preview the actions.

### 📊 3. Real-Time Observability & Auditing
* `audit_traces_list` — Retrieve real-time tracking logs of all executed actions, including timestamps, durations, statuses, targets, parameters, and errors.
* `get_system_safety_policies` — Standard endpoint to query current safety postures, rule sets, limits, and dry-run instructions.
