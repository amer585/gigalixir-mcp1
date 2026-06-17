import worker from './src/worker.js';

// Setup Mock Environment
const mockEnv = {
  GITHUB_TOKEN: 'mock_github_token_for_tests',
  INFINICLOUD_DAV_URL: 'https://dav.example.com',
  INFINICLOUD_USERNAME: 'mock_user',
  INFINICLOUD_PASSWORD: 'mock_password'
};

async function callMcpTool(name, args) {
  const reqBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name,
      arguments: args
    }
  };

  const fetchFn = worker.fetch || worker.default?.fetch;
  if (!fetchFn) {
    console.log('Worker debug output: ', worker);
    throw new Error('Could not locate fetch function on imported worker module');
  }

  const response = await fetchFn(
    new Request('https://localhost/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody)
    }),
    mockEnv
  );

  const resJson = await response.json();
  if (resJson.error) {
    throw new Error(`MCP Error API Response: ${JSON.stringify(resJson.error)}`);
  }

  // Parse text body of JSON-RPC response
  if (resJson.result && Array.isArray(resJson.result.content)) {
    const textContent = resJson.result.content[0].text;
    const outer = JSON.parse(textContent);
    if (outer && typeof outer === 'object') {
      if (outer.status === 'failed') {
        throw new Error(outer.error || 'Execution failed');
      }
      if ('data' in outer && outer.data && typeof outer.data === 'object') {
        const combined = { ...outer.data };
        combined.status = outer.status;
        combined.dry_run = outer.dry_run;
        combined.executionMetadata = outer.executionMetadata;
        combined.error = outer.error;
        combined.data = outer.data; // Keep original reference too
        return combined;
      }
    }
    return outer;
  }

  return resJson;
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

let assertionsCount = 0;
let passedAssertions = 0;

