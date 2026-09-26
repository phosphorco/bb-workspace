import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_EVIDENCE_BYTES, MAX_NATIVE_RELOAD_BYTES, OPERATION_ORDER, PLUGINS_CWD, bindReceipt, captureEvidence, createOperation, dispatch, dispatchSequence, expectedBuildPaths, parseBuildReceipt, parseHooksReceipt, parseReloadReceipt, validateOperation, validateSequence } from "./context-magnet-session-etl-plugin-dispatch.mjs";

const h = (letter) => letter.repeat(64);
const identity = Object.freeze({ hostId: "host_fixture123", router: { cwd: "/fixture/router", launcher: "/fixture/router/lib/router-command", generationDigest: h("a") }, workbench: { executable: "/fixture/workbench/workbench", version: "workbench 0.8.1 (fixture)", sha256: h("b") } });
function output(command) {
  if (command.kind.startsWith("build-")) return expectedBuildPaths(command.pluginId).join("\n") + "\n";
  if (command.kind.startsWith("reload-")) return nativeReload(command);
  return JSON.stringify({ installed: true, workbench: identity.workbench, codex: { executable: "/not-retained" }, ...(command.kind === "status-hooks" ? { health: { status: "ready" } } : {}) });
}
const nativeSecret = "NATIVE_PLUGIN_JSON_SECRET_DO_NOT_RETAIN";
const otherSecret = "OTHER_PLUGIN_SECRET_DO_NOT_RETAIN";
function nativeEntry(id, overrides = {}) {
  const rootDir = `/home/ubuntu/bb/plugins/plugins/${id}`;
  return {
    id, source: `path:${rootDir}`, rootDir, version: "1.0.0", provenance: "direct",
    isOrphanedBuiltin: false, publisherLabel: null, sourceDisplay: rootDir,
    updateState: {}, enabled: true, description: nativeSecret, name: id,
    screenshots: [], collections: [], icon: null, iconUrl: null,
    status: "running", statusDetail: null,
    handlerStats: { count: 0, totalMs: 0, maxMs: 0, errorCount: 0 },
    services: [], schedules: [], cliCommand: null, capabilities: [], hasSettings: false,
    app: { hasApp: true, bundle: { jsUrl: "/fixture/app.js", cssUrl: null, jsBytes: 1, hash: "fixture", sdkMajor: 1, sdkVersion: "1.0.0", compatible: true } },
    logoUrl: null, logoDarkUrl: null, providerIds: [], icons: {}, ...overrides,
  };
}
function nativeReload(command, target = nativeEntry(command.pluginId), others = [
  nativeEntry("agentation", { status: "disabled", description: otherSecret }),
  nativeEntry("tasks", { description: otherSecret }),
]) {
  return JSON.stringify({ ok: true, plugins: [others[0], target, ...others.slice(1)] });
}
function largeNativeReload(command, id = command.pluginId, padding = 96 * 1024) {
  return nativeReload(command, nativeEntry(id, { description: nativeSecret + "x".repeat(padding) }));
}
class RecordingExecutor { constructor(fail = null) { this.fail = fail; this.calls = []; } async execute(command) { this.calls.push(command); return command.kind === this.fail ? { exitCode: 17, stdout: "", stderr: "fixture failure" } : { exitCode: 0, stdout: output(command), stderr: "" }; } }

