# Gigalixir & Turso & GitHub MCP Server

A ultra high-performance, multi-service **Model Context Protocol (MCP)** server built for deployment to **Cloudflare Workers** (or run as an ESM module anywhere). It includes pre-integrated support for managing Gigalixir apps, querying or executing transactions on Turso databases, and managing GitHub repositories, branches, actions, files, pull requests, and issues.

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
* **`GITHUB_TOKEN`** — A GitHub Personal Access Token (`classic` or `Fine-grained`) with access to your repositories and pull requests.

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
npx wrangler secret put GITHUB_TOKEN

# Deploy directly to Cloudflare edge edge network!
npx wrangler deploy
```

---

## 🛠️ Integrated MCP Tools Breakdown

### 🔴 Gigalixir Management Tools
* `list_apps` — Lists all Gigalixir apps in your account.
* `get_app` — Gets details of a specific app.
* `get_configs` & `set_config` & `delete_config` — Retrieve, set, or delete environmental configs safely (with resilient backoff to support both singular and plural endpoint variants).
* `get_replicas` & `scale` — Read or scale your instance deployment replicas (scaling to 0 shuts down the instance).
* `list_releases` & `rollback` — Read release versions or rollback instantly.
* `restart` — Gracefully cycles app processes through standard sequence.
* `get_logs` — High-performance chunk-streaming log reader capped to a hard 3-second limit to guarantee zero MCP gateway timeouts.

### 🔵 Turso Database Tools
* `turso_query` — Execute read-only SQL SELECT queries with secure parameter parsing.
* `turso_execute` — Execute state-changing SQL operations (INSERT, UPDATE, DELETE, CREATE, DROP).
* `turso_list_tables` — List database master tables instantly.
* `turso_describe_table` — Query columns, schema metadata, types, constraints, and indexes.
* `turso_transaction` — Run multi-statement database transactions with integrated auto-rollback safety handlers if any query fails.

### 🟢 GitHub Workspace Tools
* `github_list_repos` & `github_get_repo` — Query user repository definitions and specs.
* `github_create_repo` — Create a new GitHub repository.
* `github_list_files` & `github_get_file` — Recurse, tree-walk, or read raw contents.
* `github_create_file` & `github_update_file` & `github_delete_file` — Create, update, or delete files securely with auto-resolved folder tree SHAs.
* `github_create_pr` — Generate pull requests between head and base branch tracks.

---

## 🛡️ Production-Grade AI DevOps & Safety Controls (New)

The MCP server incorporates advanced guardrails, observability, and orchestration layers to transition from a collection of raw tools to a safe, self-healing **AI DevOps Agent** system:

### ⚙️ 1. Safety Guardrails & Access Rules
All state-changing operations are monitored by a local guardrail layer. Accidental or destructive acts are blocked unless explicit permission bypass is granted:
* **Outage Prevention**: Scaling active deployment replicas pool size to `0` is blocked by default.
* **Secret Deletion Protection**: Deleting configurations containing database strings, credentials, tokens, URLs, or security secrets is locked.
* **Database Guardrails**: Destructive SQL commands (e.g., `DROP TABLE`, `TRUNCATE`) are blocked on custom executes.
* **Version Control Lock**: Accidentally deleting core files from git via `github_delete_file` is locked.
* **How to Bypass**: If you explicitly intend to execute a locked operation, pass the parameter `"bypass_safety": true` in the tool call.

### 🧪 2. Universal Dry-Run Simulator
Before executing any state-altering operations (scaling, deleting configs, commits, rollbacks, SQL mutations), pass `"dry_run": true` to preview the actions. The tool will return a detailed simulation explanation and log the trace without changing any remote resources.

### 📊 3. Real-Time Observability & Auditing
* `audit_traces_list` — Retrieve real-time tracking logs of all executed actions, including timestamps, durations, statuses, targets, parameters (with sanitised pay-loads), and errors. Perfect for auditing AI operator behaviors.
* `get_system_safety_policies` — Standard endpoint to query current safety postures, rule sets, limits, and dry-run instructions.

### 🚂 4. Core Orchestration Pipelines & Workflows
* `orchestrate_deploy_pipeline` — Performs complete end-to-end git-to-cloud deployments (verifies packages on GitHub, sets Gigalixir environments, triggers rolling restarts, and parses container health logs).
* `diagnose_and_repair_app` — Scans application runtimes, scales, and retrieves trailing log traces; detects crash loops or replicas drifts, and triggers self-healing cycles (e.g., scale recovery, graceful process recycles).

