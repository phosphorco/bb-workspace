/** Plugin-only lifecycle engine. Constructing an adapter is inert. */
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { performance } from "node:perf_hooks";
import { backupIdentity, captureBackup, createLiveScope, parseBackup, restoreBackup, REQUIRED_DIST_OUTPUTS, MAX_ENVELOPE_BYTES } from "./context-magnet-session-etl-plugin-backup.mjs";
import { OPERATION_ORDER, bindReceipt, createOperation, dispatch } from "./context-magnet-session-etl-plugin-dispatch.mjs";

export const IDS = Object.freeze(["context-magnet-inspector", "subscription-router"]);
export const ACTIVE_GENERATION = "afa8a60a14494ff6e69163a63bd72f7860589f5946c7d3f2c1c29972bfc111e6";
export const HOST_ROOT = "/home/ubuntu/bb";
export const CANONICAL_ROUTER_ROOT = join(HOST_ROOT, "plugins/plugins/subscription-router/host");
export const WORKBENCH_RECEIPT = join(HOST_ROOT, "plans/context-magnet-workbench-runtime-receipt.json");
export const MAX_RECEIPT_BYTES = 256 * 1024;
export const READ_COMMAND_TIMEOUT_MS = 30 * 1000;
export const MUTATING_COMMAND_TIMEOUT_MS = 3 * 60 * 1000;
export const STATUS_TIMEOUT_MS = 60 * 1000;
export const MAX_STATUS_BYTES = 64 * 1024 * 1024;
export const MAX_STATUS_ENTRY_BYTES = 16 * 1024;
export const MAX_STATUS_ENTRIES = 500 * 1000;
export const SOURCE_LIMITS = Object.freeze({ maxFileBytes: 8 * 1024 * 1024, maxFiles: 4096, maxDirectories: 4096, maxTotalBytes: 64 * 1024 * 1024, maxPathBytes: 4096, timeoutMs: 60 * 1000 });
export const CONTROLLER_SOURCES = Object.freeze(["plans/context-magnet-session-etl-plugin-runtime.mjs", "plans/context-magnet-session-etl-plugin-live-adapter.mjs", "plans/context-magnet-session-etl-plugin-backup.mjs", "plans/context-magnet-session-etl-plugin-dispatch.mjs"]);
export const PLUGIN_SOURCE_ROOTS = Object.freeze(IDS.map((id) => `plugins/plugins/${id}`));
const SOURCE_CACHE_DIRECTORIES = new Set(["node_modules", ".cache", ".turbo", ".vite", ".parcel-cache", ".next"]);
export const BACKUP_PATH = join(HOST_ROOT, "plans/context-magnet-session-etl-plugin-backup/activation-v1.json");
const HASH = /^[a-f0-9]{64}$/;
const CANONICAL_ROUTER_MODES = new Set([0o600, 0o644, 0o664, 0o700, 0o755, 0o775]);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (message) => { throw new Error(`plugin-live-adapter: ${message}`); };
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const absolute = (value, label) => { if (typeof value !== "string" || !value.startsWith("/") || value.includes("\0") || value.length > 4096) fail(`${label} is not a safe absolute path`); return value; };
function statId(stat) { return { dev: String(stat.dev), ino: String(stat.ino), mode: Number(stat.mode & 0o777n), size: String(stat.size), mtimeNs: String(stat.mtimeNs), ctimeNs: String(stat.ctimeNs), file: stat.isFile(), link: stat.isSymbolicLink() }; }

