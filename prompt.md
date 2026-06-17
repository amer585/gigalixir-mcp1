# System Prompt: Gigalixir, Turso, and Cloud Infrastructure MCP Integration Guide

This guide defines how to integrate, execute, and control the **Gigalixir, Turso, and Cloud Storage WebDAV MCP (Model Context Protocol) Server** within any MCP-enabled sandbox environment. All 40 redundant GitHub tools have been removed for a streamlined context size and maximum resource reliability.

## MCP Server Metadata
- **Base API URL:** `https://gigalixir-mcp1.ameremadapdelkalek.workers.dev/`
- **JSON-RPC Endpoint:** `https://gigalixir-mcp1.ameremadapdelkalek.workers.dev/mcp`
- **Transport Method:** POST requests with standard JSON-RPC 2.0 payload formatting.

---

## Environment Credentials Configuration
**IMPORTANT FOR CALLING AI CLIENTS:**
You (the AI utilizing this MCP server) **DO NOT** need to provide, look up, or pass any API keys, credentials, or secrets (such as `giga_email`, `giga_api_key`, `db_token`, `github_token`, etc.) in the tool arguments. All platform and database credentials are fully configured, managed, and securely bound **server-side** as environment variables on the backend hosting instance. Simply invoke the tools using the required non-secret parameters (e.g. `app_name`, `sql`, `path`, etc.) and the backend will inject the required credentials automatically.

To allow the Model Context Protocol backend server to interact with your platforms, populate the following environment variables on the hosting environment:

| Environment Variable | Description |
|----------------------|-------------|
| `GIGALIXIR_EMAIL` | Registered Gigalixir email address |
| `GIGALIXIR_API_KEY` | Gigalixir API Key |
| `TURSO_API_TOKEN` / `TURSO_PLATFORM_API_TOKEN` | Turso DB Platform Access Token |
| `TURSO_ORG` | Custom Turso Organization namespace |
| `TURSO_DB_URL` | LibSQL Database URL |
| `TURSO_AUTH_TOKEN` | Auth Token for active LibSQL DB |
| `INFINICLOUD_USERNAME` | InfiniCLOUD WebDAV username |
| `INFINICLOUD_PASSWORD` | InfiniCLOUD WebDAV password |
| `INFINICLOUD_DAV_URL` | WebDAV root endpoint URL |

---

## Executing & Testing MCP Calls

### Pattern: Single Tool Invocation Script
Write a temporary script, e.g., `test_mcp_call.js` and invoke it using `npx -y tsx test_mcp_call.js`:

```javascript
async function callMCP(toolName, toolArgs) {
  const mcpEndpoint = "https://gigalixir-mcp1.ameremadapdelkalek.workers.dev/mcp";
  const payload = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: {
      name: toolName,
      arguments: toolArgs
    }
  };
  const response = await fetch(mcpEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return await response.json();
}
```

---

## Complete Tool Directory Reference (44 Tools)

### Theme 1: Gigalixir Orchestration & Container Pool (13 Tools)

#### 1. `list_apps`
- **Description:** List all Gigalixir applications in your account. Autodetects the active workspace app.
- **Arguments:**
  - `giga_email` (`string`, *Optional*)
  - `giga_api_key` (`string`, *Optional*)

#### 2. `auto_detect_app`
- **Description:** Auto-detects the active workspace Gigalixir application name using local system state, configs, or fallback metadata.
- **Arguments:** None

#### 3. `get_app`
- **Description:** Get details and status about a specific Gigalixir application.
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `giga_email` (`string`, *Optional*)
  - `giga_api_key` (`string`, *Optional*)

#### 4. `get_configs`
- **Description:** Retrieve custom environment variables/configs for a running Gigalixir app.
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `giga_email` (`string`, *Optional*)
  - `giga_api_key` (`string`, *Optional*)

#### 5. `set_config`
- **Description:** Set custom environment variable(s) for a Gigalixir app (automatically triggers zero-downtime rolling restart).
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `key` (`string`, **Required**)
  - `value` (`string`, **Required**)
  - `giga_email` (`string`, *Optional*)
  - `giga_api_key` (`string`, *Optional*)

#### 6. `delete_config`
- **Description:** Delete/remove an environment variable from a Gigalixir app.
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `key` (`string`, **Required**)
  - `giga_email` (`string`, *Optional*)
  - `giga_api_key` (`string`, *Optional*)

#### 7. `get_replicas`
- **Description:** Get replica container status, size, and health state for a Gigalixir app.
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `giga_email` (`string`, *Optional*)
  - `giga_api_key` (`string`, *Optional*)

#### 8. `scale`
- **Description:** Scale a Gigalixir application to a specified number of replicas or size/performance tier.
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `replicas` (`number`, *Optional*)
  - `size` (`number`, *Optional*)
  - `giga_email` (`string`, *Optional*)
  - `giga_api_key` (`string`, *Optional*)

