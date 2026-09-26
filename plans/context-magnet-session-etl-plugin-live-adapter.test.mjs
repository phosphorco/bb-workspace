import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { sharedHooksStatus } from "../plugins/plugins/subscription-router/host/shared-hooks.mjs";
import { CONTROLLER_SOURCES, GENERATED_STATUS_PATHS, IDS, MAX_RECEIPT_BYTES, MUTATING_COMMAND_TIMEOUT_MS, PLUGIN_SOURCE_ROOTS, READ_COMMAND_TIMEOUT_MS, SOURCE_LIMITS, activate, boundedCommand, captureLive, projectSourceContent, redactCapture, rollbackFailure, runMode, stableProtectedWorkspace, stableSourceContent, streamStatusProjection } from "./context-magnet-session-etl-plugin-live-adapter.mjs";
import { createPrivateFixtureAdapter, runCli, runFixtureRehearsal } from "./context-magnet-session-etl-plugin-runtime.mjs";

function fixture(t, options = {}) { const root = mkdtempSync(join(tmpdir(), "context-magnet-live-adapter-test-")); t.after(() => rmSync(root, { recursive: true, force: true })); return createPrivateFixtureAdapter(root, options); }
function privateCli(t, options = {}) { const adapter = fixture(t, options), receiptPaths = { preimagePath: join(adapter.receiptRoot, "preimage.json"), activationPath: join(adapter.receiptRoot, "activation.json"), rollbackPath: join(adapter.receiptRoot, "restoration.json"), backupPath: adapter.backupPath }, cli = (mode, ...flags) => runCli({ argv: ["node", "private-runtime", mode, ...flags], adapterFactory: () => adapter, receiptPaths }); return { adapter, receiptPaths, cli }; }
function controlled(capture) { const { phase, ...value } = capture; return value; }
async function actionable(adapter) { return redactCapture(await captureLive(adapter, "actionable"), true); }
function restorationScenario(adapter, scenario) {
  const beginRestore = adapter.beginRestore.bind(adapter), execute = adapter.execute.bind(adapter), loadedPlugins = adapter.loadedPlugins.bind(adapter);
  let restoring = false, reloads = 0;
  adapter.beginRestore = async () => { restoring = true; await beginRestore(); };
  adapter.execute = async (operation) => {
    const result = await execute(operation);
    if (!restoring || !operation.kind.startsWith("reload-")) return result;
    reloads += 1;
    const native = JSON.parse(result.stdout);
    native.plugins[0].authorization = "Bearer private-fixture-secret";
    if ((scenario === "first-fails" && reloads === 1) || (scenario === "second-fails" && reloads === 2)) {
      native.plugins = native.plugins.filter((entry) => entry.id !== operation.pluginId);
    }
    return { ...result, stdout: JSON.stringify(native) };
  };
  if (scenario === "post-compare-fails") adapter.loadedPlugins = async () => {
    const entries = await loadedPlugins();
    if (restoring && reloads === 2) entries[0].loadedApp.bundle.hash = "foreign-restored-app";
    return entries;
  };
}