/** Exact raw-path and byte projection; only the compact result reaches receipts. */
export function projectSourceContent(root = HOST_ROOT, { limits = SOURCE_LIMITS, now = () => performance.now(), afterFileOpen = null } = {}) {
  if (!isAbsolute(root) || root.includes("\0") || root.split("/").some((part) => part === "." || part === "..") ||
      !Object.keys(SOURCE_LIMITS).every((key) => Number.isSafeInteger(limits[key]) && limits[key] > 0 && limits[key] <= SOURCE_LIMITS[key]) || typeof now !== "function") fail("source projection budget or root is invalid");
  const started = now(), hash = createHash("sha256").update("plugin-source-content-v1\0");
  let files = 0, directories = 0, totalBytes = 0;
  const checkTime = () => { if (now() - started > limits.timeoutMs) fail("source projection time bound"); };
  const procChild = (fd, name) => Buffer.concat([Buffer.from(`/proc/self/fd/${fd}/`), name]);
  const id = (stat) => ({ ...statId(stat), mode: Number(stat.mode & 0o7777n), type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other" });
  const assertSame = (expected, actual, label) => { if (!same(id(expected), id(actual))) fail(`source path/descriptor race: ${label}`); };
  const record = (relative, kind, mode, bytes = Buffer.alloc(0)) => {
    checkTime();
    if (relative.length > limits.maxPathBytes) fail("source path byte bound");
    const header = Buffer.alloc(16);
    header.writeBigUInt64BE(BigInt(relative.length), 0);
    header.writeBigUInt64BE(BigInt(bytes.length), 8);
    hash.update(header).update(relative).update(kind).update(Buffer.from([(mode >> 8) & 255, mode & 255])).update(bytes);
  };
  const openDirectory = (pathname) => {
    const descriptors = [openSync("/", constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)];
    const segments = pathname.split("/").filter(Boolean);
    try {
      for (const component of segments) {
        checkTime();
        const path = procChild(descriptors.at(-1), Buffer.from(component));
        const child = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        try { const stat = fstatSync(child, { bigint: true }); if (!stat.isDirectory()) fail("source root is not a directory"); assertSame(stat, lstatSync(path, { bigint: true }), pathname); }
        catch (error) { closeSync(child); throw error; }
        descriptors.push(child);
      }
      return { fd: descriptors.at(-1), closeAndVerify() {
        try { for (let index = descriptors.length - 1; index > 0; index -= 1) {
          const opened = fstatSync(descriptors[index], { bigint: true }), current = lstatSync(procChild(descriptors[index - 1], Buffer.from(segments[index - 1])), { bigint: true });
          if (opened.dev !== current.dev || opened.ino !== current.ino || opened.mode !== current.mode) fail(`source directory path race: ${pathname}`);
        } } finally { for (const opened of descriptors.reverse()) closeSync(opened); }
      } };
    } catch (error) { for (const opened of descriptors.reverse()) closeSync(opened); throw error; }
  };
  const readFile = (parentFd, name, relative) => {
    checkTime();
    const path = procChild(parentFd, name), fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const before = fstatSync(fd, { bigint: true });
      if (!before.isFile()) fail(`source is not an ordinary file: ${relative.toString("utf8")}`);
      assertSame(before, lstatSync(path, { bigint: true }), relative.toString("utf8"));
      if (before.size > BigInt(limits.maxFileBytes)) fail("source file byte bound");
      files += 1; totalBytes += Number(before.size);
      if (files > limits.maxFiles) fail("source file count bound");
      if (totalBytes > limits.maxTotalBytes) fail("source aggregate byte bound");
      if (afterFileOpen) afterFileOpen(relative);
      const bytes = Buffer.alloc(Number(before.size));
      for (let offset = 0; offset < bytes.length;) { checkTime(); const count = readSync(fd, bytes, offset, bytes.length - offset, offset); if (!count) fail("source short read"); offset += count; }
      assertSame(before, fstatSync(fd, { bigint: true }), relative.toString("utf8"));
      assertSame(before, lstatSync(path, { bigint: true }), relative.toString("utf8"));
      record(relative, Buffer.from("f"), Number(before.mode & 0o7777n), bytes);
    } finally { closeSync(fd); }
  };
  const visitDirectory = (parentFd, name, relative, topLevel = false) => {
    checkTime();
    const path = procChild(parentFd, name), fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
      const before = fstatSync(fd, { bigint: true });
      if (!before.isDirectory()) fail("source is not an ordinary directory");
      assertSame(before, lstatSync(path, { bigint: true }), relative.toString("utf8"));
      directories += 1;
      if (directories > limits.maxDirectories) fail("source directory count bound");
      record(relative, Buffer.from("d"), Number(before.mode & 0o7777n));
      const names = readdirSync(`/proc/self/fd/${fd}`, { encoding: "buffer" }).sort(Buffer.compare);
      for (const childName of names) {
        checkTime();
        const childRelative = Buffer.concat([relative, Buffer.from("/"), childName]);
        if (childRelative.length > limits.maxPathBytes) fail("source path byte bound");
        const childPath = procChild(fd, childName), stat = lstatSync(childPath, { bigint: true });
        if (stat.isSymbolicLink()) fail("source symlink encountered");
        const skip = stat.isDirectory() && (SOURCE_CACHE_DIRECTORIES.has(childName.toString("utf8")) || (topLevel && childName.equals(Buffer.from("dist"))));
        if (skip) continue;
        if (stat.isDirectory()) visitDirectory(fd, childName, childRelative);
        else if (stat.isFile()) readFile(fd, childName, childRelative);
        else fail("source special file encountered");
      }
      assertSame(before, fstatSync(fd, { bigint: true }), relative.toString("utf8"));
      assertSame(before, lstatSync(path, { bigint: true }), relative.toString("utf8"));
    } finally { closeSync(fd); }
  };
  try {
    const plans = openDirectory(join(root, "plans"));
    try { for (const relative of [...CONTROLLER_SOURCES].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))) readFile(plans.fd, Buffer.from(relative.slice("plans/".length)), Buffer.from(relative)); }
    finally { plans.closeAndVerify(); }
    const plugins = openDirectory(join(root, "plugins/plugins"));
    try { for (const relative of PLUGIN_SOURCE_ROOTS) visitDirectory(plugins.fd, Buffer.from(relative.slice("plugins/plugins/".length)), Buffer.from(relative), true); }
    finally { plugins.closeAndVerify(); }
    checkTime();
    return Object.freeze({ sourceSha256: hash.digest("hex"), sourceFileCount: files, sourceDirectoryCount: directories, sourceByteCount: totalBytes });
  } catch (error) { if (error?.message?.startsWith("plugin-live-adapter:")) throw error; fail(`source projection failed: ${error.code ?? error.message}`); }
}
export function stableSourceContent(root = HOST_ROOT, options = {}) {
  const before = projectSourceContent(root, options), after = projectSourceContent(root, options);
  if (!same(before, after)) fail("source content changed during read");
  return before;
}

