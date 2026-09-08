import assert from "node:assert/strict";
import { createFakePluginHost } from "../../plugins/node_modules/@get-bb/plugin-sdk/dist/testing/index.js";
import plugin from "../../plugins/plugins/thread-manager/server.ts";

const host = createFakePluginHost({
  pluginId: "thread-manager",
  sdk: {
    subscribe: () => () => {},
    providers: { models: () => ({ models: [], selectedOnlyModels: [] }) },
    threads: {
      experimental_preflightExecutionOverrides: () => ({ results: [{
        threadId: "thread-1", status: "unavailable", reason: "catalog-unavailable", message: "Fixture catalog unavailable",
      }] }),
      experimental_applyExecutionOverrides: () => ({ results: [{
        threadId: "thread-1", status: "rejected", reason: "catalog-changed", retryable: true,
      }] }),
    },
  },
});
try {
  await plugin(host.bb);
  const route = { providerId: "codex", environmentId: "env-1", hostId: "host-1", workspacePath: "/workspace" };
  const catalog = await host.harness.callRpc("executionCatalogs", { routes: [route] });
  assert.equal(catalog.routes[0].error, null);
  assert.deepEqual(host.harness.sdk.callsTo("providers.models"), [[{ providerId: "codex", environmentId: "env-1" }]]);
  const unsupported = await host.harness.callRpc("executionCatalogs", { routes: [{ ...route, environmentId: null }] });
  assert.match(unsupported.routes[0].error, /needs a BB environment/);
  assert.equal(host.harness.sdk.callsTo("providers.models").length, 1);
  const item = { threadId: "thread-1", witness: "a".repeat(64), patch: { model: "model-1" } };
  const preflight = await host.harness.callRpc("preflightExecutionChange", { items: [item] });
  assert.equal(preflight.results[0].reason, "catalog-unavailable");
  await assert.rejects(host.harness.callRpc("preflightExecutionChange", { items: [item, item] }));
  assert.equal(host.harness.sdk.callsTo("threads.experimental_preflightExecutionOverrides").length, 1);
  const apply = await host.harness.callRpc("applyExecutionChange", {
    mutationId: "mutation-1", items: [{ threadId: "thread-1", applyToken: "stale-token" }],
  });
  assert.deepEqual(apply.results, [{ threadId: "thread-1", status: "rejected", reason: "catalog-changed", retryable: true }]);
  console.log("PASS: authored factory, public SDK routing, RPC validation, duplicate rejection, and stale catalog result preservation");
} finally {
  await host.harness.dispose();
}