function sourceFixture(t) {
  const root = mkdtempSync(join(tmpdir(), "context-magnet-source-fence-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (relative, value = relative) => { const pathname = join(root, relative); mkdirSync(dirname(pathname), { recursive: true }); writeFileSync(pathname, value); return pathname; };
  for (const relative of CONTROLLER_SOURCES) put(relative);
  for (const relative of PLUGIN_SOURCE_ROOTS) put(`${relative}/src/entry.ts`);
  return { root, put, file: join(root, `${PLUGIN_SOURCE_ROOTS[0]}/src/entry.ts`) };
}

test("exact source projection catches already-dirty byte edits while Git status stays identical", async (t) => {
  const source = sourceFixture(t), status = { statusCount: 1, statusSha256: "same-porcelain-digest" };
  const read = () => stableProtectedWorkspace(async () => status, async () => ({ head: "same-head", gitlinks: ["same-link"], index: "same-index" }), async () => stableSourceContent(source.root));
  const before = await read();
  assert.equal(before.sourceFileCount, CONTROLLER_SOURCES.length + PLUGIN_SOURCE_ROOTS.length);
  assert.equal(before.sourceDirectoryCount, 4); // both plugin roots and their src directories
  assert.equal(JSON.stringify(before).includes("entry.ts"), false);
  source.put(`${PLUGIN_SOURCE_ROOTS[0]}/src/entry.ts`, "same-path changed bytes");
  const after = await read();
  assert.equal(after.statusSha256, before.statusSha256);
  assert.notEqual(after.sourceSha256, before.sourceSha256);
});

test("source set, mode, empty directories and only exact generated directory exclusions are bound", (t) => {
  const source = sourceFixture(t), before = projectSourceContent(source.root);
  const added = source.put(`${PLUGIN_SOURCE_ROOTS[0]}/new.ts`, "new");
  assert.notEqual(projectSourceContent(source.root).sourceSha256, before.sourceSha256);
  rmSync(added);
  assert.deepEqual(projectSourceContent(source.root), before);
  mkdirSync(join(source.root, PLUGIN_SOURCE_ROOTS[0], "empty"));
  assert.notEqual(projectSourceContent(source.root).sourceSha256, before.sourceSha256);
  rmSync(join(source.root, PLUGIN_SOURCE_ROOTS[0], "empty"), { recursive: true });
  const originalMode = lstatSync(source.file).mode & 0o777;
  chmodSync(source.file, originalMode === 0o600 ? 0o644 : 0o600);
  assert.notEqual(projectSourceContent(source.root).sourceSha256, before.sourceSha256);
  chmodSync(source.file, originalMode);
  assert.deepEqual(projectSourceContent(source.root), before);
  source.put(`${PLUGIN_SOURCE_ROOTS[0]}/dist/output.js`, "generated");
  source.put(`${PLUGIN_SOURCE_ROOTS[0]}/node_modules/package/index.js`, "dependency");
  source.put(`${PLUGIN_SOURCE_ROOTS[0]}/.cache/index`, "cache");
  assert.deepEqual(projectSourceContent(source.root), before);
  source.put(`${PLUGIN_SOURCE_ROOTS[0]}/src/dist/real-source.ts`, "source");
  assert.notEqual(projectSourceContent(source.root).sourceSha256, before.sourceSha256);
});

test("symlinks, per-file race, repeated projection race and all source bounds fail closed", (t) => {
  const source = sourceFixture(t), pluginRoot = join(source.root, PLUGIN_SOURCE_ROOTS[0]);
  const link = join(pluginRoot, "link.ts");
  symlinkSync(source.file, link);
  assert.throws(() => projectSourceContent(source.root), /source symlink/);
  rmSync(link);
  const prior = readFileSync(source.file), originalMode = lstatSync(source.file).mode & 0o777;
  assert.throws(() => projectSourceContent(source.root, { afterFileOpen(relative) { if (relative.toString() === `${PLUGIN_SOURCE_ROOTS[0]}/src/entry.ts`) chmodSync(source.file, originalMode === 0o600 ? 0o644 : 0o600); } }), /source path\/descriptor race/);
  chmodSync(source.file, originalMode);
  let calls = 0;
  projectSourceContent(source.root, { now: () => { calls += 1; return 0; } });
  const firstPassCalls = calls;
  calls = 0;
  assert.throws(() => stableSourceContent(source.root, { now: () => { calls += 1; if (calls === firstPassCalls + 1) writeFileSync(source.file, "changed between full passes"); return 0; } }), /source content changed during read/);
  writeFileSync(source.file, prior);
  for (const [key, limit, pattern] of [["maxFileBytes", 1, /file byte bound/], ["maxFiles", 1, /file count bound/], ["maxDirectories", 1, /directory count bound/], ["maxTotalBytes", 1, /aggregate byte bound/], ["maxPathBytes", 1, /path byte bound/]]) {
    assert.throws(() => projectSourceContent(source.root, { limits: { ...SOURCE_LIMITS, [key]: limit } }), pattern);
  }
  let time = 0;
  assert.throws(() => projectSourceContent(source.root, { now: () => time++, limits: { ...SOURCE_LIMITS, timeoutMs: 1 } }), /time bound/);
});

test("source drift stops activation and restoration dispatch before an operation", async (t) => {
  const source = sourceFixture(t), adapter = fixture(t), originalWorkspace = adapter.protectedWorkspace.bind(adapter);
  adapter.enforceSourceFence = true;
  adapter.protectedWorkspace = async () => ({ ...await originalWorkspace(), ...stableSourceContent(source.root) });
  const preimage = await actionable(adapter);
  source.put(`${PLUGIN_SOURCE_ROOTS[0]}/src/entry.ts`, "changed already-dirty file");
  await assert.rejects(() => activate(adapter, { preimage }), /saved receipt differs/);
  assert.deepEqual(adapter.calls, []);
  source.put(`${PLUGIN_SOURCE_ROOTS[0]}/src/entry.ts`, `${PLUGIN_SOURCE_ROOTS[0]}/src/entry.ts`);
  const beforeSecond = await actionable(adapter), execute = adapter.execute.bind(adapter);
  adapter.execute = async (operation) => { const result = await execute(operation); if (operation.kind === "build-inspector") source.put(`${PLUGIN_SOURCE_ROOTS[0]}/src/entry.ts`, "drift after first dispatch"); return result; };
  const result = await activate(adapter, { preimage: beforeSecond });
  assert.equal(result.ok, false);
  assert.match(result.primaryError, /source content changed/);
  assert.match(result.restorationError, /source content changed/);
  assert.deepEqual(adapter.calls, ["build-inspector"]);
});

test("preactivation and final boundaries reject source drift without dispatch", async (t) => {
  const source = sourceFixture(t), adapter = fixture(t), originalWorkspace = adapter.protectedWorkspace.bind(adapter);
  adapter.enforceSourceFence = true;
  adapter.protectedWorkspace = async () => ({ ...await originalWorkspace(), ...stableSourceContent(source.root) });
  const preimagePath = join(adapter.receiptRoot, "preimage.json"), activationPath = join(adapter.receiptRoot, "activation.json"), rollbackPath = join(adapter.receiptRoot, "final.json");
  await runMode(adapter, "capture-live-preimage", { preimagePath });
  source.put(`${PLUGIN_SOURCE_ROOTS[0]}/src/entry.ts`, "preactivation drift");
  await assert.rejects(() => runMode(adapter, "preactivation", { preimagePath }), /saved receipt differs/);
  assert.deepEqual(adapter.calls, []);
  source.put(`${PLUGIN_SOURCE_ROOTS[0]}/src/entry.ts`, `${PLUGIN_SOURCE_ROOTS[0]}/src/entry.ts`);
  await runMode(adapter, "activate", { preimagePath, activationPath });
  const dispatched = adapter.calls.length;
  source.put(`${PLUGIN_SOURCE_ROOTS[0]}/src/entry.ts`, "final boundary drift");
  await assert.rejects(() => runMode(adapter, "activated-boundary", { activationPath, preimagePath, rollbackPath }), /saved receipt differs/);
  assert.equal(adapter.calls.length, dispatched);
});

test("restoration rechecks source before each reload", async (t) => {
  const source = sourceFixture(t), adapter = fixture(t), originalWorkspace = adapter.protectedWorkspace.bind(adapter);
  adapter.enforceSourceFence = true;
  adapter.protectedWorkspace = async () => ({ ...await originalWorkspace(), ...stableSourceContent(source.root) });
  let restoring = false;
  const beginRestore = adapter.beginRestore.bind(adapter), execute = adapter.execute.bind(adapter);
  adapter.beginRestore = async () => { restoring = true; await beginRestore(); };
  adapter.execute = async (operation) => { const result = await execute(operation); if (restoring && operation.kind === "reload-inspector") source.put(`${PLUGIN_SOURCE_ROOTS[0]}/src/entry.ts`, "drift before second restoration reload"); return result; };
  const result = await activate(adapter, { preimage: await actionable(adapter), proof: async () => { throw new Error("proof failure"); } });
  assert.equal(result.ok, false);
  assert.match(result.primaryError, /proof failure/);
  assert.match(result.restorationError, /source content changed/);
  assert.deepEqual(adapter.calls.slice(-2), ["status-hooks", "reload-inspector"]);
  assert.deepEqual(result.restoration.receipts.map((item) => item.receipt.operation), ["reload-inspector"]);
  assert.deepEqual(result.receipt.rollback.receipts.map((item) => item.operation), ["reload-inspector"]);
  assert.equal(result.receipt.rollback.postRestore, null);
});

test("protected workspace excludes only the fixed new live report in place of obsolete hook receipt", () => {
  const source = readFileSync(new URL("./context-magnet-session-etl-plugin-live-adapter.mjs", import.meta.url), "utf8");
  assert.deepEqual(GENERATED_STATUS_PATHS, [
    "plans/context-magnet-session-etl-plugin-live-preimage.json",
    "plans/context-magnet-session-etl-activation-receipt.json",
    "plans/context-magnet-session-etl-restoration-receipt.json",
    "plans/context-magnet-session-etl-live-proof-report.json",
    "plans/context-magnet-session-etl-plugin-backup/activation-v1.json",
  ]);
  assert.equal(source.includes("context-magnet-session-etl-hook-activation-receipt.json"), false);
});

function fakeGit(t, bytes, { exitCode = 0, script = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), "context-magnet-status-fixture-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pathname = join(root, "status.bin"); writeFileSync(pathname, bytes);
  const children = [];
  const spawnImpl = (executable, argv, options) => {
    assert.equal(executable, "git");
    assert.deepEqual(argv, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    assert.deepEqual(options.stdio, ["ignore", "pipe", "pipe"]);
    const code = script ?? `process.stdout.write(require("node:fs").readFileSync(process.argv[1])); process.exitCode = ${exitCode}`;
    const child = spawn(process.execPath, ["-e", code, pathname], { stdio: options.stdio });
    children.push(child);
    return child;
  };
  return { spawnImpl, children };
}
const statusDigest = (bytes) => createHash("sha256").update("git-status-porcelain-v1-z\0").update(bytes).digest("hex");

test("streamed porcelain over 256 KiB retains ordered status, paths and exact entry count", async (t) => {
  const rows = Array.from({ length: 5000 }, (_, i) => `?? fixture/${String(i).padStart(5, "0")}-${"x".repeat(55)}\0`);
  const body = Buffer.from(rows.join(""));
  assert.ok(body.length > MAX_RECEIPT_BYTES);
  const git = fakeGit(t, body);
  const actual = await streamStatusProjection("/fixture", git);
  assert.deepEqual(actual, { statusCount: rows.length, statusSha256: statusDigest(body) });
  assert.equal(JSON.stringify(actual).includes("fixture/"), false);
  assert.equal(git.children[0].exitCode, 0);
  const changed = fakeGit(t, Buffer.from(rows.slice().reverse().join("")));
  assert.notEqual((await streamStatusProjection("/fixture", changed)).statusSha256, actual.statusSha256);
});

test("only exact generated paths are excluded; rename endpoints and unusual path bytes remain ordered", async (t) => {
  const included = Buffer.from(`?? ${GENERATED_STATUS_PATHS[0]}.near\0 M fixture/line\nname\0R  fixture/new\0fixture/old\0R  fixture/other\0${GENERATED_STATUS_PATHS[0]}\0`);
  const excluded = Buffer.from(`?? ${GENERATED_STATUS_PATHS[0]}\0 M ${GENERATED_STATUS_PATHS[1]}\0`);
  const body = Buffer.concat([excluded, included]);
  const result = await streamStatusProjection("/fixture", fakeGit(t, body));
  assert.deepEqual(result, { statusCount: 4, statusSha256: statusDigest(included) });
  assert.equal(JSON.stringify(result).includes("dirtyPaths"), false);
});

test("pre/post status or independent HEAD, gitlinks and index drift rejects the workspace projection", async (t) => {
  const one = await streamStatusProjection("/fixture", fakeGit(t, Buffer.from("?? fixture/one\0")));
  const two = await streamStatusProjection("/fixture", fakeGit(t, Buffer.from(" M fixture/one\0")));
  const pathChanged = await streamStatusProjection("/fixture", fakeGit(t, Buffer.from("?? fixture/two\0")));
  for (const changed of [two, pathChanged]) {
    let call = 0;
    await assert.rejects(() => stableProtectedWorkspace(async () => [one, changed][call++], async () => ({ head: "head", gitlinks: ["link"], index: "index" })), /changed during read/);
  }
  for (const key of ["head", "gitlinks", "index"]) {
    let call = 0;
    await assert.rejects(() => stableProtectedWorkspace(async () => one, async () => {
      const metadata = { head: "head", gitlinks: ["link"], index: "index" };
      metadata[key] = key === "gitlinks" ? [`link-${call++}`] : `${key}-${call++}`;
      return metadata;
    }), /changed during read/);
  }
  const stable = await stableProtectedWorkspace(async () => one, async () => ({ head: "head", gitlinks: ["link"], index: "index" }));
  assert.deepEqual(stable, { head: "head", gitlinks: ["link"], index: "index", ...one });
});

test("malformed, truncated and oversized porcelain output fails closed", async (t) => {
  for (const body of ["?? no-terminator", "ZZ invalid\0", "?? \0", "R  renamed\0", "?M mixed\0"]) {
    await assert.rejects(() => streamStatusProjection("/fixture", fakeGit(t, Buffer.from(body))), /malformed|truncated/);
  }
  await assert.rejects(() => streamStatusProjection("/fixture", { ...fakeGit(t, Buffer.from("?? very-long-name\0")), maxEntryBytes: 8 }), /entry length bound/);
  await assert.rejects(() => streamStatusProjection("/fixture", { ...fakeGit(t, Buffer.from("?? fixture/one\0")), maxBytes: 5 }), /total byte bound/);
  await assert.rejects(() => streamStatusProjection("/fixture", { ...fakeGit(t, Buffer.from("?? one\0?? two\0")), maxEntries: 1 }), /entry count bound/);
});

test("timed out and nonzero Git fixture processes are retired and rejected", async (t) => {
  const hanging = fakeGit(t, Buffer.alloc(0), { script: "setInterval(() => {}, 1000)" });
  await assert.rejects(() => streamStatusProjection("/fixture", { ...hanging, timeoutMs: 30 }), /timed out/);
  assert.notEqual(hanging.children[0].signalCode, null);
  const failed = fakeGit(t, Buffer.from("?? valid\0"), { exitCode: 7 });
  await assert.rejects(() => streamStatusProjection("/fixture", failed), /git status failed/);
  assert.equal(failed.children[0].exitCode, 7);
});

test("reconstructs the accepted deterministic eight-case private rehearsal", async () => {
  assert.deepEqual(await runFixtureRehearsal(), ["partial-build", "partial-hook", "dual-failure", "proof-stage-drift", "hook-status-drift", "hook-record-drift", "different-prior-hook-rollback", "idempotent-rollback"]);
});

test("attests an exact 17-file router generation while canonical source retains 29 files", async (t) => {
  const adapter = fixture(t), captured = await captureLive(adapter, "test");
  assert.equal(captured.plugins[IDS[0]].status, "running");
  assert.match(captured.plugins[IDS[0]].loadedApp.bundle.hash, /^loaded-context-magnet-inspector-/);
  assert.match(captured.plugins[IDS[0]].dist.server.sha256, /^[a-f0-9]{64}$/);
  assert.notEqual(captured.plugins[IDS[0]].loadedApp.bundle.hash, captured.plugins[IDS[0]].dist.app.sha256);
  assert.equal(Object.keys(captured.router.files).length, 17);
  assert.equal(readdirSync(adapter.canonicalRouterRoot).length, 29);
});

test("all 17 installed router modes may be normalized while canonical bytes and independent modes remain bound", async (t) => {
  const { adapter, receiptPaths, cli } = privateCli(t);
  const names = Object.keys((await captureLive(adapter, "before-normalization")).router.files);
  assert.equal(names.length, 17);
  for (const name of names) {
    chmodSync(join(adapter.scope.routerLibRoot, "versions", adapter.expectedGeneration, name), 0o600);
    chmodSync(join(adapter.canonicalRouterRoot, name), 0o664);
  }
  const prior = await captureLive(adapter, "normalized");
  const active = prior.backup.records.filter((item) => item.target === "router-file");
  assert.equal(active.length, 17);
  for (const item of active) {
    const canonical = prior.router.files[item.relativePath];
    assert.equal(item.mode, 0o600);
    assert.equal(canonical.mode, 0o664);
    assert.equal(canonical.identity.mode, 0o664);
    assert.equal(canonical.byteLength, item.byteLength);
    assert.equal(canonical.sha256, item.sha256);
    assert.deepEqual(readFileSync(join(adapter.canonicalRouterRoot, item.relativePath)), Buffer.from(item.bytesBase64, "base64"));
  }
  assert.equal(readdirSync(adapter.canonicalRouterRoot).length, 29);
  await cli("capture-live-preimage", "--preimage", receiptPaths.preimagePath);
  await cli("preactivation", "--preimage", receiptPaths.preimagePath);
  await cli("activate", "--preimage", receiptPaths.preimagePath, "--activation", receiptPaths.activationPath);
  const restored = await cli("rollback-failure", "--activation", receiptPaths.activationPath, "--rollback", receiptPaths.rollbackPath);
  assert.equal(restored.ok, true);
  assert.deepEqual(controlled(await captureLive(adapter, "restored-normalized")), controlled(prior));
});

test("active and canonical router byte drift fail closed despite independently valid modes", async (t) => {
  const active = fixture(t);
  writeFileSync(join(active.scope.routerLibRoot, "versions", active.expectedGeneration, "router.mjs"), "active byte drift\n");
  await assert.rejects(() => captureLive(active, "active-byte-drift"), /manifest hash mismatch/);

  const canonical = fixture(t);
  writeFileSync(join(canonical.canonicalRouterRoot, "router.mjs"), "canonical byte drift\n");
  await assert.rejects(() => captureLive(canonical, "canonical-byte-drift"), /canonical router byte drift/);
});

test("canonical mode and identity drift after capture reject preactivation without a new receipt", async (t) => {
  const { adapter, receiptPaths, cli } = privateCli(t);
  await cli("capture-live-preimage", "--preimage", receiptPaths.preimagePath);
  const saved = readFileSync(receiptPaths.preimagePath);
  const pathname = join(adapter.canonicalRouterRoot, "router.mjs");
  const priorMode = lstatSync(pathname).mode & 0o777;
  chmodSync(pathname, priorMode === 0o664 ? 0o644 : 0o664);
  assert.deepEqual(readFileSync(pathname), Buffer.from("active:router.mjs\n"));
  await assert.rejects(() => cli("preactivation", "--preimage", receiptPaths.preimagePath), /saved receipt differs/);
  assert.deepEqual(readFileSync(receiptPaths.preimagePath), saved);
  assert.deepEqual(adapter.calls, []);
});

test("unsafe canonical mode and changed active mode reject independently", async (t) => {
  const canonical = fixture(t);
  chmodSync(join(canonical.canonicalRouterRoot, "router.mjs"), 0o666);
  await assert.rejects(() => captureLive(canonical, "unsafe-source-mode"), /unsafe canonical router mode/);

  const { adapter, receiptPaths, cli } = privateCli(t);
  await cli("capture-live-preimage", "--preimage", receiptPaths.preimagePath);
  chmodSync(join(adapter.scope.routerLibRoot, "versions", adapter.expectedGeneration, "router.mjs"), 0o600);
  await assert.rejects(() => cli("preactivation", "--preimage", receiptPaths.preimagePath), /saved receipt differs/);
  assert.deepEqual(adapter.calls, []);
});

test("private native sharedHooksStatus returns and capture compares the complete genuine record", async (t) => {
  const adapter = fixture(t), result = await activate(adapter, { preimage: await actionable(adapter) }); assert.equal(result.ok, true);
  const nativeStatus = await sharedHooksStatus(dirname(adapter.scope.hookPath));
  const adapterStatus = await adapter.hookStatus();
  assert.deepEqual(nativeStatus, adapterStatus);
  const captured = await captureLive(adapter, "native-status");
  assert.deepEqual(captured.hook.status, nativeStatus);
  assert.equal(captured.hook.record.value.formatVersion, 1);
  assert.equal(captured.hook.record.value.grants.length, 3);
  assert.deepEqual(Object.keys(captured.hook.record.value.definitions).sort(), ["PostToolUse", "SessionStart", "UserPromptSubmit"]);
});

test("injectable CLI enforces fixed private paths, exclusive 0600 receipts, and redacted public output", async (t) => {
  const { adapter, receiptPaths, cli } = privateCli(t);
  const capture = await cli("capture-live-preimage", "--preimage", receiptPaths.preimagePath);
  assert.equal(lstatSync(receiptPaths.preimagePath).mode & 0o777, 0o600);
  assert.equal(capture.receipt.actionableLivePreimage, true);
  assert.equal(JSON.stringify(capture).includes("bytesBase64"), false);
  await cli("preactivation", "--preimage", receiptPaths.preimagePath);
  await cli("activate", "--preimage", receiptPaths.preimagePath, "--activation", receiptPaths.activationPath);
  await cli("finalize-success", "--activation", receiptPaths.activationPath, "--rollback", receiptPaths.rollbackPath);
  await cli("activated-boundary", "--preimage", receiptPaths.preimagePath, "--activation", receiptPaths.activationPath, "--rollback", receiptPaths.rollbackPath);
  await assert.rejects(() => cli("capture-live-preimage", "--preimage", receiptPaths.preimagePath), /EEXIST/);
  assert.deepEqual(adapter.calls.slice(0, 6), ["build-inspector", "build-router", "reload-inspector", "reload-router", "install-hooks", "status-hooks"]);
});

test("CLI parser rejects missing, duplicate, foreign, traversal, symlink, and oversized receipt paths before dispatch", async (t) => {
  const { adapter, receiptPaths, cli } = privateCli(t);
  await assert.rejects(() => cli("activate", "--preimage", receiptPaths.preimagePath), /receipt CLI arguments/);
  await assert.rejects(() => cli("preactivation", "--preimage", receiptPaths.preimagePath, "--preimage", receiptPaths.preimagePath), /receipt CLI arguments/);
  await assert.rejects(() => cli("preactivation", "--preimage", join(adapter.receiptRoot, "../preimage.json")), /receipt CLI arguments/);
  await assert.rejects(() => cli("preactivation", "--foreign", receiptPaths.preimagePath), /receipt CLI arguments/);
  const target = join(adapter.receiptRoot, "target.json"); writeFileSync(target, "{}\n", { mode: 0o600 }); symlinkSync(target, receiptPaths.preimagePath);
  await assert.rejects(() => cli("preactivation", "--preimage", receiptPaths.preimagePath), /cannot be opened safely/);
  rmSync(receiptPaths.preimagePath); writeFileSync(receiptPaths.preimagePath, Buffer.alloc(MAX_RECEIPT_BYTES + 1), { mode: 0o600 }); chmodSync(receiptPaths.preimagePath, 0o600);
  await assert.rejects(() => cli("preactivation", "--preimage", receiptPaths.preimagePath), /size bound/);
  assert.deepEqual(adapter.calls, []);
});

test("absent or malformed actionable preimages reject before every executor call in direct engine and CLI routes", async (t) => {
  const direct = fixture(t), absent = join(direct.receiptRoot, "absent.json");
  await assert.rejects(() => activate(direct), /actionable live preimage/);
  await assert.rejects(() => activate(direct, { preimage: null }), /actionable live preimage/);
  assert.deepEqual(direct.calls, []);
  await assert.rejects(() => runMode(direct, "activate", { preimagePath: absent, activationPath: join(direct.receiptRoot, "a.json") }));
  writeFileSync(absent, JSON.stringify({ kind: "context-magnet-plugin-live-receipt/v1", actionableLivePreimage: false }) + "\n", { mode: 0o600 });
  await assert.rejects(() => runMode(direct, "activate", { preimagePath: absent, activationPath: join(direct.receiptRoot, "a.json") }), /actionable live preimage/);
  assert.deepEqual(direct.calls, []);
  const { adapter, receiptPaths, cli } = privateCli(t); writeFileSync(receiptPaths.preimagePath, "{}\n", { mode: 0o600 }); chmodSync(receiptPaths.preimagePath, 0o600);
  await assert.rejects(() => cli("activate", "--preimage", receiptPaths.preimagePath, "--activation", receiptPaths.activationPath), /actionable live preimage/);
  assert.deepEqual(adapter.calls, []);
});

test("finite read and mutation command budgets fail closed before executor mutation", async (t) => {
  const calls = [], runner = (_executable, _argv, options) => { calls.push(options); throw Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }); };
  assert.throws(() => boundedCommand("bb", ["machine", "list", "--json"], "/tmp", READ_COMMAND_TIMEOUT_MS, runner), /timed out/);
  assert.throws(() => boundedCommand("bb", ["plugin", "build"], "/tmp", MUTATING_COMMAND_TIMEOUT_MS, runner), /timed out/);
  assert.deepEqual(calls.map((item) => item.timeout), [READ_COMMAND_TIMEOUT_MS, MUTATING_COMMAND_TIMEOUT_MS]);
  assert.ok(calls.every((item) => item.maxBuffer === MAX_RECEIPT_BYTES));
  const adapter = fixture(t, { readTimeoutAt: "selectedHost" }), preimage = await actionable(adapter);
  await assert.rejects(() => activate(adapter, { preimage }), /timed out/);
  assert.deepEqual(adapter.calls, []);
  assert.equal(existsSync(adapter.backupPath), false);
});

test("large valid saved preimage fails receipt headroom preflight without mutation or backup write", async (t) => {
  const { adapter, receiptPaths, cli } = privateCli(t, { largeLoadedAppBytes: 160 * 1024 });
  await cli("capture-live-preimage", "--preimage", receiptPaths.preimagePath);
  assert.ok(readFileSync(receiptPaths.preimagePath).length < MAX_RECEIPT_BYTES);
  await assert.rejects(() => cli("activate", "--preimage", receiptPaths.preimagePath, "--activation", receiptPaths.activationPath), /receipt lacks 256 KiB headroom/);
  assert.deepEqual(adapter.calls, []);
  assert.equal(existsSync(receiptPaths.backupPath), false);
  assert.equal(existsSync(receiptPaths.activationPath), false);
});

test("near-limit failure receipt keeps bounded primary and restoration errors separately", async (t) => {
  const adapter = fixture(t, { largeLoadedAppBytes: 80 * 1024, failRestoreReload: true });
  const result = await activate(adapter, { preimage: await actionable(adapter), proof: async () => { throw new Error("P".repeat(300 * 1024)); } });
  assert.equal(result.ok, false);
  assert.equal(result.receipt.kind, "context-magnet-plugin-partial-failure-receipt/v1");
  assert.ok(result.primaryError.startsWith("P"));
  assert.ok(result.primaryError.length <= 2048);
  assert.match(result.restorationError, /reload-inspector/);
  assert.ok(Buffer.byteLength(JSON.stringify(result.receipt) + "\n") <= MAX_RECEIPT_BYTES);
});

test("size-realistic backup is separate, verified, 0600, and absent from the compact six-operation receipt", async (t) => {
  const { adapter, receiptPaths, cli } = privateCli(t, { largeDistBytes: 512 * 1024 });
  await cli("capture-live-preimage", "--preimage", receiptPaths.preimagePath);
  await cli("activate", "--preimage", receiptPaths.preimagePath, "--activation", receiptPaths.activationPath);
  const saved = JSON.parse(readFileSync(receiptPaths.activationPath, "utf8"));
  assert.equal(saved.kind, "context-magnet-plugin-activation-receipt/v1");
  assert.equal(saved.backupRef.path, receiptPaths.backupPath);
  assert.equal(saved.backupRef.byteLength, readFileSync(receiptPaths.backupPath).length);
  assert.ok(saved.backupRef.byteLength > MAX_RECEIPT_BYTES);
  assert.ok(readFileSync(receiptPaths.activationPath).length < MAX_RECEIPT_BYTES);
  assert.equal(lstatSync(receiptPaths.backupPath).mode & 0o777, 0o600);
  assert.equal(JSON.stringify(saved).includes("bytesBase64"), false);
  assert.deepEqual(saved.operations.map((item) => item.operation), ["build-inspector", "build-router", "reload-inspector", "reload-router", "install-hooks", "status-hooks"]);
  assert.deepEqual(adapter.calls, saved.operations.map((item) => item.operation));
  await cli("activated-boundary", "--preimage", receiptPaths.preimagePath, "--activation", receiptPaths.activationPath, "--rollback", receiptPaths.rollbackPath);
});

test("receipt write failure after six mutations restores and records a distinct partial failure with reusable rollback reference", async (t) => {
  const { adapter, receiptPaths, cli } = privateCli(t, { receiptWriteFailure: true, priorHook: "present" });
  const before = await captureLive(adapter, "before");
  await cli("capture-live-preimage", "--preimage", receiptPaths.preimagePath);
  const outcome = await cli("activate", "--preimage", receiptPaths.preimagePath, "--activation", receiptPaths.activationPath);
  assert.equal(outcome.ok, false);
  assert.match(outcome.receipt.primaryError, /injected receipt-write failure/);
  const saved = JSON.parse(readFileSync(receiptPaths.activationPath, "utf8"));
  assert.equal(saved.kind, "context-magnet-plugin-partial-failure-receipt/v1");
  assert.match(saved.primaryError, /injected receipt-write failure/);
  assert.equal(saved.restorationError, null);
  assert.equal(saved.operations.length, 6);
  assert.equal(saved.rollback.backupRef.path, receiptPaths.backupPath);
  assert.equal(saved.rollback.attempted, true);
  assert.deepEqual(controlled(await captureLive(adapter, "after")), controlled(before));
  await cli("rollback-failure", "--activation", receiptPaths.activationPath, "--rollback", receiptPaths.rollbackPath);
  assert.equal(JSON.parse(readFileSync(receiptPaths.rollbackPath, "utf8")).kind, "context-magnet-plugin-rollback-receipt/v1");
});

test("partial command prefix supports saved rollback; dual primary/restoration errors stay separate", async (t) => {
  const partial = privateCli(t, { failOperation: "build-router" });
  await partial.cli("capture-live-preimage", "--preimage", partial.receiptPaths.preimagePath);
  const before = await captureLive(partial.adapter, "before");
  assert.equal((await partial.cli("activate", "--preimage", partial.receiptPaths.preimagePath, "--activation", partial.receiptPaths.activationPath)).ok, false);
  const saved = JSON.parse(readFileSync(partial.receiptPaths.activationPath, "utf8"));
  assert.equal(saved.kind, "context-magnet-plugin-partial-failure-receipt/v1");
  assert.deepEqual(saved.operations.map((item) => item.operation), ["build-inspector"]);
  await partial.cli("rollback-failure", "--activation", partial.receiptPaths.activationPath, "--rollback", partial.receiptPaths.rollbackPath);
  assert.deepEqual(controlled(await captureLive(partial.adapter, "post")), controlled(before));
  const replay = await rollbackFailure(partial.adapter, saved);
  assert.equal(replay.restorationError, null);
  assert.deepEqual(partial.adapter.calls.slice(2), ["reload-inspector", "reload-router", "reload-inspector", "reload-router", "reload-inspector", "reload-router"]);
  assert.deepEqual(controlled(await captureLive(partial.adapter, "replayed")), controlled(before));
  const dual = privateCli(t, { failOperation: "install-hooks", failRestoreReload: true });
  await dual.cli("capture-live-preimage", "--preimage", dual.receiptPaths.preimagePath);
  await dual.cli("activate", "--preimage", dual.receiptPaths.preimagePath, "--activation", dual.receiptPaths.activationPath);
  const failed = JSON.parse(readFileSync(dual.receiptPaths.activationPath, "utf8"));
  assert.equal(failed.kind, "context-magnet-plugin-partial-failure-receipt/v1");
  assert.match(failed.primaryError, /install-hooks/);
  assert.match(failed.restorationError, /reload-inspector/);
  assert.deepEqual(failed.operations.map((item) => item.operation), ["build-inspector", "build-router", "reload-inspector", "reload-router"]);
});

test("successful-failure cases restore a fresh complete controlled, loaded, and hook capture", async (t) => {
  for (const options of [{ failOperation: "build-router" }, { failOperation: "install-hooks" }, { statusDrift: true }, { recordDrift: true }, { priorHook: "present" }]) {
    const adapter = fixture(t, options), before = await captureLive(adapter, "before"), result = await activate(adapter, { preimage: await actionable(adapter), proof: options.priorHook ? async () => { throw new Error("proof abort"); } : null });
    assert.equal(result.ok, false); assert.equal(result.restorationError, null); assert.deepEqual(controlled(result.restoration.postRestore), controlled(before));
  }
  const dualAdapter = fixture(t, { failOperation: "install-hooks", failRestoreReload: true }); const dual = await activate(dualAdapter, { preimage: await actionable(dualAdapter) });
  assert.match(dual.primaryError, /install-hooks/); assert.match(dual.restorationError, /reload-inspector/);
});

test("activation failure retains each parsed restoration prefix and requires a fresh complete comparison", async (t) => {
  for (const [scenario, prefix] of [["second-fails", ["reload-inspector"]], ["first-fails", []], ["post-compare-fails", ["reload-inspector", "reload-router"]], ["success", ["reload-inspector", "reload-router"]]]) {
    await t.test(scenario, async (child) => {
      const adapter = fixture(child), before = await captureLive(adapter, "before");
      restorationScenario(adapter, scenario);
      const result = await activate(adapter, { preimage: await actionable(adapter), proof: async () => { throw new Error("primary proof failure"); } });
      assert.equal(result.ok, false);
      assert.equal(result.primaryError, "primary proof failure");
      assert.equal(result.receipt.primaryError, result.primaryError);
      assert.deepEqual(result.restoration.receipts.map((item) => item.receipt.operation), prefix);
      assert.deepEqual(result.receipt.rollback.receipts.map((item) => item.operation), prefix);
      assert.deepEqual(adapter.calls.slice(6), scenario === "first-fails" ? ["reload-inspector"] : ["reload-inspector", "reload-router"]);
      assert.equal(JSON.stringify(result.receipt).includes("private-fixture-secret"), false);
      assert.ok(Buffer.byteLength(JSON.stringify(result.receipt) + "\n") <= MAX_RECEIPT_BYTES);
      if (scenario === "success") {
        assert.equal(result.restorationError, null);
        assert.deepEqual(controlled(result.restoration.postRestore), controlled(before));
        assert.deepEqual(controlled(result.receipt.rollback.postRestore), controlled(redactCapture(before)));
      } else {
        assert.match(result.restorationError, scenario === "post-compare-fails" ? /saved receipt differs/ : /missing the requested installed plugin/);
        assert.equal(result.receipt.restorationError, result.restorationError);
        assert.equal(result.restoration.postRestore, null);
        assert.equal(result.receipt.rollback.postRestore, null);
      }
      assert.deepEqual(result.receipt.operations.map((item) => item.operation), ["build-inspector", "build-router", "reload-inspector", "reload-router", "install-hooks", "status-hooks"]);
      assert.equal(adapter.calls.includes("install-router"), false);
    });
  }
});

test("saved-success rollback retains each parsed restoration prefix and only attests compared state", async (t) => {
  for (const [scenario, prefix] of [["second-fails", ["reload-inspector"]], ["first-fails", []], ["post-compare-fails", ["reload-inspector", "reload-router"]], ["success", ["reload-inspector", "reload-router"]]]) {
    await t.test(scenario, async (child) => {
      const adapter = fixture(child), before = await captureLive(adapter, "before");
      const activated = await activate(adapter, { preimage: await actionable(adapter) });
      assert.equal(activated.ok, true);
      restorationScenario(adapter, scenario);
      const receipt = await rollbackFailure(adapter, activated.receipt, { proofError: "primary proof failure" });
      assert.equal(receipt.primaryError, null);
      assert.equal(receipt.proofError, "primary proof failure");
      assert.deepEqual(receipt.receipts.map((item) => item.operation), prefix);
      assert.deepEqual(adapter.calls.slice(6), scenario === "first-fails" ? ["reload-inspector"] : ["reload-inspector", "reload-router"]);
      assert.equal(JSON.stringify(receipt).includes("private-fixture-secret"), false);
      assert.ok(Buffer.byteLength(JSON.stringify(receipt) + "\n") <= MAX_RECEIPT_BYTES);
      if (scenario === "success") {
        assert.equal(receipt.restorationError, null);
        assert.equal(receipt.restoredIdentity, activated.receipt.backupRef.backupIdentity);
        assert.deepEqual(controlled(receipt.postRollback), controlled(redactCapture(before)));
      } else {
        assert.match(receipt.restorationError, scenario === "post-compare-fails" ? /saved receipt differs/ : /missing the requested installed plugin/);
        assert.ok(receipt.restorationError.length <= 2048);
        assert.equal(receipt.restoredIdentity, null);
        assert.equal(receipt.postRollback, null);
      }
      assert.equal(adapter.calls.includes("install-router"), false);
    });
  }
});

test("router drift blocks rollback writes and full final/boundary receipts bind all six native receipts", async (t) => {
  const drift = fixture(t, { routerDriftAfter: "build-inspector" }), result = await activate(drift, { preimage: await actionable(drift) });
  assert.equal(result.ok, false); assert.match(result.primaryError, /canonical router byte drift/); assert.match(result.restorationError, /canonical router byte drift/); assert.deepEqual(drift.calls, ["build-inspector"]);
  const adapter = fixture(t), preimagePath = join(adapter.receiptRoot, "preimage.json"), activationPath = join(adapter.receiptRoot, "activation.json"), rollbackPath = join(adapter.receiptRoot, "final.json");
  await runMode(adapter, "capture-live-preimage", { preimagePath }); const activation = await runMode(adapter, "activate", { preimagePath, activationPath });
  assert.deepEqual(activation.operations.map((item) => item.operation), ["build-inspector", "build-router", "reload-inspector", "reload-router", "install-hooks", "status-hooks"]);
  await runMode(adapter, "finalize-success", { activationPath, rollbackPath });
  const boundary = await runMode(adapter, "activated-boundary", { activationPath, preimagePath, rollbackPath });
  assert.deepEqual(boundary.plugins, activation.active.plugins); assert.deepEqual(boundary.hook, activation.active.hook); assert.deepEqual(boundary.router, activation.active.router);
});

test("saved six-operation success restores exact prior loaded plugins and hook, with an idempotent replay", async (t) => {
  const { adapter, receiptPaths, cli } = privateCli(t, { priorHook: "present" });
  const prior = await captureLive(adapter, "prior");
  await cli("capture-live-preimage", "--preimage", receiptPaths.preimagePath);
  await cli("activate", "--preimage", receiptPaths.preimagePath, "--activation", receiptPaths.activationPath);
  const saved = JSON.parse(readFileSync(receiptPaths.activationPath, "utf8"));
  assert.equal(saved.kind, "context-magnet-plugin-activation-receipt/v1");
  assert.equal(saved.operations.length, 6);
  const result = await cli("rollback-failure", "--activation", receiptPaths.activationPath, "--rollback", receiptPaths.rollbackPath);
  assert.equal(result.ok, true);
  const rollback = JSON.parse(readFileSync(receiptPaths.rollbackPath, "utf8"));
  assert.equal(rollback.sourceKind, saved.kind);
  assert.equal(rollback.restoredIdentity, saved.backupRef.backupIdentity);
  assert.deepEqual(rollback.receipts.map((receipt) => receipt.operation), ["reload-inspector", "reload-router"]);
  assert.deepEqual(controlled(await captureLive(adapter, "restored")), controlled(prior));
  assert.deepEqual(controlled(rollback.postRollback), controlled(redactCapture(prior)));
  const replay = await rollbackFailure(adapter, saved, { proofError: "proof failed", reviewError: "review failed" });
  assert.equal(replay.restorationError, null);
  assert.equal(replay.proofError, "proof failed");
  assert.equal(replay.reviewError, "review failed");
  assert.deepEqual(adapter.calls.slice(6), ["reload-inspector", "reload-router", "reload-inspector", "reload-router"]);
  assert.deepEqual(controlled(await captureLive(adapter, "replayed")), controlled(prior));
});

test("saved success requires exact active state; malformed and foreign receipts fail before a restore write", async (t) => {
  const { adapter, receiptPaths, cli } = privateCli(t);
  await cli("capture-live-preimage", "--preimage", receiptPaths.preimagePath);
  await cli("activate", "--preimage", receiptPaths.preimagePath, "--activation", receiptPaths.activationPath);
  const saved = JSON.parse(readFileSync(receiptPaths.activationPath, "utf8")), calls = adapter.calls.length;
  const variants = [
    { ...saved, kind: "foreign-activation/v1" },
    { ...saved, operations: saved.operations.slice(0, 5) },
    { ...saved, operations: [saved.operations[1], ...saved.operations.slice(1)] },
    { ...saved, backupRef: { ...saved.backupRef, path: join(adapter.receiptRoot, "foreign/activation-v1.json") } },
    { ...saved, backupRef: { ...saved.backupRef, sha256: "0".repeat(64) } },
    { ...saved, active: { ...saved.active, plugins: { ...saved.active.plugins, [IDS[0]]: { ...saved.active.plugins[IDS[0]], loadedApp: { ...saved.active.plugins[IDS[0]].loadedApp, bundle: { ...saved.active.plugins[IDS[0]].loadedApp.bundle, hash: "foreign" } } } } } },
    { ...saved, before: { ...saved.before, hostId: "host_foreign" } },
  ];
  for (const variant of variants) await assert.rejects(() => rollbackFailure(adapter, variant));
  assert.equal(adapter.calls.length, calls);
  assert.equal(existsSync(receiptPaths.rollbackPath), false);
  rmSync(adapter.scope.hookPath);
  await assert.rejects(() => rollbackFailure(adapter, saved), /active or already restored state differs/);
  assert.equal(adapter.calls.length, calls);
});

test("router drift and malformed partial prefix reject before restoration; dual errors remain distinct", async (t) => {
  const partial = privateCli(t, { failOperation: "install-hooks", failRestoreReload: true });
  await partial.cli("capture-live-preimage", "--preimage", partial.receiptPaths.preimagePath);
  await partial.cli("activate", "--preimage", partial.receiptPaths.preimagePath, "--activation", partial.receiptPaths.activationPath);
  const saved = JSON.parse(readFileSync(partial.receiptPaths.activationPath, "utf8"));
  assert.match(saved.primaryError, /install-hooks/);
  assert.match(saved.restorationError, /reload-inspector/);
  const calls = partial.adapter.calls.length;
  await assert.rejects(() => rollbackFailure(partial.adapter, { ...saved, operations: [saved.operations[1], ...saved.operations.slice(1)] }), /operation prefix/);
  await assert.rejects(() => rollbackFailure(partial.adapter, { ...saved, rollback: { ...saved.rollback, backupRef: { ...saved.rollback.backupRef, backupIdentity: "0".repeat(64) } } }), /backup identity mismatch/);
  assert.equal(partial.adapter.calls.length, calls);
  const result = await rollbackFailure(partial.adapter, saved, { proofError: "proof failure" });
  assert.equal(result.primaryError, saved.primaryError);
  assert.equal(result.activationRestorationError, saved.restorationError);
  assert.equal(result.proofError, "proof failure");
  assert.match(result.restorationError, /reload-inspector/);
  assert.equal(result.postRollback, null);
  const cliFailure = await partial.cli("rollback-failure", "--activation", partial.receiptPaths.activationPath, "--rollback", partial.receiptPaths.rollbackPath);
  assert.equal(cliFailure.ok, false);
  assert.match(cliFailure.receipt.primaryError, /install-hooks/);
  assert.match(cliFailure.receipt.activationRestorationError, /reload-inspector/);
  assert.match(cliFailure.receipt.restorationError, /reload-inspector/);
  const drift = privateCli(t);
  await drift.cli("capture-live-preimage", "--preimage", drift.receiptPaths.preimagePath);
  await drift.cli("activate", "--preimage", drift.receiptPaths.preimagePath, "--activation", drift.receiptPaths.activationPath);
  const success = JSON.parse(readFileSync(drift.receiptPaths.activationPath, "utf8")), beforeDrift = drift.adapter.calls.length;
  writeFileSync(join(drift.adapter.canonicalRouterRoot, "router.mjs"), "foreign router\n");
  await assert.rejects(() => rollbackFailure(drift.adapter, success), /canonical router byte drift/);
  assert.equal(drift.adapter.calls.length, beforeDrift);
  assert.equal(existsSync(drift.receiptPaths.rollbackPath), false);
});