/** Descriptor-first, no-follow read, including a path/descriptor race fence. */
export function fencedFile(pathname, label = pathname, maximum = MAX_RECEIPT_BYTES) {
  let fd;
  try { fd = openSync(pathname, constants.O_RDONLY | constants.O_NOFOLLOW); } catch (error) { fail(`${label} cannot be opened safely: ${error.code ?? "unknown"}`); }
  try { const opened = fstatSync(fd, { bigint: true }), before = lstatSync(pathname, { bigint: true }); if (!opened.isFile() || before.isSymbolicLink() || !same(statId(opened), statId(before)) || opened.size > BigInt(maximum)) fail(`${label} path/descriptor race or size bound`); const bytes = Buffer.alloc(Number(opened.size)); for (let offset = 0; offset < bytes.length;) { const count = readSync(fd, bytes, offset, bytes.length - offset, offset); if (!count) fail(`${label} short read`); offset += count; } const afterFd = fstatSync(fd, { bigint: true }), afterPath = lstatSync(pathname, { bigint: true }); if (!same(statId(opened), statId(afterFd)) || !same(statId(opened), statId(afterPath))) fail(`${label} changed while read`); return Object.freeze({ bytes, sha256: sha(bytes), byteLength: bytes.length, mode: Number(opened.mode & 0o777n), identity: statId(opened) }); } finally { closeSync(fd); }
}
function record(backup, target, relativePath) { const found = backup.records.find((item) => item.target === target && item.relativePath === relativePath); if (!found) fail(`missing backup record ${target}/${relativePath}`); return found; }
function artifacts(backup, id) { return Object.freeze(Object.fromEntries(REQUIRED_DIST_OUTPUTS.map((path) => { const value = record(backup, `plugin:${id}`, path); return [path, Object.freeze({ sha256: value.sha256, byteLength: value.byteLength, mode: value.mode })]; }))); }
function workbench(value) { if (!plain(value) || !absolute(value.executable, "Workbench executable") || typeof value.version !== "string" || !value.version || value.version.length > 1024 || !HASH.test(value.sha256 ?? "")) fail("selected Workbench receipt is malformed"); return Object.freeze({ executable: value.executable, version: value.version, sha256: value.sha256 }); }
function nativeHookRecord(value, phase) {
  if (!plain(value) || Object.keys(value).sort().join(",") !== "codex,definitions,formatVersion,grants,paths,workbench" || value.formatVersion !== 1) fail(`${phase}: hook record format`);
  const wb = workbench(value.workbench), codex = value.codex;
  if (!plain(codex) || !absolute(codex.executable, "Codex executable") || typeof codex.version !== "string" || !codex.version || codex.version.length > 1024) fail(`${phase}: hook Codex receipt`);
  const pathKeys = ["cacheDir", "homeConfigPath", "runtimeDir", "serverLockPath", "socketPath", "startLockPath"];
  if (!plain(value.paths) || Object.keys(value.paths).sort().join(",") !== pathKeys.join(",") || pathKeys.some((key) => !absolute(value.paths[key], `hook path ${key}`))) fail(`${phase}: hook paths`);
  const quote = (text) => `'${text.replaceAll("'", "'\\''")}'`;
  const command = [quote(wb.executable), "context hook --harness codex", "--home-config", quote(value.paths.homeConfigPath), "--runtime-dir", quote(value.paths.runtimeDir), "--socket", quote(value.paths.socketPath), "--start-lock", quote(value.paths.startLockPath), "--server-lock", quote(value.paths.serverLockPath), "--cache-dir", quote(value.paths.cacheDir)].join(" ");
  const events = { SessionStart: ["sessionStart", "session_start"], UserPromptSubmit: ["userPromptSubmit", "user_prompt_submit"], PostToolUse: ["postToolUse", "post_tool_use"] };
  if (!plain(value.definitions) || Object.keys(value.definitions).sort().join(",") !== Object.keys(events).sort().join(",")) fail(`${phase}: hook definitions`);
  for (const event of Object.keys(events)) { const groups = value.definitions[event], hook = groups?.[0]?.hooks?.[0]; if (!Array.isArray(groups) || groups.length !== 1 || Object.keys(groups[0]).join(",") !== "hooks" || !Array.isArray(groups[0].hooks) || groups[0].hooks.length !== 1 || !plain(hook) || Object.keys(hook).sort().join(",") !== "additionalContextLimit,command,type" || hook.type !== "command" || hook.command !== command || hook.additionalContextLimit !== 0) fail(`${phase}: hook definition ${event}`); }
  if (!Array.isArray(value.grants) || value.grants.length !== 3) fail(`${phase}: hook grants`);
  for (const [event, [eventName, suffix]] of Object.entries(events)) { const matches = value.grants.filter((grant) => plain(grant) && grant.event === event); if (matches.length !== 1 || Object.keys(matches[0]).sort().join(",") !== "currentHash,event,eventName,key" || matches[0].eventName !== eventName || matches[0].key !== `/<session-flags>/config.toml:${suffix}:0:0` || !/^sha256:[a-f0-9]{64}$/.test(matches[0].currentHash)) fail(`${phase}: hook grant ${event}`); }
  return Object.freeze(structuredClone(value));
}
function hookState(backup, status, phase) { const saved = record(backup, "hook", "shared-hooks.json"); if (saved.kind === "absent") { if (!same(status, { installed: false })) fail(`${phase}: absent hook status`); return Object.freeze({ state: "absent", status: { installed: false } }); } if (saved.kind !== "regular-file" || saved.byteLength > 64 * 1024) fail(`${phase}: shared hook record is unbounded`); let parsed; try { parsed = JSON.parse(Buffer.from(saved.bytesBase64, "base64").toString("utf8")); } catch { fail(`${phase}: shared hook record JSON`); } const fullRecord = nativeHookRecord(parsed, phase), expected = { installed: true, ...fullRecord, health: { status: "ready" } }; if (!same(status, expected)) fail(`${phase}: authoritative full hook record/status mismatch`); return Object.freeze({ state: "present", record: { sha256: saved.sha256, byteLength: saved.byteLength, mode: saved.mode, value: fullRecord }, status: expected }); }

