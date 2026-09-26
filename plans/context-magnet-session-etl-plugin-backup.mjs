import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fchmodSync,
  fsyncSync,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readSync,
  readlinkSync,
  renameSync,
  symlinkSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const BACKUP_KIND = "context-magnet-plugin-backup";
export const BACKUP_VERSION = 1;
export const MAX_RECORDS = 80;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
export const MAX_ENVELOPE_BYTES = 48 * 1024 * 1024;
export const REQUIRED_DIST_OUTPUTS = Object.freeze([
  "app.css",
  "app.js",
  "app.meta.json",
  "server.js",
  "server.js.map",
  "server.meta.json",
]);
const ids = ["context-magnet-inspector", "subscription-router"];
const sha = /^[0-9a-f]{64}$/;
const safe = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const modes = new Set([0o600, 0o644, 0o700, 0o755]);
const pluginDistModes = new Set([...modes, 0o664]);
const MAX_GENERATIONS = 32;
const MAX_GENERATION_FILES = 32;

function fail(message) {
  throw new Error("backup-v1: " + message);
}
function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
function keys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort(),
    wanted = [...expected].sort();
  return (
    actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
  );
}
function name(value) {
  return typeof value === "string" && safe.test(value);
}
function path(value) {
  return typeof value === "string" && value.split("/").every(name);
}
function mode(stat) {
  return Number(stat.mode & 0o777n);
}
function same(left, right) {
  return (
    left.dev === right.dev && left.ino === right.ino && left.mode === right.mode &&
    left.size === right.size && left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs && left.isFile() === right.isFile() &&
    left.isSymbolicLink() === right.isSymbolicLink()
  );
}
function fixtureScope(root) {
  return {
    kind: "fixture",
    fixtureRoot: resolve(root),
    pluginRoots: Object.fromEntries(
      ids.map((id) => [id, resolve(root, "plugins", "plugins", id, "dist")]),
    ),
    routerLibRoot: resolve(root, "router-lib"),
    hookPath: resolve(root, "hooks", "shared-hooks.json"),
  };
}
export function createFixtureScope(root) {
  if (!isAbsolute(root)) fail("fixture root");
  return fixtureScope(root);
}
export function createLiveScope() {
  return {
    kind: "live",
    fixtureRoot: null,
    pluginRoots: Object.fromEntries(
      ids.map((id) => [id, "/home/ubuntu/bb/plugins/plugins/" + id + "/dist"]),
    ),
    routerLibRoot: "/home/ubuntu/.codex-subscription-router/lib",
    hookPath: "/home/ubuntu/.codex-subscription-router/shared-hooks.json",
  };
}
export function validateScope(scope) {
  if (
    !keys(scope, [
      "kind",
      "fixtureRoot",
      "pluginRoots",
      "routerLibRoot",
      "hookPath",
    ]) ||
    !keys(scope.pluginRoots, ids)
  )
    fail("scope shape");
  const expected =
    scope.kind === "live" && scope.fixtureRoot === null
      ? createLiveScope()
      : scope.kind === "fixture" && isAbsolute(scope.fixtureRoot)
        ? fixtureScope(scope.fixtureRoot)
        : fail("scope kind");
  for (const id of ids)
    if (scope.pluginRoots[id] !== expected.pluginRoots[id]) fail("plugin root");
  if (
    scope.routerLibRoot !== expected.routerLibRoot ||
    scope.hookPath !== expected.hookPath
  )
    fail("router root");
  return expected;
}
function lstat(pathname) {
  try {
    return lstatSync(pathname, { bigint: true });
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
function directory(pathname) {
  const stat = lstat(pathname);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory())
    fail("unsafe directory: " + pathname);
  return stat;
}
function file(pathname, hooks = {}, allowedModes = modes) {
  let fd;
  try {
    fd = openSync(pathname, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    fail("open failed: " + pathname + " (" + (error.code ?? "unknown") + ")");
  }
  try {
    const before = fstatSync(fd, { bigint: true });
    if (
      !before.isFile() ||
      before.size > BigInt(MAX_FILE_BYTES) ||
      !allowedModes.has(mode(before))
    )
      fail("unsafe file: " + pathname);
    hooks.afterOpen?.(pathname);
    const bytes = Buffer.alloc(Number(before.size));
    for (let offset = 0; offset < bytes.length; ) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count) fail("short read");
      offset += count;
    }
    const after = fstatSync(fd, { bigint: true }),
      current = lstatSync(pathname, { bigint: true });
    if (
      current.isSymbolicLink() ||
      !current.isFile() ||
      !same(before, after) ||
      !same(after, current) ||
      before.size !== after.size ||
      after.size !== current.size
    )
      fail("race witness: " + pathname);
    return { bytes, mode: mode(before) };
  } finally {
    closeSync(fd);
  }
}
function symlink(pathname, target, hooks = {}) {
  const before = lstatSync(pathname, { bigint: true });
  if (!before.isSymbolicLink()) fail("expected symlink: " + pathname);
  const actual = readlinkSync(pathname, "utf8");
  hooks.afterReadlink?.(pathname);
  const after = lstatSync(pathname, { bigint: true });
  if (!after.isSymbolicLink() || !same(before, after))
    fail("symlink race: " + pathname);
  if (
    actual !== target ||
    isAbsolute(actual) ||
    actual.includes("/") ||
    actual === "." ||
    actual === ".."
  )
    fail("unsafe symlink target: " + pathname);
  return actual;
}
function absoluteSymlink(pathname, hooks = {}) {
  const before = lstatSync(pathname, { bigint: true });
  if (!before.isSymbolicLink()) fail("expected runtime symlink: " + pathname);
  const target = readlinkSync(pathname, "utf8");
  hooks.afterReadlink?.(pathname);
  const after = lstatSync(pathname, { bigint: true });
  if (!after.isSymbolicLink() || !same(before, after)) fail("symlink race: " + pathname);
  if (!isAbsolute(target) || target !== resolve(target) || target.includes("\0")) fail("unsafe runtime target");
  return target;
}
function regularNames(root, limit) {
  directory(root);
  const entries = readdirSync(root, "utf8").sort();
  if (!entries.length || entries.length > limit) fail("directory entry bound");
  const folded = new Set();
  for (const entry of entries) {
    const stat = lstatSync(join(root, entry), { bigint: true });
    if (
      !name(entry) ||
      folded.has(entry.toLowerCase()) ||
      stat.isSymbolicLink() ||
      !stat.isFile()
    )
      fail("non-regular or duplicate entry");
    folded.add(entry.toLowerCase());
  }
  return entries;
}
function generationRoot(scope, generation) {
  if (!sha.test(generation)) fail("generation digest");
  return join(scope.routerLibRoot, "versions", generation);
}
function generations(scope) {
  const root = join(scope.routerLibRoot, "versions");
  directory(root);
  const entries = readdirSync(root, "utf8").sort();
  if (!entries.length || entries.length > MAX_GENERATIONS)
    fail("generation count");
  for (const entry of entries) {
    const stat = lstatSync(join(root, entry), { bigint: true });
    if (!sha.test(entry) || stat.isSymbolicLink() || !stat.isDirectory())
      fail("generation entry");
  }
  return entries;
}
function manifest(bytes, generation) {
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("manifest JSON");
  }
  if (
    !keys(parsed, ["formatVersion", "digest", "files", "capabilities"]) ||
    parsed.formatVersion !== 1 ||
    parsed.digest !== generation ||
    !parsed.files ||
    typeof parsed.files !== "object" ||
    Array.isArray(parsed.files) ||
    !parsed.capabilities ||
    typeof parsed.capabilities !== "object" ||
    Array.isArray(parsed.capabilities)
  )
    fail("manifest shape");
  const capabilities = parsed.capabilities;
  if (
    !keys(capabilities, ["runtimeExecPath", "runtimeVersion", "bun", "sqliteAvailable", "sqliteError"]) ||
    !isAbsolute(capabilities.runtimeExecPath) || capabilities.runtimeExecPath !== resolve(capabilities.runtimeExecPath) ||
    typeof capabilities.runtimeVersion !== "string" || !capabilities.runtimeVersion ||
    typeof capabilities.bun !== "string" || !capabilities.bun ||
    typeof capabilities.sqliteAvailable !== "boolean" ||
    !(capabilities.sqliteError === null || typeof capabilities.sqliteError === "string") ||
    [capabilities.runtimeExecPath, capabilities.runtimeVersion, capabilities.bun, capabilities.sqliteError ?? ""].some((v) => Buffer.byteLength(v) > 4096)
  )
    fail("capabilities");
  const entries = Object.entries(parsed.files).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  if (
    !entries.length ||
    entries.length > MAX_GENERATION_FILES ||
    entries.some(([key, value]) => !name(key) || !sha.test(value)) ||
    new Set(entries.map(([key]) => key.toLowerCase())).size !== entries.length
  )
    fail("manifest entries");
  if (
    hash(
      Buffer.from(
        JSON.stringify({
          formatVersion: 1,
          files: Object.fromEntries(entries),
        }),
      ),
    ) !== generation
  )
    fail("manifest digest");
  return { files: new Map(entries), capabilities };
}
function record(target, relativePath, kind, details = {}) {
  if (kind === "absent")
    return {
      target,
      relativePath,
      kind,
      present: false,
      mode: null,
      byteLength: 0,
      sha256: null,
      bytesBase64: null,
      linkTarget: null,
    };
  if (kind === "relative-symlink")
    return {
      target,
      relativePath,
      kind,
      present: true,
      mode: null,
      byteLength: 0,
      sha256: null,
      bytesBase64: null,
      linkTarget: "router-command",
    };
  if (kind === "absolute-symlink")
    return { target, relativePath, kind, present: true, mode: null, byteLength: 0,
      sha256: null, bytesBase64: null, linkTarget: details.linkTarget };
  return {
    target,
    relativePath,
    kind: "regular-file",
    present: true,
    mode: details.mode,
    byteLength: details.bytes.length,
    sha256: hash(details.bytes),
    bytesBase64: details.bytes.toString("base64"),
    linkTarget: null,
  };
}
function b64(value, length) {
  return (
    typeof value === "string" &&
    value.length === Math.ceil(length / 3) * 4 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  );
}
function shellString(text, offset) {
  if (text[offset] !== "'") fail("launcher quoting");
  let value = "",
    index = offset + 1;
  while (index < text.length) {
    if (text.startsWith("'\"'\"'", index)) {
      value += "'";
      index += 5;
    } else if (text[index] === "'") return { value, next: index + 1 };
    else {
      value += text[index];
      index += 1;
    }
  }
  fail("launcher quoting");
}
function launcher(bytes, scope) {
  const text = bytes.toString("utf8"),
    prefix = "#!/bin/sh\nexec ";
  if (!Buffer.from(text, "utf8").equals(bytes) || !text.startsWith(prefix))
    fail("launcher grammar");
  const runtime = shellString(text, prefix.length);
  if (text[runtime.next] !== " ") fail("launcher grammar");
  const router = shellString(text, runtime.next + 1);
  if (text.slice(router.next) !== ' "$@"\n' || !isAbsolute(runtime.value))
    fail("launcher grammar");
  const match = router.value.match(
    /^(.*\/versions\/)([a-f0-9]{64})(\/router\.mjs)$/,
  );
  if (
    !match ||
    router.value !==
      join(scope.routerLibRoot, "versions", match[2], "router.mjs")
  )
    fail("launcher target");
  return { generation: match[2], runtime: runtime.value };
}

