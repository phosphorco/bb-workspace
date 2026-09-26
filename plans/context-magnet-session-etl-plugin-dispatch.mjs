/** Pure, fixture-only command/receipt contract; it never starts a process. */
export const PLUGINS_CWD = "/home/ubuntu/bb/plugins";
export const BB_EXECUTABLE = "bb";
export const MAX_EVIDENCE_BYTES = 64 * 1024;
// The live adapter's execFile maxBuffer is 256 KiB per output stream. Reload
// JSON may be larger than the public evidence window, but never this cap.
export const MAX_NATIVE_RELOAD_BYTES = 256 * 1024;
export const MAX_DIAGNOSTIC_BYTES = 2 * 1024;
export const SHA256 = /^[a-f0-9]{64}$/;
export const OPERATION_ORDER = Object.freeze(["build-inspector", "build-router", "reload-inspector", "reload-router", "install-hooks", "status-hooks"]);

const PLUGINS = Object.freeze(["context-magnet-inspector", "subscription-router"]);
const FIELDS = Object.freeze({
  "build-inspector": ["kind", "pluginId", "executable", "cwd", "argv", "env"], "build-router": ["kind", "pluginId", "executable", "cwd", "argv", "env"],
  "reload-inspector": ["kind", "pluginId", "executable", "cwd", "argv", "env"], "reload-router": ["kind", "pluginId", "executable", "cwd", "argv", "env"],
  "install-hooks": ["kind", "hostId", "executable", "cwd", "argv", "env", "router", "workbench"],
  "status-hooks": ["kind", "hostId", "executable", "cwd", "argv", "env", "router", "workbench"],
});
const fail = (message) => { throw new Error(`context-magnet dispatch: ${message}`); };
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
function keys(value, expected, label) { if (!plain(value)) fail(`${label} must be an object`); const a = Object.keys(value).sort(), e = [...expected].sort(); if (a.length !== e.length || a.some((key, i) => key !== e[i])) fail(`${label} has foreign or missing fields`); }
function string(value, label) { if (typeof value !== "string" || !value.length) fail(`${label} must be a nonempty string`); return value; }
function hash(value, label) { if (typeof value !== "string" || !SHA256.test(value)) fail(`${label} must be a lowercase SHA-256`); return value; }
function absolute(value, label) { if (typeof value !== "string" || !value.startsWith("/") || value.includes("\0") || value.includes("//") || value.split("/").some((part) => part === "." || part === "..")) fail(`${label} must be a contained absolute path`); return value; }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function exact(actual, expected, label) { if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((value, i) => value !== expected[i])) fail(`${label} differs from its exact template`); }
function env(actual, expected) { keys(actual, Object.keys(expected), "environment"); for (const [key, value] of Object.entries(expected)) if (actual[key] !== value) fail("environment differs from its exact template"); }
function pluginFor(kind) { return kind.endsWith("inspector") ? PLUGINS[0] : kind.endsWith("router") ? PLUGINS[1] : null; }

