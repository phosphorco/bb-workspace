#!/usr/bin/env node
/** Inert on import; the rehearsal uses only private fixtures and never writes live receipts. */
import { createHash } from "node:crypto";
import { chmodSync, closeSync, constants, existsSync, fchmodSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, symlinkSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { backupIdentity, captureBackup, createFixtureScope, MAX_ENVELOPE_BYTES, REQUIRED_DIST_OUTPUTS, restoreBackup } from "./context-magnet-session-etl-plugin-backup.mjs";
import { expectedBuildPaths } from "./context-magnet-session-etl-plugin-dispatch.mjs";
import { BACKUP_PATH, IDS, MAX_RECEIPT_BYTES, activate, captureLive, createLiveAdapter, fencedFile, redactCapture, runMode } from "./context-magnet-session-etl-plugin-live-adapter.mjs";

export { createLiveAdapter, runMode } from "./context-magnet-session-etl-plugin-live-adapter.mjs";
const ROOT = "/home/ubuntu/bb", FIXTURE_RECEIPTS = [join(ROOT, "plans/context-magnet-session-etl-plugin-preimage.json"), join(ROOT, "plans/context-magnet-session-etl-plugin-runtime-rehearsal.json")];
const MODES = new Set(["capture-live-preimage", "preactivation", "activate", "rollback-failure", "finalize-success", "activated-boundary"]);
export const PRODUCTION_RECEIPTS = Object.freeze({ preimagePath: join(ROOT, "plans/context-magnet-session-etl-plugin-live-preimage.json"), activationPath: join(ROOT, "plans/context-magnet-session-etl-activation-receipt.json"), rollbackPath: join(ROOT, "plans/context-magnet-session-etl-restoration-receipt.json"), backupPath: BACKUP_PATH });
const sha = (value) => createHash("sha256").update(value).digest("hex");
const put = (pathname, value, mode = 0o644) => { mkdirSync(dirname(pathname), { recursive: true, mode: 0o700 }); writeFileSync(pathname, value, { mode }); chmodSync(pathname, mode); };
const json = (value) => JSON.stringify(value) + "\n";
const fail = (message) => { throw new Error(`plugin-runtime-live-noop-adapter: ${message}`); };

/** Injected private adapter only. Its `loadedApp` mimics bb plugin list, not dist bytes. */
export function createPrivateFixtureAdapter(root, options = {}) {
  const { failOperation = null, failRestoreReload = false, priorHook = "absent", statusDrift = false, recordDrift = false, routerDriftAfter = null, largeDistBytes = 0, largeLoadedAppBytes = 0, readTimeoutAt = null, receiptWriteFailure = false } = options;
  const scope = createFixtureScope(root), canonicalRouterRoot = join(root, "canonical"), runtime = join(root, "runtime"), receiptRoot = join(root, "receipts"); mkdirSync(receiptRoot, { recursive: true, mode: 0o700 });
  put(runtime, "fixture runtime\n", 0o755);
  const host = Object.fromEntries(["router.mjs", "state.mjs", ...Array.from({ length: 15 }, (_, index) => `active-${String(index).padStart(2, "0")}.mjs`)].map((name) => [name, `active:${name}\n`])), files = Object.fromEntries(Object.entries(host).sort(([left], [right]) => left.localeCompare(right)).map(([name, bytes]) => [name, sha(bytes)])), generation = sha(JSON.stringify({ formatVersion: 1, files }));
  const manifest = { formatVersion: 1, digest: generation, files, capabilities: { runtimeExecPath: runtime, runtimeVersion: "fixture", bun: "fixture", sqliteAvailable: true, sqliteError: null } };
  for (const [name, bytes] of Object.entries(host)) { put(join(scope.routerLibRoot, "versions", generation, name), bytes); put(join(canonicalRouterRoot, name), bytes); }
  for (let index = 0; index < 12; index += 1) put(join(canonicalRouterRoot, `canonical-extra-${String(index).padStart(2, "0")}.mjs`), `extra:${index}\n`);
  put(join(scope.routerLibRoot, "versions", generation, "manifest.json"), json(manifest), 0o600); put(join(scope.routerLibRoot, "router-command"), `#!/bin/sh\nexec '${runtime}' '${join(scope.routerLibRoot, "versions", generation, "router.mjs")}' "$@"\n`, 0o700); symlinkSync("router-command", join(scope.routerLibRoot, "router.mjs")); symlinkSync(runtime, join(scope.routerLibRoot, "bun")); mkdirSync(dirname(scope.hookPath), { recursive: true, mode: 0o700 });
  const executable = join(root, "workbench"), otherExecutable = join(root, "other-workbench"); put(executable, "workbench\n", 0o755); put(otherExecutable, "other\n", 0o755);
  const workbench = { executable, version: "fixture", sha256: sha(readFileSync(executable)) }, otherWorkbench = { executable: otherExecutable, version: "other", sha256: sha(readFileSync(otherExecutable)) };
  const hookRecord = (selected) => { const paths = Object.fromEntries(["homeConfigPath", "runtimeDir", "socketPath", "startLockPath", "serverLockPath", "cacheDir"].map((key) => [key, join(root, "hook-paths", key)])), quote = (value) => `'${value}'`, command = [quote(selected.executable), "context hook --harness codex", "--home-config", quote(paths.homeConfigPath), "--runtime-dir", quote(paths.runtimeDir), "--socket", quote(paths.socketPath), "--start-lock", quote(paths.startLockPath), "--server-lock", quote(paths.serverLockPath), "--cache-dir", quote(paths.cacheDir)].join(" "), events = { SessionStart: ["sessionStart", "session_start"], UserPromptSubmit: ["userPromptSubmit", "user_prompt_submit"], PostToolUse: ["postToolUse", "post_tool_use"] }; return { formatVersion: 1, workbench: selected, codex: { executable: join(root, "codex"), version: "fixture-codex" }, paths, definitions: Object.fromEntries(Object.keys(events).map((event) => [event, [{ hooks: [{ type: "command", command, additionalContextLimit: 0 }] }] ])), grants: Object.entries(events).map(([event, [eventName, suffix]]) => ({ event, eventName, key: `/<session-flags>/config.toml:${suffix}:0:0`, currentHash: `sha256:${sha(event)}` })) }; };
  put(join(root, "codex"), "codex\n", 0o755);
  if (priorHook === "present") put(scope.hookPath, json(hookRecord(otherWorkbench)), 0o600); else if (priorHook !== "absent") fail("unknown fixture prior hook");
  const source = (id) => `path:${join(root, "plugins/plugins", id)}`;
  const nativeReloadEntry = (id, status = "running") => {
    const rootDir = join(root, "plugins/plugins", id);
    return { id, source: source(id), rootDir, version: "1.0.0", provenance: "direct", isOrphanedBuiltin: false, publisherLabel: null, sourceDisplay: rootDir, updateState: {}, enabled: status !== "disabled", description: `fixture ${id}`, name: id, screenshots: [], collections: [], icon: null, iconUrl: null, status, statusDetail: null, handlerStats: { count: 0, totalMs: 0, maxMs: 0, errorCount: 0 }, services: [], schedules: [], cliCommand: null, capabilities: [], hasSettings: false, app: { hasApp: true, bundle: { jsUrl: "/fixture/app.js", cssUrl: null, jsBytes: 1, hash: `loaded-${id}-${restoring ? "before" : "after"}`, sdkMajor: 1, sdkVersion: "1.0.0", compatible: true } }, logoUrl: null, logoDarkUrl: null, providerIds: [], icons: {} };
  };
  for (const id of IDS) for (const path of REQUIRED_DIST_OUTPUTS) put(join(scope.pluginRoots[id], path), largeDistBytes && id === IDS[0] && path === "app.js" ? Buffer.alloc(largeDistBytes, 0x61) : `${id}:${path}:before\n`, path.endsWith(".js") ? 0o755 : 0o644);
  const loaded = new Map(IDS.map((id) => [id, { id, source: source(id), status: "running", loadedApp: { hasApp: true, bundle: { hash: `loaded-${id}-before`, jsBytes: 1, sdkMajor: 0, sdkVersion: "fixture", compatible: true, ...(largeLoadedAppBytes && id === IDS[0] ? { fixturePadding: "x".repeat(largeLoadedAppBytes) } : {}) } } }]));
  let failed = false, restoring = false, hookStatusOverride = null, receiptFailed = false, hostReads = 0;
  const calls = [];
  const backupPath = join(receiptRoot, "activation-v1.json");
  const adapter = { scope, hostId: "host_fixture", routerCwd: join(root, "router-home"), canonicalRouterRoot, expectedGeneration: generation, expectedSource: source, calls, workbench, otherWorkbench, receiptRoot, backupPath,
    async selectedHost() { hostReads += 1; if (readTimeoutAt === "selectedHost" && hostReads > 1) throw Object.assign(new Error("fixture read-only command timed out"), { code: "ETIMEDOUT" }); return "host_fixture"; },
    async selectedWorkbench() { return workbench; },
    async loadedPlugins() { return structuredClone([...loaded.values()]); },
    async hookStatus() { if (!existsSync(scope.hookPath)) return { installed: false }; const saved = JSON.parse(readFileSync(scope.hookPath, "utf8")); const selected = hookStatusOverride ?? saved.workbench; return { installed: true, ...saved, workbench: selected, health: { status: "ready" } }; },
    async protectedWorkspace() { return { head: "fixture-head", gitlinks: ["fixture-gitlink"], index: "fixture-index", dirtyPaths: ["fixture-dirty"], statusSha256: "fixture-status" }; },
    async beginRestore() { restoring = true; },
    async writeBackup(pathname, bytes) { if (pathname !== backupPath || bytes.length > MAX_ENVELOPE_BYTES) fail("fixture backup path or size"); put(pathname, bytes, 0o600); },
    async readBackup(pathname) { if (pathname !== backupPath) fail("fixture backup path"); return fencedFile(pathname, "fixture backup", MAX_ENVELOPE_BYTES).bytes; },
    async beforeReceiptWrite(pathname) { if (receiptWriteFailure && pathname.endsWith("activation.json") && calls.length && !receiptFailed) { receiptFailed = true; fail("injected receipt-write failure"); } },
    async writeReceipt(pathname, value) { if (!pathname.startsWith(receiptRoot + "/")) fail("fixture receipt path"); put(pathname, json(value), 0o600); },
    async readReceipt(pathname) { if (!pathname.startsWith(receiptRoot + "/")) fail("fixture receipt path"); return JSON.parse(readFileSync(pathname, "utf8")); },
    async execute(command) { calls.push(command.kind); if ((command.kind === failOperation && !failed && (failed = true)) || (restoring && failRestoreReload && command.kind === "reload-inspector")) return { exitCode: 17, stdout: "", stderr: "fixture failure" }; if (command.kind.startsWith("build-")) { for (const path of REQUIRED_DIST_OUTPUTS) put(join(scope.pluginRoots[command.pluginId], path), `${command.pluginId}:${path}:after\n`, path.endsWith(".js") ? 0o755 : 0o644); return { exitCode: 0, stdout: expectedBuildPaths(command.pluginId).join("\n") + "\n", stderr: "" }; } if (command.kind.startsWith("reload-")) { const prior = loaded.get(command.pluginId); loaded.set(command.pluginId, { ...prior, loadedApp: { ...prior.loadedApp, bundle: { ...prior.loadedApp.bundle, hash: `loaded-${command.pluginId}-${restoring ? "before" : "after"}` } } }); return { exitCode: 0, stdout: json({ ok: true, plugins: [nativeReloadEntry("agentation", "disabled"), nativeReloadEntry(command.pluginId), nativeReloadEntry("tasks")] }), stderr: "" }; } if (command.kind === "install-hooks") { put(scope.hookPath, json(hookRecord(recordDrift ? otherWorkbench : workbench)), 0o600); hookStatusOverride = statusDrift ? otherWorkbench : null; return { exitCode: 0, stdout: json({ installed: true, workbench }), stderr: "" }; } return { exitCode: 0, stdout: json({ installed: true, health: { status: "ready" }, workbench }), stderr: "" }; },
  };
  const execute = adapter.execute; adapter.execute = async (command) => { if (command.kind === "reload-inspector" && failed) restoring = true; const result = await execute(command); if (command.kind === routerDriftAfter) put(join(canonicalRouterRoot, "router.mjs"), "drift\n"); return result; };
  return adapter;
}
function requiresFailure(result, name, restoreError = false) { if (result.ok || !result.primaryError || !result.restoration.attempted || (restoreError ? !result.restorationError : result.restorationError !== null)) fail(`${name} failure semantics`); }
async function actionable(adapter) { return redactCapture(await captureLive(adapter, "fixture-actionable"), true); }
/** Eight stable cases from the accepted rehearsal, entirely in a fresh private root. */
export async function runFixtureRehearsal() {
  const root = mkdtempSync(join(tmpdir(), "context-magnet-live-adapter-"));
  try {
    const report = [];
    for (const [name, options] of [["partial-build", { failOperation: "build-router" }], ["partial-hook", { failOperation: "install-hooks" }], ["dual-failure", { failOperation: "install-hooks", failRestoreReload: true }]]) { const adapter = createPrivateFixtureAdapter(join(root, name), options), before = await captureLive(adapter, "before"); const result = await activate(adapter, { preimage: await actionable(adapter) }); requiresFailure(result, name, name === "dual-failure"); if (!result.restorationError && !sameControlled(result.restoration.postRestore, before)) fail(`${name} restore equality`); report.push(name); }
    const proofAdapter = createPrivateFixtureAdapter(join(root, "proof-stage-drift")), proofBefore = await captureLive(proofAdapter, "before"); const proof = await activate(proofAdapter, { preimage: await actionable(proofAdapter), proof: async () => { throw new Error("proof-stage drift"); } }); requiresFailure(proof, "proof-stage-drift"); if (!sameControlled(proof.restoration.postRestore, proofBefore)) fail("proof restore equality"); report.push("proof-stage-drift");
    for (const [name, options] of [["hook-status-drift", { statusDrift: true }], ["hook-record-drift", { recordDrift: true }]]) { const adapter = createPrivateFixtureAdapter(join(root, name), options), before = await captureLive(adapter, "before"); const result = await activate(adapter, { preimage: await actionable(adapter) }); requiresFailure(result, name); if (!sameControlled(result.restoration.postRestore, before)) fail(`${name} restore equality`); report.push(name); }
    const prior = createPrivateFixtureAdapter(join(root, "different-prior-hook-rollback"), { priorHook: "present" }), priorBefore = await captureLive(prior, "before"); const priorResult = await activate(prior, { preimage: await actionable(prior), proof: async () => { throw new Error("different prior hook rollback proof"); } }); requiresFailure(priorResult, "different-prior-hook-rollback"); if (priorResult.restoration.postRestore?.hook.status.workbench.version !== "other" || !sameControlled(priorResult.restoration.postRestore, priorBefore)) fail("prior hook was not restored"); report.push("different-prior-hook-rollback");
    const idem = createPrivateFixtureAdapter(join(root, "idempotent-rollback")), saved = captureBackup(idem.scope), id = backupIdentity(saved); put(join(idem.scope.pluginRoots[IDS[0]], "app.js"), "drift\n", 0o755); restoreBackup(idem.scope, saved, id); restoreBackup(idem.scope, saved, id); if (backupIdentity(captureBackup(idem.scope)) !== id) fail("idempotent rollback"); report.push("idempotent-rollback");
    return report;
  } finally { rmSync(root, { recursive: true, force: true }); }
}
function sameControlled(left, right) { const { phase: _leftPhase, ...a } = left ?? {}, { phase: _rightPhase, ...b } = right ?? {}; return JSON.stringify(a) === JSON.stringify(b); }
export async function rehearse() { const before = Object.fromEntries(FIXTURE_RECEIPTS.map((path) => [path, sha(readFileSync(path))])); const cases = await runFixtureRehearsal(), after = Object.fromEntries(FIXTURE_RECEIPTS.map((path) => [path, sha(readFileSync(path))])); if (JSON.stringify(before) !== JSON.stringify(after)) fail("fixture-only JSON changed"); process.stdout.write(JSON.stringify({ ok: true, command: "rehearse", liveMutatorsExecuted: false, fixtureOnlyJsonStable: before, cases }, null, 2) + "\n"); }
const FLAGS = Object.freeze({ "capture-live-preimage": ["--preimage"], preactivation: ["--preimage"], activate: ["--preimage", "--activation"], "rollback-failure": ["--activation", "--rollback"], "finalize-success": ["--activation", "--rollback"], "activated-boundary": ["--preimage", "--activation", "--rollback"] });
function parseReceiptArgs(argv, receiptPaths) {
  const mode = argv[2], wanted = FLAGS[mode]; if (!wanted || argv.length !== 3 + wanted.length * 2) fail("receipt CLI arguments");
  const values = {}; for (let index = 0; index < wanted.length; index += 1) { const flag = argv[3 + index * 2], pathname = argv[4 + index * 2]; if (flag !== wanted[index] || typeof pathname !== "string" || pathname !== receiptPaths[{ "--preimage": "preimagePath", "--activation": "activationPath", "--rollback": "rollbackPath" }[flag]]) fail("receipt CLI arguments"); values[flag] = pathname; }
  return { preimagePath: values["--preimage"], activationPath: values["--activation"], rollbackPath: values["--rollback"] };
}
function receiptTransport(adapter, receiptPaths) {
  const allowed = new Set([receiptPaths.preimagePath, receiptPaths.activationPath, receiptPaths.rollbackPath]);
  const check = (pathname) => { if (!allowed.has(pathname)) fail("receipt path is not authorized"); return pathname; };
  const writeExclusive = (pathname, bytes, maximum) => {
    if (!Buffer.isBuffer(bytes) || bytes.length > maximum) fail("saved envelope exceeds bound");
    mkdirSync(dirname(pathname), { recursive: true, mode: 0o700 });
    const parent = lstatSync(dirname(pathname));
    if (!parent.isDirectory() || parent.isSymbolicLink()) fail("saved envelope parent is unsafe");
    let fd;
    try { fd = openSync(pathname, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); fchmodSync(fd, 0o600); for (let offset = 0; offset < bytes.length;) offset += writeSync(fd, bytes, offset, bytes.length - offset); fsyncSync(fd); }
    finally { if (fd !== undefined) closeSync(fd); }
    const found = fencedFile(pathname, "saved envelope", maximum);
    if (found.mode !== 0o600 || !found.bytes.equals(bytes)) fail("saved envelope differs after write");
  };
  return Object.freeze({ ...adapter,
    backupPath: receiptPaths.backupPath,
    async writeReceipt(pathname, value) { check(pathname); await adapter.beforeReceiptWrite?.(pathname); writeExclusive(pathname, Buffer.from(json(value)), MAX_RECEIPT_BYTES); },
    async readReceipt(pathname) { check(pathname); const found = fencedFile(pathname, "receipt", MAX_RECEIPT_BYTES); if (found.mode !== 0o600) fail("receipt mode is not 0600"); try { return JSON.parse(found.bytes.toString("utf8")); } catch { fail("receipt JSON is malformed"); } },
    async writeBackup(pathname, bytes) { if (pathname !== receiptPaths.backupPath) fail("backup path is not authorized"); writeExclusive(pathname, bytes, MAX_ENVELOPE_BYTES); },
    async readBackup(pathname) { if (pathname !== receiptPaths.backupPath) fail("backup path is not authorized"); const found = fencedFile(pathname, "backup", MAX_ENVELOPE_BYTES); if (found.mode !== 0o600) fail("backup mode is not 0600"); return found.bytes; },
  });
}
function publicResult(mode, result) { return { ok: result?.kind !== "context-magnet-plugin-partial-failure-receipt/v1" && !(mode === "rollback-failure" && result?.restorationError), mode, receipt: { kind: result?.kind ?? null, backupIdentity: result?.backupRef?.backupIdentity ?? result?.restoredIdentity ?? result?.backupIdentity ?? result?.activationBackupIdentity ?? null, actionableLivePreimage: result?.actionableLivePreimage === true, primaryError: result?.primaryError ?? null, activationRestorationError: result?.activationRestorationError ?? null, proofError: result?.proofError ?? null, reviewError: result?.reviewError ?? null, restorationError: result?.restorationError ?? null } }; }
/** Injectable CLI parser/router. Tests pass a private adapter and three private allowed receipt paths. */
export async function runCli({ argv, adapterFactory = createLiveAdapter, receiptPaths = PRODUCTION_RECEIPTS } = {}) {
  const mode = argv?.[2]; if (mode === "rehearse" && argv.length === 3) { await rehearse(); return { ok: true, mode }; }
  if (!MODES.has(mode)) fail("usage: node plans/context-magnet-session-etl-plugin-runtime.mjs MODE fixed-receipt-flags");
  const paths = parseReceiptArgs(argv, receiptPaths), result = await runMode(receiptTransport(adapterFactory(), receiptPaths), mode, paths); return publicResult(mode, result);
}
async function main(argv) { const result = await runCli({ argv }); if (result.mode !== "rehearse") process.stdout.write(`${JSON.stringify(result)}\n`); if (!result.ok) process.exitCode = 1; }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