export function captureBackup(scopeInput, hooks = {}) {
  const scope = validateScope(scopeInput),
    command = file(join(scope.routerLibRoot, "router-command"), hooks),
    active = launcher(command.bytes, scope),
    preimageGenerations = generations(scope);
  if (!preimageGenerations.includes(active.generation))
    fail("selected generation missing");
  const records = [];
  for (const id of ids) {
    const entries = regularNames(scope.pluginRoots[id], 16);
    for (const required of REQUIRED_DIST_OUTPUTS)
      if (!entries.includes(required)) fail("missing required dist output");
    for (const entry of entries)
      records.push(
        record(
          "plugin:" + id,
          entry,
          "regular-file",
          file(join(scope.pluginRoots[id], entry), hooks, pluginDistModes),
        ),
      );
  }
  const root = generationRoot(scope, active.generation),
    manifestFile = file(join(root, "manifest.json"), hooks),
    manifestData = manifest(manifestFile.bytes, active.generation),
    files = manifestData.files,
    runtime = absoluteSymlink(join(scope.routerLibRoot, "bun"), hooks);
  if (active.runtime !== runtime || manifestData.capabilities.runtimeExecPath !== runtime)
    fail("runtime identity");
  if (
    regularNames(root, MAX_GENERATION_FILES + 1).join("\0") !==
    ["manifest.json", ...files.keys()].sort().join("\0")
  )
    fail("router extras or omissions");
  records.push(
    record("router-manifest", "manifest.json", "regular-file", manifestFile),
  );
  for (const [entry, expected] of files) {
    const current = file(join(root, entry), hooks);
    if (hash(current.bytes) !== expected) fail("manifest hash mismatch");
    records.push(record("router-file", entry, "regular-file", current));
  }
  records.push(
    record(
      "launcher:router-command",
      "router-command",
      "regular-file",
      command,
    ),
  );
  symlink(join(scope.routerLibRoot, "router.mjs"), "router-command", hooks);
  records.push(record("launcher:router.mjs", "router.mjs", "relative-symlink"));
  records.push(record("runtime:bun", "bun", "absolute-symlink", { linkTarget: runtime }));
  try {
    records.push(
      record(
        "hook",
        "shared-hooks.json",
        "regular-file",
        file(scope.hookPath, hooks),
      ),
    );
  } catch (error) {
    if (!error.message.includes("ENOENT")) throw error;
    records.push(record("hook", "shared-hooks.json", "absent"));
  }
  records.sort((left, right) => {
    const leftKey = recordKey(left);
    const rightKey = recordKey(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  return parseBackup({
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    scope,
    generation: active.generation,
    preimageGenerations,
    recordCount: records.length,
    totalBytes: records.reduce((sum, item) => sum + item.byteLength, 0),
    records,
  });
}
export const capture = captureBackup;
function recordKey(item) {
  return item.target + "\0" + item.relativePath;
}
function controlledRegularBinding(item) {
  if (!name(item.relativePath)) return false;
  if (item.target.startsWith("plugin:"))
    return ids.includes(item.target.slice("plugin:".length));
  return (
    (item.target === "router-manifest" && item.relativePath === "manifest.json") ||
    (item.target === "router-file" && item.relativePath !== "manifest.json") ||
    (item.target === "launcher:router-command" &&
      item.relativePath === "router-command") ||
    (item.target === "hook" && item.relativePath === "shared-hooks.json")
  );
}
function validateRecord(item) {
  const expected = [
    "target",
    "relativePath",
    "kind",
    "present",
    "mode",
    "byteLength",
    "sha256",
    "bytesBase64",
    "linkTarget",
  ];
  if (
    !keys(item, expected) ||
    typeof item.target !== "string" ||
    !path(item.relativePath) ||
    typeof item.present !== "boolean"
  )
    fail("record identity");
  if (item.kind === "absent") {
    if (
      item.target !== "hook" ||
      item.relativePath !== "shared-hooks.json" ||
      item.present ||
      item.mode !== null ||
      item.byteLength !== 0 ||
      item.sha256 !== null ||
      item.bytesBase64 !== null ||
      item.linkTarget !== null
    )
      fail("absent record");
    return;
  }
  if (item.kind === "relative-symlink") {
    if (
      item.target !== "launcher:router.mjs" ||
      item.relativePath !== "router.mjs" ||
      !item.present ||
      item.mode !== null ||
      item.byteLength !== 0 ||
      item.sha256 !== null ||
      item.bytesBase64 !== null ||
      item.linkTarget !== "router-command"
    )
      fail("symlink record");
    return;
  }
  if (item.kind === "absolute-symlink") {
    if (item.target !== "runtime:bun" || item.relativePath !== "bun" || !item.present || item.mode !== null ||
      item.byteLength !== 0 || item.sha256 !== null || item.bytesBase64 !== null || !isAbsolute(item.linkTarget) ||
      item.linkTarget !== resolve(item.linkTarget)) fail("runtime symlink record");
    return;
  }
  if (
    item.kind !== "regular-file" ||
    !controlledRegularBinding(item) ||
    !item.present ||
    !Number.isSafeInteger(item.byteLength) ||
    item.byteLength < 0 ||
    item.byteLength > MAX_FILE_BYTES ||
    !(item.target.startsWith("plugin:") ? pluginDistModes : modes).has(item.mode) ||
    !sha.test(item.sha256) ||
    !b64(item.bytesBase64, item.byteLength) ||
    item.linkTarget !== null
  )
    fail("record bounds");
}
function decode(item) {
  if (item.kind !== "regular-file") return { ...item, bytes: null };
  const bytes = Buffer.from(item.bytesBase64, "base64");
  if (bytes.length !== item.byteLength || hash(bytes) !== item.sha256)
    fail("record hash");
  return { ...item, bytes };
}
function preimage(value) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > MAX_GENERATIONS ||
    value.some((item) => !sha.test(item)) ||
    value.some((item, index) => index && value[index - 1] >= item)
  )
    fail("preimage generations");
}
function topology(records, generation, scope) {
  const byKey = new Map();
  for (const item of records) {
    if (byKey.has(recordKey(item))) fail("duplicate record");
    byKey.set(recordKey(item), item);
  }
  for (const id of ids) {
    const entries = records.filter((item) => item.target === "plugin:" + id);
    if (
      entries.length < REQUIRED_DIST_OUTPUTS.length ||
      entries.length > 16 ||
      entries.some((item) => item.kind !== "regular-file")
    )
      fail("plugin record count");
    for (const needed of REQUIRED_DIST_OUTPUTS)
      if (!entries.some((item) => item.relativePath === needed))
        fail("missing plugin record");
  }
  const manifestRecord = byKey.get("router-manifest\0manifest.json");
  if (!manifestRecord || manifestRecord.kind !== "regular-file")
    fail("manifest record");
  const manifestData = manifest(manifestRecord.bytes, generation),
    files = manifestData.files,
    router = records.filter((item) => item.target === "router-file");
  if (
    router.length !== files.size ||
    router.some((item) => item.kind !== "regular-file")
  )
    fail("router record count");
  for (const [entry, expected] of files)
    if (byKey.get("router-file\0" + entry)?.sha256 !== expected)
      fail("router record binding");
  const command = byKey.get("launcher:router-command\0router-command");
  if (
    !command ||
    command.kind !== "regular-file" ||
    launcher(command.bytes, scope).generation !== generation
  )
    fail("launcher command");
  if (
    byKey.get("launcher:router.mjs\0router.mjs")?.kind !== "relative-symlink" ||
    byKey.get("runtime:bun\0bun")?.kind !== "absolute-symlink" ||
    !["regular-file", "absent"].includes(
      byKey.get("hook\0shared-hooks.json")?.kind,
    )
  )
    fail("record topology");
  const runtime = byKey.get("runtime:bun\0bun").linkTarget;
  if (launcher(command.bytes, scope).runtime !== runtime || manifestData.capabilities.runtimeExecPath !== runtime)
    fail("runtime identity");
}
export function parseBackup(raw) {
  let backup;
  if (typeof raw === "string" || Buffer.isBuffer(raw)) {
    const envelope = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, "utf8");
    if (envelope.byteLength > MAX_ENVELOPE_BYTES) fail("backup envelope bound");
    try {
      backup = JSON.parse(envelope.toString("utf8"));
    } catch {
      fail("backup JSON");
    }
  } else backup = raw;
  const expected = [
    "kind",
    "version",
    "scope",
    "generation",
    "preimageGenerations",
    "recordCount",
    "totalBytes",
    "records",
  ];
  if (
    !keys(backup, expected) ||
    backup.kind !== BACKUP_KIND ||
    backup.version !== BACKUP_VERSION ||
    !sha.test(backup.generation) ||
    !Number.isSafeInteger(backup.recordCount) ||
    backup.recordCount < 1 ||
    backup.recordCount > MAX_RECORDS ||
    !Number.isSafeInteger(backup.totalBytes) ||
    backup.totalBytes < 0 ||
    backup.totalBytes > MAX_TOTAL_BYTES ||
    !Array.isArray(backup.records) ||
    backup.records.length !== backup.recordCount
  )
    fail("backup bounds");
  const scope = validateScope(backup.scope);
  preimage(backup.preimageGenerations);
  if (!backup.preimageGenerations.includes(backup.generation))
    fail("selected preimage generation");
  for (const item of backup.records) validateRecord(item);
  const total = backup.records.reduce((sum, item) => sum + item.byteLength, 0);
  if (total !== backup.totalBytes || total > MAX_TOTAL_BYTES)
    fail("aggregate bound");
  const order = backup.records.map(recordKey);
  if (order.some((item, index) => item !== [...order].sort()[index]))
    fail("record order");
  const records = backup.records.map(decode);
  topology(records, backup.generation, scope);
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    scope,
    generation: backup.generation,
    preimageGenerations: [...backup.preimageGenerations],
    recordCount: records.length,
    totalBytes: total,
    records: records.map(({ bytes, ...item }) => item),
  };
}
export const parse = parseBackup;
export const serializeBackup = (backup) => JSON.stringify(parseBackup(backup));
export const serialize = serializeBackup;
export const backupIdentity = (backup) => hash(Buffer.from(serializeBackup(backup)));
export const normalizedBackupEqual = (left, right) =>
  serializeBackup(left) === serializeBackup(right);