#### 9. `list_releases`
- **Description:** Retrieve historical deployments/releases of a Gigalixir application.
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `giga_email` (`string`, *Optional*)
  - `giga_api_key` (`string`, *Optional*)

#### 10. `rollback`
- **Description:** Rollback an application to a designated build version.
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `version` (`number`, **Required**)
  - `giga_email` (`string`, *Optional*)
  - `giga_api_key` (`string`, *Optional*)

#### 11. `restart`
- **Description:** Gracefully restart a Gigalixir application natively (rolling container update).
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `giga_email` (`string`, *Optional*)
  - `giga_api_key` (`string`, *Optional*)

#### 12. `get_logs`
- **Description:** Pull recent container logs without hanging or timeouts.
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `num_lines` (`number`, *Optional*)
  - `giga_email` (`string`, *Optional*)
  - `giga_api_key` (`string`, *Optional*)

#### 13. `create_app`
- **Description:** Provision a brand new Gigalixir application subdomain.
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `cloud` (`string`, *Optional*)
  - `region` (`string`, *Optional*)
  - `giga_email` (`string`, *Optional*)
  - `giga_api_key` (`string`, *Optional*)

---

### Theme 2: Turso Serverless SQLite Databases (14 Tools)

#### 14. `turso_query`
- **Description:** Execute a safe read-only SQL lookup query (SELECT) with direct parameter injection.
- **Arguments:**
  - `sql` (`string`, **Required**)
  - `args` (`array`, *Optional*)
  - `db_url` (`string`, *Optional*)
  - `db_token` (`string`, *Optional*)

#### 15. `turso_execute`
- **Description:** Execute state-changing SQL statements (INSERT, UPDATE, DELETE, CREATE, DROP). Guardrails protect against unshielded DROPs.
- **Arguments:**
  - `sql` (`string`, **Required**)
  - `args` (`array`, *Optional*)
  - `db_url` (`string`, *Optional*)
  - `db_token` (`string`, *Optional*)

#### 16. `turso_list_tables`
- **Description:** List all database tables inside your active Turso SQLite database.
- **Arguments:**
  - `db_url` (`string`, *Optional*)
  - `db_token` (`string`, *Optional*)

#### 17. `turso_describe_table`
- **Description:** Describe a table's schema, column definitions, types, and properties.
- **Arguments:**
  - `table` (`string`, **Required**)
  - `db_url` (`string`, *Optional*)
  - `db_token` (`string`, *Optional*)