describe("Context Magnet plugin dispatch contract", () => {
  it("uses only the six exact templates and fixed relative builds under canonical cwd", () => { const c = OPERATION_ORDER.map((kind) => createOperation(identity, kind)); assert.deepEqual(OPERATION_ORDER, ["build-inspector", "build-router", "reload-inspector", "reload-router", "install-hooks", "status-hooks"]); assert.deepEqual(c[0].argv, ["plugin", "build", "./plugins/context-magnet-inspector"]); assert.deepEqual(c[1].argv, ["plugin", "build", "./plugins/subscription-router"]); assert.equal(c[0].cwd, PLUGINS_CWD); assert.deepEqual(c[2].argv, ["plugin", "reload", "context-magnet-inspector", "--json"]); assert.deepEqual(c[3].argv, ["plugin", "reload", "subscription-router", "--json"]); assert.deepEqual(c[4].argv, ["hooks", "install", "--workbench", identity.workbench.executable]); assert.deepEqual(c[5].argv, ["hooks", "status"]); assert.throws(() => createOperation(identity, "install-router"), /allowlisted/); });
  it("parses actual per-operation native shapes and projects no artifacts or raw hook body", () => { const build = parseBuildReceipt(createOperation(identity, "build-inspector"), output(createOperation(identity, "build-inspector"))); assert.deepEqual(build.distPaths, expectedBuildPaths("context-magnet-inspector")); assert.equal("artifactSha256" in build, false); assert.deepEqual(parseReloadReceipt(createOperation(identity, "reload-router"), output(createOperation(identity, "reload-router"))), { operation: "reload-router", pluginId: "subscription-router" }); assert.deepEqual(parseHooksReceipt(identity, createOperation(identity, "status-hooks"), output(createOperation(identity, "status-hooks"))), { operation: "status-hooks", installed: true, workbench: identity.workbench, health: "ready" }); });
  it("finds the requested plugin at the first, middle, or last native list position", () => {
    const command = createOperation(identity, "reload-inspector");
    const target = nativeEntry(command.pluginId);
    const others = [nativeEntry("agentation", { status: "disabled", description: otherSecret }), nativeEntry("tasks", { description: otherSecret })];
    for (let position = 0; position <= others.length; position++) {
      const plugins = [...others];
      plugins.splice(position, 0, target);
      const receipt = parseReloadReceipt(command, JSON.stringify({ ok: true, plugins }));
      assert.deepEqual(receipt, { operation: command.kind, pluginId: command.pluginId });
      for (const secret of [nativeSecret, otherSecret, "agentation", "tasks"]) assert.equal(JSON.stringify(receipt).includes(secret), false);
    }
  });
  it("rejects wrong, missing, malformed, duplicate, failed, and non-running native output", () => {
    const build = createOperation(identity, "build-router"), reload = createOperation(identity, "reload-inspector"), status = createOperation(identity, "status-hooks");
    assert.throws(() => parseBuildReceipt(build, JSON.stringify({ nope: true })), /paths/);
    assert.throws(() => parseBuildReceipt(build, expectedBuildPaths(build.pluginId).slice().reverse().join("\n")), /paths/);
    const requested = nativeEntry(reload.pluginId);
    for (const [response, pattern] of [
      [{ ok: true, plugins: [nativeEntry("foreign")] }, /missing.*requested/],
      [{ ok: true, plugins: [requested, requested] }, /duplicate/],
      [{ ok: true, plugins: [requested, nativeEntry("foreign"), nativeEntry("foreign")] }, /duplicate/],
      [{ ok: true, plugins: [{ id: reload.pluginId }] }, /not running/],
      [{ ok: true, plugins: [nativeEntry(reload.pluginId, { status: "error" })] }, /not running/],
      [{ ok: true, plugins: [nativeEntry(reload.pluginId, { status: null })] }, /not running/],
      [{ ok: true, plugins: [null, requested] }, /malformed/],
      [{ ok: true, plugins: [{ id: 1 }, requested] }, /malformed/],
      [{ ok: false, plugins: [requested] }, /successful/],
      [{ ok: true, plugins: null }, /successful/],
    ]) assert.throws(() => parseReloadReceipt(reload, JSON.stringify(response)), pattern);
    assert.throws(() => parseHooksReceipt(identity, status, JSON.stringify({ installed: true, workbench: identity.workbench, health: { status: "reinstall-required" } })), /ready/);
    assert.throws(() => parseHooksReceipt(identity, status, JSON.stringify({ installed: false })), /installed/);
  });
  it("parses a secret-bearing native full list above the evidence window without retaining other plugins", async () => {
    const command = createOperation(identity, "reload-inspector"), stdout = largeNativeReload(command);
    assert.ok(Buffer.byteLength(stdout) > MAX_EVIDENCE_BYTES);
    assert.ok(Buffer.byteLength(stdout) < MAX_NATIVE_RELOAD_BYTES);
    assert.equal(JSON.parse(stdout).plugins.length, 3);
    const result = await dispatch(identity, { async execute() { return { exitCode: 0, stdout, stderr: nativeSecret }; } }, command);
    assert.deepEqual(result.receipt, { operation: command.kind, pluginId: command.pluginId });
    assert.deepEqual(result.evidence.stdout, { bytes: MAX_EVIDENCE_BYTES, truncated: true });
    assert.equal(result.evidence.stderr.classification, "command-diagnostic");
    for (const secret of [nativeSecret, otherSecret, "agentation", "tasks"]) {
      assert.equal(JSON.stringify(result).includes(secret), false);
      assert.equal(JSON.stringify(captureEvidence({ exitCode: 0, stdout, stderr: nativeSecret })).includes(secret), false);
    }
  });
  it("accepts exactly 256 KiB of native JSON and rejects one byte more", () => {
    const command = createOperation(identity, "reload-router");
    const baseBytes = Buffer.byteLength(largeNativeReload(command, command.pluginId, 0));
    const atCap = largeNativeReload(command, command.pluginId, MAX_NATIVE_RELOAD_BYTES - baseBytes);
    const overCap = largeNativeReload(command, command.pluginId, MAX_NATIVE_RELOAD_BYTES - baseBytes + 1);
    assert.equal(Buffer.byteLength(atCap), MAX_NATIVE_RELOAD_BYTES);
    assert.equal(Buffer.byteLength(overCap), MAX_NATIVE_RELOAD_BYTES + 1);
    assert.deepEqual(parseReloadReceipt(command, atCap), { operation: command.kind, pluginId: command.pluginId });
    assert.throws(() => parseReloadReceipt(command, overCap), /native command cap/);
  });
  it("rejects over-cap, malformed, foreign, and nonzero large reload output without raw evidence", async () => { const command = createOperation(identity, "reload-inspector"); for (const [stdout, exitCode, pattern] of [[largeNativeReload(command, command.pluginId, MAX_NATIVE_RELOAD_BYTES), 0, /native command cap/], [largeNativeReload(command).slice(0, -1), 0, /not JSON/], [largeNativeReload(command, "foreign-plugin"), 0, /requested/], [largeNativeReload(command), 17, /failed with exit 17/]]) { await assert.rejects(dispatch(identity, { async execute() { return { exitCode, stdout, stderr: nativeSecret }; } }, command), (error) => pattern.test(error.message) && !JSON.stringify({ message: error.message, evidence: error.evidence }).includes(nativeSecret)); } assert.throws(() => parseReloadReceipt(command, largeNativeReload(command, command.pluginId, MAX_NATIVE_RELOAD_BYTES)), /native command cap/); });
  it("accepts the same bounded native full list on the rollback path after a partial failure", async () => {
    const calls = [];
    let restoring = false;
    const executor = { async execute(command) {
      calls.push(command.kind);
      if (command.kind === "install-hooks" && !restoring) return { exitCode: 17, stdout: "", stderr: nativeSecret };
      return { exitCode: 0, stdout: command.kind.startsWith("reload-") ? largeNativeReload(command) : output(command), stderr: "" };
    } };
    await assert.rejects(dispatchSequence(identity, executor), (error) => error.operation === "install-hooks" && error.evidence.exitCode === 17);
    restoring = true;
    const restored = [];
    for (const kind of ["reload-inspector", "reload-router"]) restored.push(await dispatch(identity, executor, createOperation(identity, kind)));
    assert.deepEqual(calls, [...OPERATION_ORDER.slice(0, 5), "reload-inspector", "reload-router"]);
    assert.deepEqual(restored.map((item) => item.receipt.pluginId), ["context-magnet-inspector", "subscription-router"]);
    assert.ok(restored.every((item) => item.evidence.stdout.truncated && item.evidence.stdout.bytes === MAX_EVIDENCE_BYTES));
    for (const secret of [nativeSecret, otherSecret, "agentation", "tasks"]) assert.equal(JSON.stringify(restored).includes(secret), false);
  });
  it("rejects foreign and router-install commands before executor use and exposes only bounded secret-free evidence", async () => { const cases = [["build-inspector", (op) => { op.cwd = "/foreign"; }], ["reload-router", (op) => { op.argv.push("--foreign"); }], ["install-hooks", (op) => { op.workbench.executable = "/foreign"; }]]; for (const [kind, mutate] of cases) { const op = structuredClone(createOperation(identity, kind)); mutate(op); const executor = new RecordingExecutor(); assert.throws(() => validateOperation(identity, op), /foreign|template/); await assert.rejects(dispatch(identity, executor, op), /foreign|template/); assert.equal(executor.calls.length, 0); } const routerInstall = { kind: "install-router" }, routerExecutor = new RecordingExecutor(); assert.throws(() => validateOperation(identity, routerInstall), /allowlisted/); await assert.rejects(dispatch(identity, routerExecutor, routerInstall), /allowlisted/); assert.equal(routerExecutor.calls.length, 0); const secret = "SENSITIVE_STDERR_DO_NOT_RETAIN", accountSecret = "RAW_ACCOUNT_SECRET_DO_NOT_RETAIN", rawHook = JSON.stringify({ installed: true, workbench: identity.workbench, accounts: [{ secret: accountSecret }], codex: { token: accountSecret }, health: { status: "ready" } }); const captured = captureEvidence({ exitCode: 0, stdout: rawHook, stderr: secret }); assert.deepEqual(Object.keys(captured).sort(), ["evidence", "exitCode"]); assert.equal(JSON.stringify(captured).includes(accountSecret), false); assert.equal(JSON.stringify(captured).includes(secret), false); const success = await dispatch(identity, { async execute() { return { exitCode: 0, stdout: rawHook, stderr: secret }; } }, createOperation(identity, "status-hooks")); assert.equal(JSON.stringify(success).includes(accountSecret), false); const parseFailure = rawHook.replace("ready", "reinstall-required"); await assert.rejects(dispatch(identity, { async execute() { return { exitCode: 0, stdout: parseFailure, stderr: secret }; } }, createOperation(identity, "status-hooks")), (error) => !error.message.includes(accountSecret) && !error.message.includes(secret)); const oversized = captureEvidence({ exitCode: 0, stdout: "x".repeat(MAX_EVIDENCE_BYTES + 1), stderr: secret.repeat(MAX_EVIDENCE_BYTES) }); assert.equal(oversized.evidence.stdout.truncated, true); assert.equal(oversized.evidence.stderr.bytes, MAX_EVIDENCE_BYTES); assert.equal(oversized.evidence.stderr.truncated, true); assert.equal(oversized.evidence.stderr.classification, "command-diagnostic"); assert.equal(JSON.stringify(oversized).includes(secret), false); await assert.rejects(dispatch(identity, { async execute() { return { exitCode: 9, stdout: rawHook, stderr: secret }; } }, createOperation(identity, "status-hooks")), (error) => error.evidence.exitCode === 9 && !JSON.stringify(error.evidence).includes(accountSecret) && !JSON.stringify(error.evidence).includes(secret)); });
  it("enforces order and immediate failure propagation with only a recording fixture", async () => { const executor = new RecordingExecutor(), results = await dispatchSequence(identity, executor); assert.deepEqual(results.map((result) => result.command.kind), OPERATION_ORDER); assert.deepEqual(executor.calls.map((command) => command.kind), OPERATION_ORDER); assert.equal(JSON.stringify(results).includes("must-not-retain"), false); const commands = OPERATION_ORDER.map((kind) => createOperation(identity, kind)); [commands[0], commands[1]] = [commands[1], commands[0]]; assert.throws(() => validateSequence(commands), /order/); const failing = new RecordingExecutor("reload-router"); await assert.rejects(dispatchSequence(identity, failing), (error) => error.operation === "reload-router" && error.evidence.exitCode === 17); assert.deepEqual(failing.calls.map((command) => command.kind), OPERATION_ORDER.slice(0, 4)); assert.equal(bindReceipt(identity, createOperation(identity, "build-inspector"), results[0].receipt).pluginId, "context-magnet-inspector"); });
});