/** The backup codec proves active generation contains only manifest + 17 files. */
export function attestRouter(adapter, phase, expected = ACTIVE_GENERATION) {
  const backup = captureBackup(adapter.scope);
  if (backup.generation !== expected) fail(`${phase}: router generation drift`);
  const launcher = record(backup, "launcher:router-command", "router-command"), manifest = record(backup, "router-manifest", "manifest.json"), files = backup.records.filter((item) => item.target === "router-file");
  if (files.length !== 17) fail(`${phase}: active router manifest file count`);
  const canonical = {};
  for (const item of files) {
    const current = fencedFile(join(adapter.canonicalRouterRoot, item.relativePath), `${phase}: canonical ${item.relativePath}`, 4 * 1024 * 1024);
    // The installer normalizes active file modes. The backup codec validates
    // those modes; canonical source modes have their own safe allowlist.
    if (!CANONICAL_ROUTER_MODES.has(current.mode)) fail(`${phase}: unsafe canonical router mode: ${item.relativePath}`);
    if (current.sha256 !== item.sha256 || current.byteLength !== item.byteLength || !current.bytes.equals(Buffer.from(item.bytesBase64, "base64"))) fail(`${phase}: canonical router byte drift: ${item.relativePath}`);
    canonical[item.relativePath] = { sha256: current.sha256, byteLength: current.byteLength, mode: current.mode, identity: current.identity };
  }
  return Object.freeze({ generation: backup.generation, launcher: { sha256: launcher.sha256, byteLength: launcher.byteLength, mode: launcher.mode }, manifest: { sha256: manifest.sha256, byteLength: manifest.byteLength, mode: manifest.mode }, files: canonical, backup });
}
export async function captureLive(adapter, phase = "capture") { const router = attestRouter(adapter, phase, adapter.expectedGeneration), hostId = await adapter.selectedHost(), loaded = await adapter.loadedPlugins(); if (typeof hostId !== "string" || !/^host_[a-z0-9]+$/.test(hostId) || !Array.isArray(loaded) || loaded.length !== IDS.length) fail(`${phase}: selected host or loaded plugin receipt count`); const plugins = {}; for (const id of IDS) { const entry = loaded.find((item) => item?.id === id), dist = artifacts(router.backup, id), app = entry?.loadedApp; if (!entry || entry.source !== adapter.expectedSource(id) || entry.status !== "running" || !plain(app) || app.hasApp !== true || !plain(app.bundle) || typeof app.bundle.hash !== "string" || !app.bundle.hash || !Number.isInteger(app.bundle.jsBytes) || app.bundle.jsBytes < 0) fail(`${phase}: native direct-loaded app/source/status receipt mismatch for ${id}`); plugins[id] = Object.freeze({ source: entry.source, status: entry.status, loadedApp: structuredClone(app), dist: { app: dist["app.js"], server: dist["server.js"], artifacts: dist } }); } const selected = workbench(await adapter.selectedWorkbench()), executable = fencedFile(selected.executable, `${phase}: Workbench executable`, 32 * 1024 * 1024); if (executable.sha256 !== selected.sha256) fail(`${phase}: Workbench executable drift`); const hook = hookState(router.backup, await adapter.hookStatus(), phase); const protectedWorkspace = await adapter.protectedWorkspace(); if (!plain(protectedWorkspace)) fail(`${phase}: protected workspace receipt`); sourceIdentity({ protectedWorkspace }, adapter.enforceSourceFence === true); return Object.freeze({ kind: "context-magnet-plugin-live-capture/v1", phase, hostId, router: { generation: router.generation, launcher: router.launcher, manifest: router.manifest, files: router.files }, backup: router.backup, backupIdentity: backupIdentity(router.backup), plugins, hook, workbench: selected, protectedWorkspace }); }
function identity(adapter, capture) { return { hostId: capture.hostId, router: { cwd: adapter.routerCwd, launcher: join(adapter.scope.routerLibRoot, "router-command"), generationDigest: capture.router.generation }, workbench: capture.workbench }; }
function sameRouter(left, right) { return left.generation === right.generation && same(left.launcher, right.launcher) && same(left.manifest, right.manifest) && same(left.files, right.files); }
function sourceIdentity(capture, required = false) {
  const workspace = capture?.protectedWorkspace;
  if (!required && workspace?.sourceSha256 === undefined) return null; // legacy private fixture seam
  const value = { sourceSha256: workspace?.sourceSha256, sourceFileCount: workspace?.sourceFileCount, sourceDirectoryCount: workspace?.sourceDirectoryCount, sourceByteCount: workspace?.sourceByteCount };
  if (!HASH.test(value.sourceSha256 ?? "") || ![value.sourceFileCount, value.sourceDirectoryCount, value.sourceByteCount].every((number) => Number.isSafeInteger(number) && number >= 0)) fail("source content identity is missing or malformed");
  return value;
}
function requireSourceIdentity(adapter, before, current, phase) {
  const prior = sourceIdentity(before, adapter.enforceSourceFence === true), present = sourceIdentity(current, adapter.enforceSourceFence === true);
  if (!same(prior, present)) fail(`${phase}: source content changed`);
}
async function guard(adapter, before, phase) { const current = await captureLive(adapter, phase); requireSourceIdentity(adapter, before, current, phase); if (!sameRouter(current.router, before.router)) fail(`${phase}: router changed`); return current; }
function receiptBinding(value) { if (!plain(value) || value.kind !== "context-magnet-plugin-live-capture/v1") fail("saved live receipt is malformed"); return { hostId: value.hostId, backupIdentity: value.backupIdentity, router: value.router, plugins: value.plugins, hook: value.hook, workbench: value.workbench, protectedWorkspace: value.protectedWorkspace }; }
function receiptBindingAny(value) { if (value?.kind === "context-magnet-plugin-live-receipt/v1") return receiptBinding({ ...value, kind: "context-magnet-plugin-live-capture/v1" }); return receiptBinding(value); }
function requireReceipt(actual, saved, label) { if (!same(receiptBinding(actual), receiptBindingAny(saved))) fail(`${label}: saved receipt differs`); }
export function redactCapture(capture, actionableLivePreimage = false) { return Object.freeze({ kind: "context-magnet-plugin-live-receipt/v1", actionableLivePreimage, ...receiptBinding(capture) }); }
function requireActionablePreimage(value) { if (!plain(value) || value.kind !== "context-magnet-plugin-live-receipt/v1" || value.actionableLivePreimage !== true || "backup" in value) fail("activation: actionable live preimage is absent or malformed"); receiptBindingAny(value); return value; }
async function writeReceipt(adapter, pathname, value) { if (typeof pathname !== "string" || !pathname.startsWith("/") || typeof adapter.writeReceipt !== "function") fail("receipt destination is unavailable"); await adapter.writeReceipt(pathname, value); }
async function readReceipt(adapter, pathname) { if (typeof pathname !== "string" || !pathname.startsWith("/") || typeof adapter.readReceipt !== "function") fail("receipt source is unavailable"); return adapter.readReceipt(pathname); }
function backupReference(value) {
  if (!plain(value) || typeof value.path !== "string" || !value.path.startsWith("/") || !value.path.endsWith("/activation-v1.json") ||
      !Number.isSafeInteger(value.byteLength) || value.byteLength < 1 || value.byteLength > MAX_ENVELOPE_BYTES ||
      !HASH.test(value.sha256 ?? "") || !HASH.test(value.backupIdentity ?? "")) fail("backup reference is malformed");
  return value;
}
function receiptBytes(value) { return Buffer.byteLength(JSON.stringify(value) + "\n"); }
function compactReceipt(value) { if (receiptBytes(value) > MAX_RECEIPT_BYTES) fail("activation receipt exceeds 256 KiB"); return Object.freeze(value); }
function boundedError(error) { const message = error instanceof Error ? error.message : String(error); return message.slice(0, 2048); }
function requireReceiptHeadroom(before) {
  // Both success and restored-failure receipts can carry two redacted captures.
  // Reserve 64 KiB for the fixed six native receipts, backup reference and errors.
  if (receiptBytes(redactCapture(before)) * 2 + 64 * 1024 > MAX_RECEIPT_BYTES) fail("activation: live receipt lacks 256 KiB headroom");
}
async function persistBackup(adapter, backup, expectedIdentity) {
  if (typeof adapter.writeBackup !== "function" || typeof adapter.readBackup !== "function" || !absolute(adapter.backupPath, "backup path")) fail("bounded backup transport is unavailable");
  const parsed = parseBackup(backup), bytes = Buffer.from(JSON.stringify(parsed) + "\n");
  if (bytes.length > MAX_ENVELOPE_BYTES || backupIdentity(parsed) !== expectedIdentity) fail("backup envelope or identity changed");
  await adapter.writeBackup(adapter.backupPath, bytes);
  const reference = Object.freeze({ path: adapter.backupPath, byteLength: bytes.length, sha256: sha(bytes), backupIdentity: expectedIdentity });
  await loadBackup(adapter, reference);
  return reference;
}
async function loadBackup(adapter, reference) {
  backupReference(reference);
  if (reference.path !== adapter.backupPath || typeof adapter.readBackup !== "function") fail("backup path is not selected");
  const bytes = await adapter.readBackup(reference.path);
  if (!Buffer.isBuffer(bytes) || bytes.length !== reference.byteLength || sha(bytes) !== reference.sha256) fail("saved backup bytes differ");
  let parsed;
  try { parsed = parseBackup(bytes); } catch (error) { fail(`saved backup is invalid: ${error.message}`); }
  if (backupIdentity(parsed) !== reference.backupIdentity) fail("saved backup identity differs");
  return parsed;
}
function validateOperations(saved, adapter, mode, complete) {
  const before = receiptBindingAny(saved.before), selected = identity(adapter, before);
  if (!Array.isArray(saved.operations) || (complete && saved.operations.length !== OPERATION_ORDER.length) || saved.operations.length > OPERATION_ORDER.length) fail(`${mode}: operation count`);
  for (let index = 0; index < saved.operations.length; index += 1) {
    const item = saved.operations[index];
    if (!plain(item) || Object.keys(item).sort().join(",") !== "operation,receipt" || item.operation !== OPERATION_ORDER[index] || !plain(item.receipt)) fail(`${mode}: operation prefix`);
    bindReceipt(selected, createOperation(selected, item.operation), item.receipt);
  }
  return before;
}
function validateActivationReceipt(saved, adapter, mode) {
  if (!plain(saved) || saved.kind !== "context-magnet-plugin-activation-receipt/v1" || saved.primaryError !== null || saved.restorationError !== null || "backup" in saved) fail(`${mode}: successful activation receipt required`);
  backupReference(saved.backupRef);
  const before = validateOperations(saved, adapter, mode, true), active = receiptBindingAny(saved.active);
  if (saved.backupRef.backupIdentity !== before.backupIdentity || active.hostId !== before.hostId || !same(active.router, before.router) || active.hook.state !== "present" || !same(active.hook.status.workbench, before.workbench)) fail(`${mode}: activation identity mismatch`);
  return { before: saved.before, active: saved.active };
}
function validateFailureReceipt(saved, adapter) {
  if (!plain(saved) || saved.kind !== "context-magnet-plugin-partial-failure-receipt/v1" || typeof saved.primaryError !== "string" || !saved.primaryError || saved.primaryError.length > 2048 || (saved.restorationError !== null && (typeof saved.restorationError !== "string" || !saved.restorationError || saved.restorationError.length > 2048)) || !plain(saved.rollback) || saved.rollback.attempted !== true || !Array.isArray(saved.rollback.receipts) || saved.rollback.receipts.length > 2 || "backup" in saved) fail("rollback-failure: partial failure receipt required");
  backupReference(saved.rollback?.backupRef);
  const before = validateOperations(saved, adapter, "rollback-failure", false);
  if (saved.rollback.backupRef.backupIdentity !== before.backupIdentity) fail("rollback-failure: backup identity mismatch");
  const selected = identity(adapter, before);
  for (const [index, receipt] of saved.rollback.receipts.entries()) bindReceipt(selected, createOperation(selected, ["reload-inspector", "reload-router"][index]), receipt);
  if (saved.rollback.postRestore !== null && !same(receiptBindingAny(saved.rollback.postRestore), receiptBindingAny(saved.before))) fail("rollback-failure: saved post-restore differs");
  return { before: saved.before, reference: saved.rollback.backupRef, primaryError: saved.primaryError, activationRestorationError: saved.restorationError };
}
function validateRollbackReceipt(saved, adapter) {
  if (saved?.kind === "context-magnet-plugin-activation-receipt/v1") {
    const validated = validateActivationReceipt(saved, adapter, "rollback-failure");
    return { before: validated.before, active: validated.active, reference: saved.backupRef, primaryError: null, activationRestorationError: null };
  }
  if (saved?.kind === "context-magnet-plugin-partial-failure-receipt/v1") return validateFailureReceipt(saved, adapter);
  fail("rollback-failure: foreign activation receipt");
}
async function validateSavedBackup(adapter, before, reference, backup) {
  if (reference.backupIdentity !== before.backupIdentity || backupIdentity(backup) !== before.backupIdentity || backup.generation !== before.router.generation) fail("rollback-failure: saved backup identity mismatch");
  if (await adapter.selectedHost() !== before.hostId || !same(workbench(await adapter.selectedWorkbench()), before.workbench) || !same(await adapter.protectedWorkspace(), before.protectedWorkspace)) fail("rollback-failure: foreign host, Workbench or workspace");
  for (const id of IDS) {
    if (before.plugins?.[id]?.source !== adapter.expectedSource(id) || before.plugins[id].status !== "running" || !same(before.plugins[id].dist.artifacts, artifacts(backup, id))) fail(`rollback-failure: foreign prior plugin ${id}`);
  }
  if (!same(before.hook, hookState(backup, before.hook?.status, "rollback-failure"))) fail("rollback-failure: foreign prior hook");
  const priorRouter = { generation: backup.generation, launcher: record(backup, "launcher:router-command", "router-command"), manifest: record(backup, "router-manifest", "manifest.json") };
  for (const key of ["launcher", "manifest"]) for (const field of ["sha256", "byteLength", "mode"]) if (priorRouter[key][field] !== before.router?.[key]?.[field]) fail("rollback-failure: foreign prior router");
  // Active modes belong to backupIdentity; canonical modes belong to the
  // captured router receipt. Only their exact bytes bind the two sides.
  for (const item of backup.records.filter((entry) => entry.target === "router-file")) for (const field of ["sha256", "byteLength"]) if (item[field] !== before.router?.files?.[item.relativePath]?.[field]) fail("rollback-failure: foreign prior router file");
}
function operationReceipts(operations) { return operations.map((item) => ({ operation: item.operation, receipt: item.receipt })); }
async function restoreFailure(adapter, before, reference, selected, restoration) {
  restoration.attempted = true;
  requireSourceIdentity(adapter, before, { protectedWorkspace: await adapter.protectedWorkspace() }, "before-failure-restore");
  const router = attestRouter(adapter, "before-failure-restore", before.router.generation);
  if (!sameRouter(router, before.router)) fail("before-failure-restore: router changed");
  const backup = await loadBackup(adapter, reference);
  await adapter.beginRestore?.();
  restoreBackup(adapter.scope, backup, reference.backupIdentity);
  for (const kind of ["reload-inspector", "reload-router"]) {
    requireSourceIdentity(adapter, before, { protectedWorkspace: await adapter.protectedWorkspace() }, `before-restore-${kind}`);
    const check = attestRouter(adapter, `before-restore-${kind}`, before.router.generation);
    if (!sameRouter(check, before.router)) fail(`${kind}: router changed`);
    restoration.receipts.push(await dispatch(selected, adapter, createOperation(selected, kind)));
  }
  const postRestore = await guard(adapter, before, "after-failure-restore");
  requireReceipt(postRestore, before, "after-failure-restore");
  restoration.postRestore = postRestore;
  return restoration;
}

