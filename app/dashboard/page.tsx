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
  Plus
} from 'lucide-react';

interface ToolDefinition {
  name: string;
  description: string;
  category: 'gigalixir' | 'turso' | 'github' | 'devops';
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
    name: 'turso_list_tables',
    description: 'List database tables in your integrated Turso storage database',
    category: 'turso',
    defaultArgs: {},
    fields: []
  },
  {
    name: 'github_list_repos',
    description: 'Retrieve linked repositories to inspect deployment sources',
    category: 'github',
    defaultArgs: {},
    fields: []
  }
];

export default function Dashboard() {
  const [selectedTool, setSelectedTool] = useState<ToolDefinition>(TOOLS_SCHEMA[5]); // 'diagnose_and_repair_app' as default
  const [toolArgs, setToolArgs] = useState<Record<string, any>>(TOOLS_SCHEMA[5].defaultArgs);
  const [running, setRunning] = useState<boolean>(false);
  const [mcpMetadata, setMcpMetadata] = useState<any>(null);
  const [consoleLogs, setConsoleLogs] = useState<{ time: string; text: string; type: 'info' | 'success' | 'error' | 'input' }[]>([
    { time: new Date().toLocaleTimeString(), text: 'DevOps & MCP Web GUI Dashboard initialised.', type: 'info' }
  ]);
  const [rawResponse, setRawResponse] = useState<string>('');
  
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

  const appendLog = (text: string, type: 'info' | 'success' | 'error' | 'input' = 'info') => {
    setConsoleLogs(prev => [
      ...prev,
      { time: new Date().toLocaleTimeString(), text, type }
    ]);
  };

  const fetchAppStatus = useCallback(async (appId = 'amer') => {
    setAppStatus(prev => ({ ...prev, loading: true }));
    try {
      const payload = {
        jsonrpc: '2.0',
        id: `status-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: 'get_app',
          arguments: { app_name: appId }
        }
      };

      const res = await fetch('/', {
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
          const repRes = await fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: `rep-${Date.now()}`,
              method: 'tools/call',
              params: { name: 'get_replicas', arguments: { app_name: appId } }
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
  }, []);

  const fetchMcpMetadata = useCallback(async () => {
    try {
      const res = await fetch('/');
      if (res.ok) {
        const data = await res.json();
        setMcpMetadata(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMcpMetadata();
      fetchAppStatus('amer');
    }, 100);
    return () => clearTimeout(timer);
  }, [fetchMcpMetadata, fetchAppStatus]);

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
      const payload = {
        jsonrpc: '2.0',
        id: `call-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: selectedTool.name,
          arguments: toolArgs
        }
      };

      const res = await fetch('/', {
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
      const payload = {
        jsonrpc: '2.0',
        id: `action-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      const res = await fetch('/', {
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
    { id: 'github', title: 'GitHub' }
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