function assert(condition, message) {
  assertionsCount++;
  if (condition) {
    passedAssertions++;
  } else {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TEST CASES ───────────────────────────────────────────────────────────────

test('Single tool execution (dry_run)', async () => {
  const result = await callMcpTool('scale', {
    app_name: 'example-app',
    replicas: 4,
    dry_run: true
  });

  assert(result.status === 'success', 'Result status should be success');
  assert(result.dry_run === true, 'dry_run should be true');
  assert(result.data.simulated === true, 'simulated should be true');
});

test('Multiple parallel executions via batch_execute (dry_run)', async () => {
  const result = await callMcpTool('batch_execute', {
    parallel: true,
    continue_on_error: true,
    max_parallel: 3,
    dry_run: true,
    operations: [
      {
        tool: 'scale',
        args: {
          app_name: 'app-a',
          replicas: 2
        }
      },
      {
        tool: 'set_config',
        args: {
          app_name: 'app-a',
          key: 'FOO',
          value: 'BAR'
        }
      }
    ]
  });

  assert(result.success === true, 'Multiple parallel tools ran successfully');
  assert(result.batch_results.length === 2, 'Should return results for exactly 2 operations');
  assert(result.batch_results[0].success === true, 'Operation 1 was successful');
  assert(result.batch_results[1].success === true, 'Operation 2 was successful');
});

test('Multiple sequential executions via batch_execute (dry_run)', async () => {
  const result = await callMcpTool('batch_execute', {
    parallel: false,
    continue_on_error: true,
    dry_run: true,
    operations: [
      {
        tool: 'scale',
        args: {
          app_name: 'app-x',
          replicas: 1
        }
      },
      {
        tool: 'set_config',
        args: {
          app_name: 'app-x',
          key: 'BAZ',
          value: 'QUX'
        }
      }
    ]
  });

  assert(result.success === true, 'Sequential batch executions completed');
  assert(result.batch_results.length === 2, 'Should return exactly 2 results');
  assert(result.batch_results[0].tool === 'scale', 'First tool corresponds matches');
  assert(result.batch_results[1].tool === 'set_config', 'Second tool matches');
});

test('Invalid tool names handling', async () => {
  const result = await callMcpTool('batch_execute', {
    parallel: true,
    operations: [
      {
        tool: 'unregistered_dummy_tool_name',
        args: {}
      }
    ]
  });

  assert(result.success === false, 'Batch should report overall failure');
  assert(result.batch_results[0].success === false, 'Tool execution should report failure');
  assert(result.batch_results[0].error.includes('Missing tool'), 'Result should specify unregistered message');
});

test('Invalid arguments handling (schema mismatch validation)', async () => {
  try {
    // missing required parameter 'app_name' in 'scale'
    await callMcpTool('scale', {
      replicas: 2
    });
    assert(false, 'Should have thrown on missing required parameter');
  } catch (err) {
    assert(err.message.includes('required'), 'Should throw on missing parameter required');
  }
});

test('Tool failures check (continue_on_error = true)', async () => {
  const result = await callMcpTool('batch_execute', {
    parallel: false,
    continue_on_error: true,
    dry_run: true,
    operations: [
      {
        tool: 'scale',
        args: {
          // missing 'app_name' -> will fail schema validation
          replicas: 5
        }
      },
      {
        tool: 'set_config',
        args: {
          app_name: 'app-fail',
          key: 'FOO',
          value: 'BAR'
        }
      }
    ]
  });

  assert(result.success === false, 'Should be unsuccessful due to a failed child tool');
  assert(result.batch_results[0].success === false, 'First operation failed due to schema parameters check');
  assert(result.batch_results[1].success === true, 'Second operation succeeded because continue_on_error is set true');
});

test('Tool failures check (continue_on_error = false / fail_fast)', async () => {
  const result = await callMcpTool('batch_execute', {
    parallel: false,
    continue_on_error: false,
    dry_run: true,
    operations: [
      {
        tool: 'scale',
        args: {
          // missing 'app_name' -> fails
          replicas: 5
        }
      },
      {
        tool: 'set_config',
        args: {
          app_name: 'app-fail',
          key: 'FOO',
          value: 'BAR'
        }
      }
    ]
  });

  assert(result.success === false, 'Should be unsuccessful');
  assert(result.batch_results.length === 1, 'Only first operation ran, second was bypassed due to fail_fast');
  assert(result.batch_results[0].success === false, 'First operation is recorded as failure');
});

test('Timeout limits protection', async () => {
  const result = await callMcpTool('batch_execute', {
    parallel: true,
    timeout_ms: 1, // extremely aggressive timeout to force a race condition
    operations: [
      {
        tool: 'scale',
        args: {
          app_name: 'app-timeout',
          replicas: 2
        }
      }
    ]
  });

  assert(result.success === false, 'Execution should be unsuccessful due to timeout');
  assert(result.batch_results[0].success === false, 'Result was recorded as failure');
  const errorMsg = result.batch_results[0].error || '';
  assert(errorMsg.includes('took longer than') || errorMsg.includes('Timeout'), 'Result error contains informative timeout message');
});

test('Max operations limits check (operations count = 21)', async () => {
  const fakeOps = Array.from({ length: 21 }, () => ({
    tool: 'scale',
    args: { app_name: 'example-app', replicas: 1, dry_run: true }
  }));

  try {
    await callMcpTool('batch_execute', {
      operations: fakeOps
    });
    assert(false, 'Should have failed with operation limit error');
  } catch (err) {
    assert(err.message.includes('exceeds'), 'Throws error explaining maximum operations limits exceeded');
  }
});

test('Recursive batch_execute validation prevention', async () => {
  try {
    await callMcpTool('batch_execute', {
      operations: [
        {
          tool: 'batch_execute',
          args: {
            operations: []
          }
        }
      ]
    });
    assert(false, 'Should have rejected recursive execution');
  } catch (err) {
    assert(err.message.includes('prohibited') || err.message.includes('Recursive'), 'Assert rejection matches security prevention pattern');
  }
});

test('Large operations sets (operations count = 20)', async () => {
  const fakeOps = Array.from({ length: 20 }, (v, i) => ({
    tool: 'scale',
    args: { app_name: `app-${i}`, replicas: 2, dry_run: true }
  }));

  const result = await callMcpTool('batch_execute', {
    dry_run: true,
    operations: fakeOps
  });

  assert(result.success === true, 'Full set of 20 operations completed successfully');
  assert(result.batch_results.length === 20, 'Returned exactly 20 distinct task results');
});

// ─────────────────────────────────────────────────────────────────────────────
// ── TEST RUNNER ──────────────────────────────────────────────────────────────

async function runAll() {
  console.log('\x1b[35m=== RUNNING MCP STRESS TEST SUITE ===\x1b[0m\n');
  let passedCount = 0;
  for (const t of tests) {
    try {
      console.log(`\x1b[36m⏱️  Running: ${t.name}...\x1b[0m`);
      const tStart = Date.now();
      await t.fn();
      const duration = Date.now() - tStart;
      console.log(`\x1b[32m✔ Passed: ${t.name} (${duration}ms)\x1b[0m\n`);
      passedCount++;
    } catch (err) {
      console.log(`\x1b[31m❌ Failed: ${t.name}\x1b[0m`);
      console.log(`\x1b[33mError detail: ${err.stack || err.message || err}\x1b[0m\n`);
    }
  }

  console.log('\x1b[35m=== RESULTS SUMMARY ===\x1b[0m');
  console.log(`Total test suites: ${tests.length}`);
  console.log(`Passed test suites: ${passedCount}`);
  console.log(`Failed test suites: ${tests.length - passedCount}`);
  console.log(`Total assertions evaluated: ${assertionsCount}`);
  console.log(`Passed assertions checklist: ${passedAssertions}`);

  if (passedCount === tests.length) {
    console.log('\n\x1b[32m🎉 ALL SYSTEM MCP TESTS FINISHED SUCCESSFULLY!\x1b[0m');
    process.exit(0);
  } else {
    console.log('\n\x1b[31m💔 SOME SYSTEM TESTS FAILED. CHECK LOGS ABOVE.\x1b[0m');
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Fatal crash during test run:', err);
  process.exit(1);
});