/** The only activation mutator. A saved actionable preimage is mandatory even to a direct caller. */
export async function activate(adapter, { inject = null, proof = null, preimage, persistSuccess = null } = {}) {
  requireActionablePreimage(preimage);
  const before = await captureLive(adapter, "before-activation");
  sourceIdentity(before, adapter.enforceSourceFence === true);
  requireReceipt(before, preimage, "activation");
  requireReceiptHeadroom(before);
  const selected = identity(adapter, before), operations = [];
  const reference = await persistBackup(adapter, before.backup, before.backupIdentity);
  let primaryError = null, restorationError = null;
  let restoration = { attempted: false, receipts: [], postRestore: null };
  try {
    for (const kind of OPERATION_ORDER) {
      await guard(adapter, before, `before-${kind}`);
      const result = await dispatch(selected, adapter, createOperation(selected, kind));
      operations.push({ operation: kind, receipt: result.receipt, evidence: result.evidence });
      if (inject === kind) fail(`injected ${kind} failure`);
      await guard(adapter, before, `after-${kind}`);
    }
    const active = await guard(adapter, before, "activated-boundary");
    if (active.hook.state !== "present" || !same(active.hook.status.workbench, selected.workbench)) fail("activated hook does not select Workbench");
    if (proof) await proof({ adapter, active });
    const final = await guard(adapter, before, "finalize-success");
    const receipt = compactReceipt({ kind: "context-magnet-plugin-activation-receipt/v1", before: redactCapture(before), active: redactCapture(final), backupRef: reference, operations: operationReceipts(operations), primaryError: null, restorationError: null });
    validateActivationReceipt(receipt, adapter, "activate");
    if (persistSuccess) await persistSuccess(receipt);
    return Object.freeze({ ok: true, active: true, before, activeCapture: final, operations, backupRef: reference, receipt, primaryError: null, restorationError: null, restoration });
  } catch (error) {
    primaryError = boundedError(error);
    try { await restoreFailure(adapter, before, reference, selected, restoration); }
    catch (restoreError) { restorationError = boundedError(restoreError); }
  }
  const failure = { kind: "context-magnet-plugin-partial-failure-receipt/v1", before: redactCapture(before), operations: operationReceipts(operations), rollback: { backupRef: reference, attempted: restoration.attempted, receipts: restoration.receipts.map((item) => item.receipt), postRestore: restoration.postRestore ? redactCapture(restoration.postRestore) : null }, primaryError, restorationError };
  if (receiptBytes(failure) > MAX_RECEIPT_BYTES) failure.rollback.postRestore = null;
  const receipt = compactReceipt(failure);
  return Object.freeze({ ok: false, active: false, before, operations, backupRef: reference, receipt, primaryError, restorationError, restoration });
}
export async function rollbackFailure(adapter, saved, { proofError = null, reviewError = null } = {}) {
  const validated = validateRollbackReceipt(saved, adapter), { before, reference, primaryError, activationRestorationError } = validated;
  sourceIdentity(before, adapter.enforceSourceFence === true);
  for (const [label, value] of [["proof", proofError], ["review", reviewError]]) if (value !== null && (typeof value !== "string" || !value || value.length > 2048)) fail(`rollback-failure: ${label} error is malformed`);
  const router = attestRouter(adapter, "before-saved-rollback", before.router.generation);
  if (!sameRouter(router, before.router)) fail("before-saved-rollback: router changed");
  const backup = await loadBackup(adapter, reference);
  const immutableRecords = (value) => value.records.filter((item) => item.target !== "hook" && !item.target.startsWith("plugin:"));
  if (!same(backup.scope, router.backup.scope) || !same(immutableRecords(backup), immutableRecords(router.backup))) fail("rollback-failure: router or runtime alias differs from saved backup");
  await validateSavedBackup(adapter, before, reference, backup);
  if (validated.active) {
    const current = await captureLive(adapter, "before-saved-success-rollback");
    if (!same(receiptBinding(current), receiptBindingAny(validated.active)) && !same(receiptBinding(current), receiptBindingAny(saved.before))) fail("before-saved-success-rollback: active or already restored state differs");
  }
  const restoration = { attempted: false, receipts: [], postRestore: null };
  let restorationError = null;
  try { await restoreFailure(adapter, before, reference, identity(adapter, before), restoration); }
  catch (error) { restorationError = boundedError(error); }
  return compactReceipt(Object.freeze({ kind: "context-magnet-plugin-rollback-receipt/v1", attempted: true, sourceKind: saved.kind, restoredIdentity: restoration?.postRestore?.backupIdentity ?? null, receipts: restoration?.receipts.map((item) => item.receipt) ?? [], postRollback: restoration?.postRestore ? redactCapture(restoration.postRestore) : null, primaryError, activationRestorationError, proofError, reviewError, restorationError }));
}
export async function runMode(adapter, mode, options = {}) {
  if (mode === "capture-live-preimage") { const receipt = redactCapture(await captureLive(adapter, mode), true); await writeReceipt(adapter, options.preimagePath, receipt); return receipt; }
  if (mode === "preactivation") { const saved = await readReceipt(adapter, options.preimagePath); requireActionablePreimage(saved); const current = await captureLive(adapter, mode); requireReceipt(current, saved, mode); return redactCapture(current, true); }
  if (mode === "activate") {
    const preimage = await readReceipt(adapter, options.preimagePath);
    requireActionablePreimage(preimage);
    const result = await activate(adapter, { ...options, preimage, persistSuccess: (receipt) => writeReceipt(adapter, options.activationPath, receipt) });
    if (!result.ok) {
      try { await writeReceipt(adapter, options.activationPath, result.receipt); }
      catch (error) { fail(`activation primary error: ${result.primaryError}; restoration error: ${result.restorationError ?? "none"}; partial receipt error: ${error.message}`); }
    }
    return result.receipt;
  }
  if (mode === "rollback-failure") { const saved = await readReceipt(adapter, options.activationPath), receipt = await rollbackFailure(adapter, saved, { proofError: options.proofError ?? null, reviewError: options.reviewError ?? null }); await writeReceipt(adapter, options.rollbackPath, receipt); return receipt; }
  if (["finalize-success", "activated-boundary"].includes(mode)) {
    const saved = await readReceipt(adapter, options.activationPath), validated = validateActivationReceipt(saved, adapter, mode);
    await loadBackup(adapter, saved.backupRef);
    const current = await captureLive(adapter, mode); requireReceipt(current, validated.active, mode);
    if (mode === "finalize-success") await writeReceipt(adapter, options.rollbackPath, Object.freeze({ kind: "context-magnet-plugin-finalization-receipt/v1", active: redactCapture(current), activationBackupIdentity: saved.backupRef.backupIdentity, operations: saved.operations }));
    return redactCapture(current);
  }
  fail("unknown mode");
}