/** Already-attested literals used solely to constrain templates/native output. */
export function validateActivationIdentity(value) {
  keys(value, ["hostId", "router", "workbench"], "activation identity");
  if (typeof value.hostId !== "string" || !/^host_[a-z0-9]+$/.test(value.hostId)) fail("selected host is malformed");
  keys(value.router, ["cwd", "generationDigest", "launcher"], "router identity"); absolute(value.router.cwd, "router cwd"); absolute(value.router.launcher, "router launcher"); hash(value.router.generationDigest, "router generation");
  keys(value.workbench, ["executable", "sha256", "version"], "Workbench identity"); absolute(value.workbench.executable, "Workbench executable"); hash(value.workbench.sha256, "Workbench hash"); string(value.workbench.version, "Workbench version");
  return Object.freeze(structuredClone(value));
}
export function expectedBuildPaths(pluginId) {
  if (!PLUGINS.includes(pluginId)) fail("plugin is foreign");
  return Object.freeze(["server.js", "server.js.map", "server.meta.json", "app.js", "app.css", "app.meta.json"].map((file) => `plugins/${pluginId}/dist/${file}`));
}
export function createOperation(identity, kind) {
  const selected = validateActivationIdentity(identity); if (!OPERATION_ORDER.includes(kind)) fail("operation is not allowlisted"); const pluginId = pluginFor(kind);
  if (kind.startsWith("build-")) return Object.freeze({ kind, pluginId, executable: BB_EXECUTABLE, cwd: PLUGINS_CWD, argv: ["plugin", "build", `./plugins/${pluginId}`], env: {} });
  if (kind.startsWith("reload-")) return Object.freeze({ kind, pluginId, executable: BB_EXECUTABLE, cwd: PLUGINS_CWD, argv: ["plugin", "reload", pluginId, "--json"], env: {} });
  return Object.freeze({ kind, hostId: selected.hostId, executable: selected.router.launcher, cwd: selected.router.cwd, argv: kind === "install-hooks" ? ["hooks", "install", "--workbench", selected.workbench.executable] : ["hooks", "status"], env: { CODEX_SUBSCRIPTION_ROUTER_HOME: selected.router.cwd }, router: selected.router, workbench: selected.workbench });
}
export function validateOperation(identity, operation) {
  const selected = validateActivationIdentity(identity); if (!plain(operation) || typeof operation.kind !== "string" || !OPERATION_ORDER.includes(operation.kind)) fail("operation is malformed or not allowlisted");
  keys(operation, FIELDS[operation.kind], `${operation.kind} operation`); const expected = createOperation(selected, operation.kind);
  if (operation.executable !== expected.executable || operation.cwd !== expected.cwd) fail("executable or cwd is foreign"); exact(operation.argv, expected.argv, "argv"); env(operation.env, expected.env);
  if ("pluginId" in expected && operation.pluginId !== expected.pluginId) fail("plugin is foreign"); if ("hostId" in expected && operation.hostId !== expected.hostId) fail("host is foreign");
  if ("router" in expected && !same(operation.router, expected.router)) fail("router identity is foreign"); if ("workbench" in expected && !same(operation.workbench, expected.workbench)) fail("Workbench identity is foreign"); return expected;
}
function byteLength(value, label) { if (typeof value !== "string") fail(`${label} must be a string`); return Buffer.byteLength(value, "utf8"); }
function bounded(value, label) { const bytes = byteLength(value, label); return { bytes: Math.min(bytes, MAX_EVIDENCE_BYTES), truncated: bytes > MAX_EVIDENCE_BYTES }; }
function diagnostic(value) { return Object.freeze({ bytes: value.bytes, truncated: value.truncated, classification: value.bytes === 0 ? "none" : "command-diagnostic" }); }
/** Public evidence is metadata-only; it never retains executor stdout or stderr. */
export function captureEvidence(result) { keys(result, ["exitCode", "stderr", "stdout"], "executor result"); if (!Number.isInteger(result.exitCode) || result.exitCode < 0 || result.exitCode > 255) fail("executor exit code is malformed"); const stdout = bounded(result.stdout, "executor stdout"), stderr = bounded(result.stderr, "executor stderr"); return Object.freeze({ exitCode: result.exitCode, evidence: Object.freeze({ exitCode: result.exitCode, stdout: Object.freeze({ bytes: stdout.bytes, truncated: stdout.truncated }), stderr: diagnostic(stderr) }) }); }
function json(raw, label) { let value; try { value = JSON.parse(raw); } catch { fail(`${label} is not JSON`); } if (!plain(value)) fail(`${label} must be a JSON object`); return value; }
/** bb plugin build emits six relative paths, not a JSON/hash receipt. */
export function parseBuildReceipt(operation, raw) { const expected = expectedBuildPaths(operation.pluginId); if (typeof raw !== "string" || raw.includes("\0")) fail("build stdout is malformed"); const lines = raw.endsWith("\n") ? raw.slice(0, -1).split("\n") : raw.split("\n"); exact(lines, expected, "build stdout paths"); return Object.freeze({ operation: operation.kind, pluginId: operation.pluginId, distPaths: expected }); }
/** An id-scoped reload returns the full installed list; retain only the target ID. */
export function parseReloadReceipt(operation, raw) {
  if (byteLength(raw, "reload stdout") > MAX_NATIVE_RELOAD_BYTES) fail("reload stdout exceeds the native command cap");
  const value = json(raw, "reload stdout");
  if (value.ok !== true || !Array.isArray(value.plugins)) fail("reload response is not successful plugin JSON");
  const seen = new Set();
  let target = null;
  for (const entry of value.plugins) {
    if (!plain(entry) || typeof entry.id !== "string" || !entry.id.length) fail("reload response contains a malformed installed plugin");
    if (seen.has(entry.id)) fail("reload response contains a duplicate installed plugin");
    seen.add(entry.id);
    if (entry.id === operation.pluginId) target = entry;
  }
  if (!target) fail("reload response is missing the requested installed plugin");
  if (target.status !== "running") fail("reload response requested plugin is not running");
  return Object.freeze({ operation: operation.kind, pluginId: operation.pluginId });
}
/** Shared-hook records are projected to selected Workbench fields only. */
export function parseHooksReceipt(identity, operation, raw) { const value = json(raw, "hooks stdout"); if (value.installed !== true || !plain(value.workbench)) fail("hooks record is not installed"); const workbench = value.workbench; if (workbench.executable !== identity.workbench.executable || workbench.version !== identity.workbench.version || workbench.sha256 !== identity.workbench.sha256) fail("hooks record does not bind the selected Workbench"); if (operation.kind === "status-hooks" && (!plain(value.health) || value.health.status !== "ready")) fail("hooks status is not ready"); return Object.freeze({ operation: operation.kind, installed: true, workbench: Object.freeze({ executable: workbench.executable, version: workbench.version, sha256: workbench.sha256 }), ...(operation.kind === "status-hooks" ? { health: "ready" } : {}) }); }
export function parseReceipt(identity, operation, rawStdout) { const command = validateOperation(identity, operation); if (command.kind.startsWith("reload-")) return parseReloadReceipt(command, rawStdout); if (byteLength(rawStdout, "command stdout") > MAX_EVIDENCE_BYTES) fail("command stdout exceeds the evidence bound"); if (command.kind.startsWith("build-")) return parseBuildReceipt(command, rawStdout); return parseHooksReceipt(identity, command, rawStdout); }
export function bindReceipt(identity, operation, receipt) { const command = validateOperation(identity, operation); if (!plain(receipt) || receipt.operation !== command.kind) fail("receipt belongs to a different operation"); if (command.kind.startsWith("build-") && (receipt.pluginId !== command.pluginId || !same(receipt.distPaths, expectedBuildPaths(command.pluginId)))) fail("build receipt paths do not bind the requested plugin"); if (command.kind.startsWith("reload-") && receipt.pluginId !== command.pluginId) fail("reload receipt does not bind the requested plugin"); if (command.kind.includes("hooks") && (!same(receipt.workbench, identity.workbench) || receipt.installed !== true || (command.kind === "status-hooks" && receipt.health !== "ready"))) fail("hooks receipt does not bind the selected ready Workbench"); return Object.freeze(receipt); }
export async function dispatch(identity, executor, operation) { const command = validateOperation(identity, operation); if (!executor || typeof executor.execute !== "function") fail("executor must expose execute(command)"); const result = await executor.execute(command), captured = captureEvidence(result); if (captured.exitCode !== 0) { const error = new Error(`context-magnet dispatch: ${command.kind} failed with exit ${captured.exitCode}`); error.operation = command.kind; error.evidence = captured.evidence; throw error; } return Object.freeze({ command, evidence: captured.evidence, receipt: bindReceipt(identity, command, parseReceipt(identity, command, result.stdout)) }); }
export function validateSequence(operations) { if (!Array.isArray(operations) || operations.length !== OPERATION_ORDER.length || operations.some((operation, index) => operation?.kind !== OPERATION_ORDER[index])) fail("activation sequence is not the required order"); return true; }
export async function dispatchSequence(identity, executor, operations = OPERATION_ORDER.map((kind) => createOperation(identity, kind))) { validateSequence(operations); const planned = operations.map((operation) => validateOperation(identity, operation)); const results = []; for (const command of planned) results.push(await dispatch(identity, executor, command)); return Object.freeze(results); }