export const normalizedEqual = normalizedBackupEqual;
function restoredStateEqual(savedInput, freshInput) {
  const saved = parseBackup(savedInput),
    fresh = parseBackup(freshInput);
  if (
    !sameScope(saved.scope, fresh.scope) ||
    saved.generation !== fresh.generation ||
    saved.recordCount !== fresh.recordCount ||
    saved.totalBytes !== fresh.totalBytes ||
    saved.records.length !== fresh.records.length
  )
    return false;
  for (let index = 0; index < saved.records.length; index += 1)
    if (
      JSON.stringify(saved.records[index]) !== JSON.stringify(fresh.records[index])
    )
      return false;
  const retained = new Set(fresh.preimageGenerations);
  return saved.preimageGenerations.every((generation) => retained.has(generation));
}
function targetPath(scope, generation, item) {
  if (item.target.startsWith("plugin:"))
    return join(scope.pluginRoots[item.target.slice(7)], item.relativePath);
  if (item.target === "router-manifest" || item.target === "router-file")
    return join(generationRoot(scope, generation), item.relativePath);
  return item.target.startsWith("launcher:") || item.target === "runtime:bun"
    ? join(scope.routerLibRoot, item.relativePath)
    : scope.hookPath;
}
function targetRoot(scope, generation, item) {
  if (item.target.startsWith("plugin:"))
    return scope.pluginRoots[item.target.slice(7)];
  if (item.target === "router-manifest" || item.target === "router-file")
    return generationRoot(scope, generation);
  return item.target.startsWith("launcher:") || item.target === "runtime:bun"
    ? scope.routerLibRoot
    : dirname(scope.hookPath);
}
function ancestors(root, destination) {
  const resolved = resolve(root),
    child = relative(resolved, resolve(destination));
  if (!child || child === ".." || child.startsWith(".." + sep))
    fail("restore containment");
  directory(resolved);
  let current = resolved;
  for (const part of relative(resolved, dirname(destination))
    .split(sep)
    .filter(Boolean)) {
    current = join(current, part);
    directory(current);
  }
}
let sequence = 0;
function temporary(destination) {
  sequence += 1;
  return join(
    dirname(destination),
    ".backup-v1-" + process.pid + "-" + sequence,
  );
}
function writeAtomically(destination, bytes, fileMode) {
  const initial = lstat(destination);
  if (initial && (initial.isSymbolicLink() || !initial.isFile()))
    fail("unsafe restore destination");
  const temp = temporary(destination);
  let fd;
  try {
    fd = openSync(
      temp,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      fileMode,
    );
    for (let offset = 0; offset < bytes.length; )
      offset += writeSync(fd, bytes, offset, bytes.length - offset);
    fsyncSync(fd);
    fchmodSync(fd, fileMode);
    closeSync(fd);
    fd = undefined;
    const final = lstat(destination);
    if (final && (final.isSymbolicLink() || !final.isFile()))
      fail("unsafe restore destination");
    renameSync(temp, destination);
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    try {
      unlinkSync(temp);
    } catch {}
    throw error;
  }
}
function linkAtomically(destination, target) {
  const initial = lstat(destination);
  if (initial && !initial.isSymbolicLink())
    fail("unsafe restore alias destination");
  const temp = temporary(destination);
  try {
    symlinkSync(target, temp);
    const final = lstat(destination);
    if (final && !final.isSymbolicLink())
      fail("unsafe restore alias destination");
    renameSync(temp, destination);
  } catch (error) {
    try {
      unlinkSync(temp);
    } catch {}
    throw error;
  }
}
function regularFileMatches(destination, item) {
  const initial = lstat(destination);
  if (!initial) return false;
  if (initial.isSymbolicLink() || !initial.isFile())
    fail("unsafe restore destination");
  // file() opens with O_NOFOLLOW and confirms its descriptor still names the
  // same path after reading.  Do not turn equality into a TOCTOU shortcut.
  const current = file(destination, {}, item.target.startsWith("plugin:") ? pluginDistModes : modes);
  return current.mode === item.mode && current.bytes.equals(item.bytes);
}
function relativeAliasMatches(destination, target) {
  const before = lstat(destination);
  if (!before) return false;
  if (!before.isSymbolicLink()) fail("unsafe restore alias destination");
  const actual = readlinkSync(destination, "utf8");
  const after = lstat(destination);
  if (!after.isSymbolicLink() || !same(before, after))
    fail("symlink race: " + destination);
  if (
    isAbsolute(actual) ||
    actual.includes("/") ||
    actual === "." ||
    actual === ".."
  )
    fail("unsafe symlink target: " + destination);
  return actual === target;
}
function absoluteAliasMatches(destination, target) {
  const before = lstat(destination);
  if (!before) return false;
  if (!before.isSymbolicLink()) fail("unsafe restore alias destination");
  const actual = readlinkSync(destination, "utf8");
  const after = lstat(destination);
  if (!after.isSymbolicLink() || !same(before, after))
    fail("symlink race: " + destination);
  if (!isAbsolute(actual) || actual !== resolve(actual) || actual.includes("\0"))
    fail("unsafe runtime target");
  return actual === target;
}
function sameScope(left, right) {
  return (
    JSON.stringify(validateScope(left)) === JSON.stringify(validateScope(right))
  );
}
export function restoreBackup(
  scopeInput,
  backupInput,
  expectedIdentity,
) {
  const scope = validateScope(scopeInput),
    backup = parseBackup(backupInput);
  if (!sha.test(expectedIdentity) || backupIdentity(backup) !== expectedIdentity)
    fail("backup identity mismatch");
  if (!sameScope(scope, backup.scope)) fail("backup scope mismatch");
  const records = backup.records.map(decode);
  for (const item of records.filter(
    (record) => record.kind === "regular-file" || record.kind === "absent",
  )) {
    const destination = targetPath(scope, backup.generation, item);
    ancestors(targetRoot(scope, backup.generation, item), destination);
    if (item.kind === "absent") {
      const stat = lstat(destination);
      if (stat?.isSymbolicLink() || (stat && !stat.isFile()))
        fail("unsafe absent destination");
      if (stat) unlinkSync(destination);
    } else if (!regularFileMatches(destination, item)) {
      writeAtomically(destination, item.bytes, item.mode);
    }
  }
  for (const item of records.filter((record) => record.kind.endsWith("symlink"))) {
    const destination = targetPath(scope, backup.generation, item);
    ancestors(targetRoot(scope, backup.generation, item), destination);
    const matches = item.kind === "relative-symlink"
      ? relativeAliasMatches(destination, item.linkTarget)
      : absoluteAliasMatches(destination, item.linkTarget);
    if (!matches) linkAtomically(destination, item.linkTarget);
  }
  const recaptured = captureBackup(scope);
  if (!restoredStateEqual(backup, recaptured))
    fail("restore verification");
  return recaptured;
}
export const restore = restoreBackup;
export function verifyRestore(scope, backup) {
  const recaptured = captureBackup(scope);
  if (!restoredStateEqual(backup, recaptured)) fail("restore verification");
  return recaptured;
}
export const verify = verifyRestore;