#### 18. `turso_transaction`
- **Description:** Execute multiple stateful SQL statements inside a safe BEGIN/COMMIT transaction boundary.
- **Arguments:**
  - `statements` (`array`, **Required`)
  - `db_url` (`string`, *Optional*)
  - `db_token` (`string`, *Optional*)

#### 19. `turso_create_database`
- **Description:** Create a brand new serverless SQLite database in your Turso Cloud Platform account.
- **Arguments:**
  - `db_name` (`string`, **Required**)
  - `org_name` (`string`, *Optional*)
  - `api_token` (`string`, *Optional*)

#### 20. `turso_list_databases`
- **Description:** Retrieve names and endpoints of all serverless databases in your Turso account.
- **Arguments:**
  - `org_name` (`string`, *Optional*)
  - `api_token` (`string`, *Optional*)

#### 21. `turso_get_database_pool`
- **Description:** Retrieve the list of registered database connections and find which one is currently selected as active.
- **Arguments:** None

#### 22. `turso_add_database_to_pool`
- **Description:** Register an external database connection under a distinct label inside the dynamic server-side pool.
- **Arguments:**
  - `name` (`string`, **Required**)
  - `url` (`string`, **Required**)
  - `token` (`string`, *Optional*)
  - `set_active` (`boolean`, *Optional*)

#### 23. `turso_set_active_database`
- **Description:** Switch the default active target database in the server pool.
- **Arguments:**
  - `name` (`string`, **Required**)

#### 24. `turso_remove_database_from_pool`
- **Description:** De-register a database connection from the server-side pool.
- **Arguments:**
  - `name` (`string`, **Required**)

#### 25. `turso_get_database_usage`
- **Description:** Query Turso Platform API to retrieve read/write statistics and storage bytes.
- **Arguments:**
  - `db_name` (`string`, **Required**)
  - `org_name` (`string`, *Optional*)
  - `api_token` (`string`, *Optional*)

#### 26. `turso_explain_query`
- **Description:** Prepend EXPLAIN QUERY PLAN to your SQL query to evaluate indices and optimize query performance.
- **Arguments:**
  - `sql` (`string`, **Required**)
  - `db_url` (`string`, *Optional*)
  - `db_token` (`string`, *Optional*)

#### 27. `turso_backup`
- **Description:** Dump active full DDL schemas and structured SQL inserts to construct an offline backup file.
- **Arguments:**
  - `db_url` (`string`, *Optional*)
  - `db_token` (`string`, *Optional*)
  - `db_name` (`string`, *Optional*)

---

### Theme 3: Infrastructure, Environments & Monitoring (10 Tools)

#### 28. `promote_environment`
- **Description:** Promote active configuration keys and container variables from Staging to Production, comparing environments safely.
- **Arguments:**
  - `source_app` (`string`, **Required**)
  - `target_app` (`string`, **Required**)
  - `skip_variables` (`array`, *Optional*)

#### 29. `gigalixir_manage_domains`
- **Description:** Add, remove, or list custom domains for your Gigalixir applications.
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `action` (`string`, **Required**)
  - `domain` (`string`, *Optional*)

#### 30. `gigalixir_manage_ssl`
- **Description:** Audit SSL Certificate provisioning and secure routing on custom domains.
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `domain` (`string`, **Required**)

#### 31. `deploy_preview`
- **Description:** Compile, build-wrap, and deploy/test a preview sandbox rollout before sending to production.
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `owner` (`string`, **Required**)
  - `repo` (`string`, **Required**)
  - `branch` (`string`, *Optional*)

#### 32. `deploy_production`
- **Description:** Upgraded Consolidated Deploy Tool. Triggers deployment cycles, matches environment variables cleanly, performs zero-downtime container replacement, and validates launch logs.
- **Arguments:**
  - `app_name` (`string`, **Required**)
  - `config_key` (`string`, *Optional*)
  - `config_value` (`string`, *Optional*)
  - `configs` (`object`, *Optional*)

#### 33. `health_check`
- **Description:** Run real-time pings/HTTP verification checks on public-facing endpoints or pings to test and record target response latencies.
- **Arguments:**
  - `url` (`string`, *Optional*)
  - `app_name` (`string`, *Optional*)

#### 34. `infra_status`
- **Description:** Unified Operations Dashboard. Aggregates Gigalixir server configurations, container sizing, active replica counts, and live Turso DB connections into a single comprehensive status report.
- **Arguments:**
  - `app_name` (`string`, *Optional*)
  - `db_name` (`string`, *Optional*)

#### 35. `audit_traces_list`
- **Description:** Retrieve audit logs tracing dry runs, actual mutations, and guardrail decisions inside the active session.
- **Arguments:** None

#### 36. `get_system_safety_policies`
- **Description:** Retrieve the system's guardrail and safety configurations (destructive query locks, scaling restrictions, etc.).
- **Arguments:** None

#### 37. `diagnose_and_repair_app`
- **Description:** Remote Auto-healer. Scans container replicas and server health logs, and fires self-recovery container commands to resolve crashloops.
- **Arguments:**
  - `app_name` (`string`, **Required**)

---

### Theme 4: InfiniCLOUD WebDAV Personal Storage (5 Tools)

#### 38. `infinicloud_list_files`
- **Description:** Recurse and search for directories or files on your InfiniCLOUD personal storage partition using WebDAV PROPFIND.
- **Arguments:**
  - `path` (`string`, *Optional*)

#### 39. `infinicloud_get_file`
- **Description:** Download the literal text profile/contents of a WebDAV stored asset using WebDAV GET.
- **Arguments:**
  - `path` (`string`, **Required**)

#### 40. `infinicloud_create_file`
- **Description:** Upload or replace standard text files/configuration backups on InfiniCLOUD using WebDAV PUT.
- **Arguments:**
  - `path` (`string`, **Required**)
  - `content` (`string`, **Required**)

#### 41. `infinicloud_delete_file`
- **Description:** Remove a WebDAV folder or file from InfiniCLOUD using WebDAV DELETE.
- **Arguments:**
  - `path` (`string`, **Required**)

#### 42. `infinicloud_create_directory`
- **Description:** Provision a clean new directory on WebDAV space using WebDAV MKCOL.
- **Arguments:**
  - `path` (`string`, **Required**)

---

### Theme 5: Central Orchestration & Help (2 Tools)

#### 43. `help`
- **Description:** Lookup target schemas, best practices, and descriptions dynamically inside the console.
- **Arguments:**
  - `filter_by_tool` (`string`, *Optional*)

#### 44. `batch_execute`
- **Description:** Manage microservice control loops. Execute multiple tools sequentially or concurrently with customized failure-handling structures and timeout checks.
- **Arguments:**
  - `operations` (`array`, **Required**): Array of `{ tool: string, arguments: object }` calls
  - `parallel` (`boolean`, *Optional*)
  - `continue_on_error` (`boolean`, *Optional*)
  - `max_parallel` (`number`, *Optional*)
  - `timeout_ms` (`number`, *Optional*)
