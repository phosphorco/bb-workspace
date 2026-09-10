import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { startTestServer } from "../fork/build/proof-bb/apps/server/test/helpers/test-app.ts";

// Real selected host and canonical plugin artifacts; ephemeral test state only.
// No model providers, production credentials, or normal service changes.
const root = resolve(import.meta.dirname, "..");
const source = execFileSync("git", ["-C", `${root}/fork/build/proof-bb`, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.equal(source, "fc11803cce70f44a0099c03b10a214eafd296651");
for (const [repo, expected] of [
  ["fork", "6f514108af1623ae0a9f5538cb699fb50970f857"],
  ["plugins", "ed73a8239800cf2e9690d613d7addf4e24d627df"],
  ["community-plugins", "aa42ba29461b955414bee0df4415d3e31d22d79b"],
]) {
  const revision = execFileSync("git", ["-C", `${root}/${repo}`, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assert.equal(revision, expected, `${repo} source revision`);
}
const server = await startTestServer({ seedFirstPartyProviders: false });
server.pluginService.bindSdk({ baseUrl: server.baseUrl });
try {
  for (const [repo, id] of [
    ["plugins", "agent-connect"],
    ["plugins", "thread-progress"],
    ["plugins", "subscription-router"],
    ["community-plugins", "analytics"],
    ["community-plugins", "agentation-mentions"],
    ["community-plugins", "cross-references"],
    ["community-plugins", "machine-monitor"],
    ["community-plugins", "message-timings-nerd"],
    ["community-plugins", "perspectives"],
    ["community-plugins", "restart-resume"],
    ["community-plugins", "sticky-notes"],
  ]) {
    const path = `${root}/${repo}/plugins/${id}`;
    const entry = await server.pluginService.installPath(path);
    assert.equal(entry.status, "running", `${id}: ${entry.statusDetail}`);
    console.log(JSON.stringify({ plugin: id, source: path, status: entry.status }));
  }
  const connection = `${server.baseUrl}/api/v1/plugins/agent-connect/http/connection`;
  for (const [method, token, expected] of [
    ["OPTIONS", null, 204],
    ["GET", null, 401],
    ["POST", null, 401],
    ["GET", "invalid", 401],
    ["POST", "invalid", 401],
  ] as const) {
    const response = await fetch(connection, {
      method,
      ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
    });
    assert.equal(response.status, expected, `${method} connection authentication`);
    await response.arrayBuffer();
  }
  console.log(JSON.stringify({ source, connectionAuthentication: "pass", scope: "fresh-state factory and HTTP compatibility; not live-data migration" }));
} finally {
  await server.pluginService.stop();
  await server.close();
}