/** The injected runner seam proves finite budgets without launching a host process. */
export function boundedCommand(executable, argv, cwd = HOST_ROOT, timeoutMs = READ_COMMAND_TIMEOUT_MS, runner = execFileSync) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MUTATING_COMMAND_TIMEOUT_MS) fail("command timeout budget is invalid");
  return runner(executable, argv, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: MAX_RECEIPT_BYTES, timeout: timeoutMs });
}
function command(executable, argv, cwd = HOST_ROOT, timeoutMs = READ_COMMAND_TIMEOUT_MS) { return boundedCommand(executable, argv, cwd, timeoutMs); }
function jsonCommand(executable, argv, cwd) { try { return JSON.parse(command(executable, argv, cwd)); } catch { fail(`read-only command failed, timed out, or returned invalid JSON: ${argv.join(" ")}`); } }
export const GENERATED_STATUS_PATHS = Object.freeze(["plans/context-magnet-session-etl-plugin-live-preimage.json", "plans/context-magnet-session-etl-activation-receipt.json", "plans/context-magnet-session-etl-restoration-receipt.json", "plans/context-magnet-session-etl-live-proof-report.json", "plans/context-magnet-session-etl-plugin-backup/activation-v1.json"]);
const STATUS_ARGS = Object.freeze(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
const STATUS_CODES = new Set([32, 77, 65, 68, 82, 67, 85, 84, 63, 33]); // space, M, A, D, R, C, U, T, ?, !

/** Hash raw NUL-delimited porcelain entries in Git order, without retaining the status body. */
export async function streamStatusProjection(cwd = HOST_ROOT, { spawnImpl = spawn, timeoutMs = STATUS_TIMEOUT_MS, maxBytes = MAX_STATUS_BYTES, maxEntryBytes = MAX_STATUS_ENTRY_BYTES, maxEntries = MAX_STATUS_ENTRIES } = {}) {
  if (![timeoutMs, maxBytes, maxEntryBytes, maxEntries].every(Number.isSafeInteger) || timeoutMs < 1 || timeoutMs > STATUS_TIMEOUT_MS || maxBytes < 1 || maxBytes > MAX_STATUS_BYTES || maxEntryBytes < 4 || maxEntryBytes > MAX_STATUS_ENTRY_BYTES || maxEntries < 1 || maxEntries > MAX_STATUS_ENTRIES) fail("status budget is invalid");
  const generated = GENERATED_STATUS_PATHS.map((path) => Buffer.from(path));
  const hash = createHash("sha256").update("git-status-porcelain-v1-z\0");
  let child;
  try { child = spawnImpl("git", STATUS_ARGS, { cwd, stdio: ["ignore", "pipe", "pipe"] }); }
  catch { fail("git status could not start"); }
  if (!child?.stdout || !child?.stderr || typeof child.kill !== "function") fail("git status stream is unavailable");
  let timedOut = false, stderrBytes = 0, stderrOverflow = false, spawnError = null, closed = false;
  const close = new Promise((resolve) => {
    child.once("error", (error) => { spawnError = error; });
    child.once("close", (code, signal) => { closed = true; resolve({ code, signal }); });
  });
  const terminate = () => { if (!closed) child.kill("SIGKILL"); child.stdout.destroy(); child.stderr.destroy(); };
  const timer = setTimeout(() => { timedOut = true; terminate(); }, timeoutMs);
  child.stderr.on("data", (chunk) => { stderrBytes += chunk.length; if (stderrBytes > 64 * 1024) { stderrOverflow = true; terminate(); } });
  const retire = async () => {
    terminate();
    let retirementTimer;
    try { await Promise.race([close, new Promise((_, reject) => { retirementTimer = setTimeout(() => reject(new Error("git status process did not retire")), 5000); })]); }
    finally { clearTimeout(retirementTimer); }
  };
  let bytes = 0, entries = 0, count = 0, fieldParts = [], fieldLength = 0, first = null;
  const isGenerated = (path) => generated.some((item) => item.equals(path));
  const commit = (fields) => {
    entries += 1;
    if (entries > maxEntries) fail("git status entry count bound");
    const paths = fields.length === 1 ? [fields[0].subarray(3)] : [fields[0].subarray(3), fields[1]];
    if (paths.every(isGenerated)) return;
    count += 1;
    for (const field of fields) hash.update(field).update("\0");
  };
  const consume = (field) => {
    if (first !== null) {
      if (field.length === 0 || first.length + field.length > maxEntryBytes) fail("git status malformed or oversized rename path");
      commit([first, field]); first = null; return;
    }
    if (field.length < 4 || field[2] !== 32 || !STATUS_CODES.has(field[0]) || !STATUS_CODES.has(field[1]) || (field[0] === 32 && field[1] === 32)) fail("git status malformed record");
    const special = field[0] === 63 || field[0] === 33 || field[1] === 63 || field[1] === 33;
    if (special && !((field[0] === 63 && field[1] === 63) || (field[0] === 33 && field[1] === 33))) fail("git status malformed status code");
    if (field[0] === 82 || field[0] === 67 || field[1] === 82 || field[1] === 67) first = field;
    else commit([field]);
  };
  try {
    for await (const chunk of child.stdout) {
      bytes += chunk.length;
      if (bytes > maxBytes) fail("git status total byte bound");
      for (let start = 0; start < chunk.length;) {
        const end = chunk.indexOf(0, start);
        const part = chunk.subarray(start, end < 0 ? chunk.length : end);
        fieldLength += part.length;
        if (fieldLength + (first?.length ?? 0) > maxEntryBytes) fail("git status entry length bound");
        if (part.length) fieldParts.push(part);
        if (end < 0) break;
        consume(Buffer.concat(fieldParts, fieldLength));
        fieldParts = []; fieldLength = 0; start = end + 1;
      }
    }
    const result = await close;
    if (timedOut) fail("git status timed out");
    if (spawnError || stderrOverflow || result.code !== 0 || result.signal !== null) fail("git status failed");
    if (fieldLength !== 0 || first !== null) fail("git status truncated record");
    return Object.freeze({ statusCount: count, statusSha256: hash.digest("hex") });
  } catch (error) {
    await retire();
    if (timedOut) fail("git status timed out");
    throw error;
  } finally { clearTimeout(timer); }
}

/** Capture every independent fence twice, rejecting a workspace race. */
export async function stableProtectedWorkspace(readStatus, readMetadata, readSource = async () => ({})) {
  const capture = async () => Object.freeze({ ...await readMetadata(), ...await readStatus(), ...await readSource() });
  const before = await capture(), after = await capture();
  if (!same(before, after)) fail("protected workspace changed during read");
  return before;
}
/** Production construction is deliberately I/O-free. */
export function createLiveAdapter() { const scope = createLiveScope(); const selectedWorkbench = () => { const receipt = JSON.parse(fencedFile(WORKBENCH_RECEIPT, "Workbench receipt", MAX_RECEIPT_BYTES).bytes.toString("utf8")); return workbench({ executable: receipt?.artifact?.path, sha256: receipt?.artifact?.sha256, version: receipt?.identity?.version }); }; return Object.freeze({ scope, enforceSourceFence: true, routerCwd: "/home/ubuntu/.codex-subscription-router", canonicalRouterRoot: CANONICAL_ROUTER_ROOT, expectedGeneration: ACTIVE_GENERATION, expectedSource: (id) => `path:${join(HOST_ROOT, "plugins/plugins", id)}`,
  async selectedHost() { const hosts = jsonCommand("bb", ["machine", "list", "--json"]), candidates = Array.isArray(hosts) ? hosts.filter((item) => item?.name === "bb-machine" && item?.lifecycle?.phase === "active") : []; if (candidates.length !== 1 || typeof candidates[0].id !== "string" || !/^host_[a-z0-9]+$/.test(candidates[0].id)) fail("selected BB host is unavailable or ambiguous"); return candidates[0].id; },
  async selectedWorkbench() { return selectedWorkbench(); },
  async loadedPlugins() { const list = jsonCommand("bb", ["plugin", "list", "--json"]), entries = list?.plugins; if (!Array.isArray(entries)) fail("plugin list receipt"); return IDS.map((id) => { const entry = entries.find((item) => item?.id === id), root = join(HOST_ROOT, "plugins/plugins", id), source = jsonCommand("bb", ["plugin", "source", id, "--json"]); if (!entry || entry.rootDir !== root || entry.source !== `path:${root}` || entry.provenance !== "direct" || entry.status !== "running" || source?.resolved !== `path:${root}`) fail(`direct plugin source/status: ${id}`); return { id, source: entry.source, status: entry.status, loadedApp: entry.app }; }); },
  async hookStatus() { return jsonCommand(join(scope.routerLibRoot, "router-command"), ["hooks", "status"], "/home/ubuntu/.codex-subscription-router"); },
  async protectedWorkspace() { return stableProtectedWorkspace(
    () => streamStatusProjection(HOST_ROOT),
    () => ({ head: command("git", ["rev-parse", "HEAD"], HOST_ROOT).trim(), gitlinks: command("git", ["submodule", "status", "--recursive"], HOST_ROOT).split("\n").filter(Boolean), index: sha(Buffer.from(command("git", ["diff", "--cached", "--raw", "--no-abbrev"], HOST_ROOT))) }),
    () => stableSourceContent(HOST_ROOT),
  ); },
  async execute(operation) { try { return { exitCode: 0, stdout: command(operation.executable, operation.argv, operation.cwd, operation.kind === "status-hooks" ? READ_COMMAND_TIMEOUT_MS : MUTATING_COMMAND_TIMEOUT_MS), stderr: "" }; } catch (error) { return { exitCode: Number.isInteger(error.status) ? error.status : 1, stdout: error.stdout?.toString?.() ?? "", stderr: error.stderr?.toString?.() ?? String(error) }; } },
}); }
