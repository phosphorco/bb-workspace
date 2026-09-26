#!/usr/bin/env node
/**
 * Parent-owned mutation safety harness for the Context Magnet session ETL plan.
 *
 * This deliberately has no defaults for a node, canonical root, repository, or
 * grant.  A parent supplies all four before a child is dispatched.  Its recovery
 * records are private evidence under an explicitly supplied artifact root; they are not plan-ledger
 * entries and this program never invokes a Workbench command.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  chmodSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync,
  readdirSync, realpathSync, renameSync, rmdirSync, rmSync, unlinkSync, writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";

const VERSION = 1;
const DEFAULT_MAX_FILES = 1000;
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;
const HARD_MAX_FILES = 10_000;
const HARD_MAX_BYTES = 64 * 1024 * 1024;
const PROTECTED_HARD_MAX_FILES = 100_000;
const PROTECTED_HARD_MAX_BYTES = 8 * 1024 * 1024 * 1024;
const NODE_RE = /^[a-z][a-z0-9-]{0,79}$/;
const HASH = (bytes) => createHash("sha256").update(bytes).digest("hex");

function fail(message) { throw new Error(message); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
function json(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function usage() {
  return "usage: node plans/context-magnet-session-etl-recovery.mjs <begin|finish|inspect|restore|self-test> --node ID --root ABSOLUTE --artifact-root ABSOLUTE --repo-root NAME=ABSOLUTE [--repo-root ...] [--grant RELATIVE | --grant-json JSON] [--dry-run]";
}
function command(file, args, cwd) {
  try {
    return execFileSync(file, args, { cwd, encoding: "buffer", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 });
  } catch (error) {
    const stderr = Buffer.isBuffer(error.stderr) ? error.stderr.toString("utf8") : String(error.stderr ?? "");
    fail(`${file} ${args.join(" ")} failed: ${stderr.replace(/\s+/g, " ").slice(0, 600) || error.message}`);
  }
}
function parseArgs(argv) {
  const [subcommand, ...rest] = argv;
  if (!subcommand) fail(usage());
  const options = { grants: [], repoRoots: [], dryRun: false };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === "--dry-run") { options.dryRun = true; continue; }
    if (!token.startsWith("--")) fail(`unexpected argument: ${token}`);
    const value = rest[++i];
    if (value === undefined || value.startsWith("--")) fail(`missing value for ${token}`);
    if (token === "--node") options.node = value;
    else if (token === "--root") options.root = value;
    else if (token === "--artifact-root") options.artifactRoot = value;
    else if (token === "--repo-root") options.repoRoots.push(value);
    else if (token === "--grant") options.grants.push(value);
    else if (token === "--grant-json") options.grantJson = value;
    else if (token === "--max-files") options.maxFiles = value;
    else if (token === "--max-bytes") options.maxBytes = value;
    else fail(`unknown option: ${token}`);
  }
  return { subcommand, options };
}
function numberBound(value, label, fallback, hard) {
  if (value === undefined) return fallback;
  if (!/^[1-9][0-9]*$/.test(String(value))) fail(`${label} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > hard) fail(`${label} exceeds hard limit ${hard}`);
  return parsed;
}
function validateNode(node) {
  if (!NODE_RE.test(node ?? "")) fail("node must match [a-z][a-z0-9-]{0,79}");
  return node;
}
function ensurePathInside(root, path, label) {
  const rel = relative(root, path);
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))) return;
  fail(`${label} escapes canonical cwd`);
}
function rejectSpecial(path, label) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) fail(`${label} is a symlink: ${path}`);
  if (!stat.isFile() && !stat.isDirectory()) fail(`${label} is not a regular file or directory: ${path}`);
  return stat;
}
function checkedCanonicalRoot(value) {
  if (!value || !isAbsolute(value)) fail("--root must be an explicit absolute path");
  if (resolve(value) === sep || resolve(value) === resolve(homedir())) fail("--root may not be / or HOME");
  if (!existsSync(value)) fail("--root does not exist");
  const root = realpathSync(value);
  if (root !== resolve(value)) fail("--root must already be its canonical real path");
  if (!lstatSync(root).isDirectory()) fail("--root must be a directory");
  if (command("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], root).toString("utf8").trim() !== "true") fail("--root must be a Git work tree");
  const gitTopLevel = realpathSync(command("git", ["-C", root, "rev-parse", "--show-toplevel"], root).toString("utf8").trim());
  if (gitTopLevel !== root) fail("--root must be the Git work-tree root, not a descendant");
  return root;
}
function assertNoSymlinkTraversal(path, label) {
  const absolute = resolve(path);
  let cursor = sep;
  for (const part of absolute.split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) fail(`${label} traverses a symlink: ${cursor}`);
  }
}
function checkedArtifactRoot(value, { create = false } = {}) {
  if (!value || !isAbsolute(value)) fail("--artifact-root must be an explicit absolute path");
  const requested = resolve(value);
  if (requested === sep || requested === resolve(homedir())) fail("--artifact-root may not be / or HOME");
  assertNoSymlinkTraversal(requested, "artifact root");
  let existing = requested;
  while (!existsSync(existing)) existing = dirname(existing);
  if (!lstatSync(existing).isDirectory()) fail("artifact root has a non-directory parent");
  let bounded = false;
  try {
    const gitRoot = realpathSync(command("git", ["-C", existing, "rev-parse", "--show-toplevel"], existing).toString("utf8").trim());
    bounded = gitRoot !== sep && gitRoot !== resolve(homedir()) && isWithin(requested, gitRoot);
  } catch { bounded = isWithin(requested, resolve(tmpdir())) && existing !== resolve(tmpdir()); }
  if (!bounded) fail("--artifact-root must be under a non-broad Git root or an exact temporary root");
  if (!existsSync(requested)) {
    if (!create) fail("--artifact-root does not exist");
    mkdirChecked(existing, requested);
  }
  const canonical = realpathSync(requested);
  if (canonical !== requested || !lstatSync(canonical).isDirectory()) fail("--artifact-root must be a canonical directory");
  return canonical;
}
function validateRelative(value, label = "grant") {
  if (typeof value !== "string" || !value || value.includes("\0") || isAbsolute(value) || value.includes("\\")) fail(`${label} must be a non-empty relative POSIX path`);
  const directoryPattern = value.endsWith("/**");
  const body = directoryPattern ? value.slice(0, -3) : value;
  if (!body || body.includes("*") || body.includes("?") || body.includes("[") || body.includes("]")) fail(`${label} has an unsupported pattern: ${value}`);
  const parts = body.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) fail(`${label} contains an escaping segment: ${value}`);
  return { value, body, directoryPattern };
}
function parseGrantConfiguration(options) {
  let jsonGrant = null;
  if (options.grantJson !== undefined) {
    if (options.grants.length) fail("use repeated --grant or --grant-json, not both");
    try { jsonGrant = JSON.parse(options.grantJson); } catch { fail("--grant-json must be valid JSON"); }
    if (!jsonGrant || typeof jsonGrant !== "object" || Array.isArray(jsonGrant)) fail("--grant-json must be an object");
    const allowed = new Set(["grants", "maxFiles", "maxBytes"]);
    if (Object.keys(jsonGrant).some((key) => !allowed.has(key))) fail("--grant-json has unsupported keys");
    if (!Array.isArray(jsonGrant.grants) || !jsonGrant.grants.length || jsonGrant.grants.some((entry) => typeof entry !== "string")) fail("--grant-json.grants must be a non-empty string array");
  }
  const raw = jsonGrant ? jsonGrant.grants : options.grants;
  if (!raw.length) fail("an explicit grant is required");
  const grants = raw.map((entry) => validateRelative(entry));
  if (new Set(grants.map((entry) => entry.value)).size !== grants.length) fail("duplicate grants are rejected");
  const maxFiles = numberBound(jsonGrant?.maxFiles ?? options.maxFiles, "maxFiles", DEFAULT_MAX_FILES, HARD_MAX_FILES);
  const maxBytes = numberBound(jsonGrant?.maxBytes ?? options.maxBytes, "maxBytes", DEFAULT_MAX_BYTES, HARD_MAX_BYTES);
  return { grants, maxFiles, maxBytes };
}
function parseRepositories(root, values, required) {
  if (required && !values.length) fail("at least one explicit --repo-root is required");
  const repositories = [];
  const names = new Set();
  for (const value of values) {
    const split = value.indexOf("=");
    if (split <= 0) fail("--repo-root must be NAME=ABSOLUTE");
    const name = value.slice(0, split);
    const given = value.slice(split + 1);
    if (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(name) || names.has(name)) fail(`invalid or duplicate repository name: ${name}`);
    if (!isAbsolute(given) || !existsSync(given)) fail(`repository ${name} must be an existing absolute path`);
    const path = realpathSync(given);
    if (path !== resolve(given)) fail(`repository ${name} must be its canonical real path`);
    ensurePathInside(root, path, `repository ${name}`);
    if (!lstatSync(path).isDirectory()) fail(`repository ${name} is not a directory`);
    if (command("git", ["-C", path, "rev-parse", "--is-inside-work-tree"], root).toString("utf8").trim() !== "true") fail(`repository ${name} is not a Git work tree`);
    if (realpathSync(command("git", ["-C", path, "rev-parse", "--show-toplevel"], root).toString("utf8").trim()) !== path) fail(`repository ${name} must equal its Git work-tree root`);
    names.add(name);
    repositories.push({ name, path, relative: relative(root, path) || "." });
  }
  const sorted = repositories.sort((a, b) => a.path.localeCompare(b.path));
  if (!sorted.some((repository) => repository.path === root)) fail("an explicit --repo-root whose canonical path equals --root is required");
  const directParent = new Map();
  for (const child of sorted) {
    const ancestors = sorted.filter((parent) => parent.path !== child.path && isWithin(child.path, parent.path)).sort((a, b) => b.path.length - a.path.length);
    if (!ancestors.length) continue;
    const parent = ancestors[0];
    const childRelative = relative(parent.path, child.path);
    const gitlink = command("git", ["-C", parent.path, "ls-files", "--stage", "--", childRelative], parent.path).toString("utf8").trim();
    if (!gitlink.startsWith("160000 ")) fail(`nested repository must be an explicit nearest-parent gitlink: ${childRelative}`);
    directParent.set(child.path, parent.path);
  }
  return sorted.map((repository) => ({ ...repository, nestedRoots: sorted.filter((child) => directParent.get(child.path) === repository.path).map((child) => relative(repository.path, child.path)).sort() }));
}
function isWithin(path, root) { return path === root || path.startsWith(`${root}${sep}`); }
function grantMatches(grants, canonicalRelative) {
  return grants.some((grant) => canonicalRelative === grant.body || (grant.directoryPattern && canonicalRelative.startsWith(`${grant.body}/`)));
}
function artifactNodePath(artifactRoot, node) { return join(artifactRoot, node); }
function artifactIsInsideTarget(root, artifactRoot) { return isWithin(artifactRoot, root); }
function isCurrentArtifactPath(root, artifactRoot, node, rel) {
  if (!artifactIsInsideTarget(root, artifactRoot)) return false;
  const nodePath = artifactNodePath(artifactRoot, node);
  const absolute = resolve(root, rel);
  return absolute === nodePath || absolute.startsWith(`${nodePath}${sep}`);
}
function checkedPath(root, rel, { allowMissing = true, label = "path" } = {}) {
  validateRelative(rel, label);
  const absolute = resolve(root, rel);
  ensurePathInside(root, absolute, label);
  const parts = relative(root, absolute).split(sep);
  let cursor = root;
  for (let index = 0; index < parts.length; index += 1) {
    cursor = join(cursor, parts[index]);
    if (!existsSync(cursor)) {
      if (allowMissing) break;
      fail(`${label} is absent: ${rel}`);
    }
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) fail(`${label} traverses a symlink: ${rel}`);
    if (index < parts.length - 1 && !stat.isDirectory()) fail(`${label} has non-directory parent: ${rel}`);
    if (index === parts.length - 1 && !stat.isFile() && !stat.isDirectory()) fail(`${label} is not regular: ${rel}`);
  }
  return absolute;
}
function modeOf(stat) { return stat.mode & 0o7777; }
function statToken(stat) { return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mode}:${stat.mtimeMs}:${stat.ctimeMs}`; }
function stableRead(path, label) {
  const before = rejectSpecial(path, label);
  if (!before.isFile()) fail(`${label} is not a regular file: ${path}`);
  const bytes = readFileSync(path);
  const after = rejectSpecial(path, label);
  if (!after.isFile() || statToken(before) !== statToken(after)) fail(`${label} mutated during read: ${path}`);
  return { stat: after, bytes };
}
function fileIdentity(path, relativePath) {
  if (!existsSync(path)) return { path: relativePath, state: "absent" };
  const { stat, bytes } = stableRead(path, "captured path");
  return { path: relativePath, state: "present", bytes: bytes.length, mode: modeOf(stat), sha256: HASH(bytes) };
}
function walkDirectory(root, absolute, rel, limits, accumulator) {
  rejectSpecial(absolute, "granted directory");
  accumulator.directories.push(rel);
  for (const name of readdirSync(absolute).sort()) {
    const child = join(absolute, name);
    const childRel = `${rel}/${name}`;
    const stat = rejectSpecial(child, "granted member");
    if (stat.isDirectory()) walkDirectory(root, child, childRel, limits, accumulator);
    else {
      if (accumulator.files.length + 1 > limits.maxFiles) fail(`capture exceeds maxFiles ${limits.maxFiles}`);
      if (accumulator.bytes + stat.size > limits.maxBytes) fail(`capture exceeds maxBytes ${limits.maxBytes}`);
      accumulator.bytes += stat.size;
      accumulator.files.push(fileIdentity(child, childRel));
    }
  }
}
function missingParentDirectories(root, body) {
  const missing = [];
  const parts = body.split("/");
  for (let index = 1; index < parts.length; index += 1) {
    const rel = parts.slice(0, index).join("/");
    if (!existsSync(resolve(root, rel))) missing.push(rel);
  }
  return missing;
}
function captureGrants(root, grants, limits) {
  const result = { files: [], absentExact: [], absentDirectories: [], directories: [], bytes: 0 };
  for (const grant of grants) {
    const absolute = checkedPath(root, grant.body, { label: "grant" });
    if (!existsSync(absolute)) {
      if (grant.directoryPattern) result.absentDirectories.push(grant.body);
      else result.absentExact.push(grant.body);
      result.absentDirectories.push(...missingParentDirectories(root, grant.body));
      continue;
    }
    const stat = rejectSpecial(absolute, "grant");
    if (grant.directoryPattern) {
      if (!stat.isDirectory()) fail(`directory grant does not name a directory: ${grant.value}`);
      walkDirectory(root, absolute, grant.body, limits, result);
    } else {
      if (!stat.isFile()) fail(`exact grant must name a regular file: ${grant.value}`);
      if (result.files.length + 1 > limits.maxFiles || result.bytes + stat.size > limits.maxBytes) fail("capture exceeds configured limits");
      result.bytes += stat.size;
      result.files.push(fileIdentity(absolute, grant.body));
    }
  }
  result.files.sort((a, b) => a.path.localeCompare(b.path));
  result.absentExact = [...new Set(result.absentExact)].sort();
  result.absentDirectories = [...new Set(result.absentDirectories)].sort();
  result.directories.sort();
  if (new Set(result.files.map((entry) => entry.path)).size !== result.files.length) fail("overlapping grants capture the same file");
  return result;
}
function assertGrantScopes(root, grants, repositories) {
  for (const grant of grants) {
    const absolute = resolve(root, grant.body);
    if (!repositories.some((repository) => isWithin(absolute, repository.path))) fail(`grant is outside every explicit repository scope: ${grant.value}`);
  }
}
function parseStatus(raw) {
  const records = raw.toString("utf8").split("\0");
  const entries = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.length < 4) fail("malformed git status record");
    const code = record.slice(0, 2);
    let path = record.slice(3);
    // Porcelain v1 -z reports the source path after a rename/copy as the next record.
    let originalPath = null;
    if (code[0] === "R" || code[0] === "C" || code[1] === "R" || code[1] === "C") originalPath = records[++index] ?? null;
    if (!path || path.includes("\0")) fail("malformed git status path");
    entries.push({ code, path, ...(originalPath ? { originalPath } : {}) });
  }
  return entries.sort((a, b) => `${a.path}\0${a.code}`.localeCompare(`${b.path}\0${b.code}`));
}
function statusFor(repository) {
  const stagedGitlinks = command("git", ["-C", repository.path, "ls-files", "--stage"], repository.path).toString("utf8").split("\n");
  for (const row of stagedGitlinks) {
    const match = row.match(/^160000 ([0-9a-f]{40}) \d+\t(.+)$/);
    if (!match || repository.nestedRoots.includes(match[2])) continue;
    let head = null;
    try {
      const tree = command("git", ["-C", repository.path, "ls-tree", "HEAD", "--", match[2]], repository.path).toString("utf8").trim();
      head = tree.match(/^160000 commit ([0-9a-f]{40})\t/)?.[1] ?? null;
    } catch { /* an added gitlink is already drift */ }
    if (head !== match[1]) fail(`missing explicit repository root for dirty gitlink: ${repository.name}:${match[2]}`);
  }
  const all = parseStatus(command("git", ["-C", repository.path, "status", "--porcelain=v1", "-z", "--untracked-files=all"], repository.path));
  for (const entry of all) {
    if (repository.nestedRoots.includes(entry.path)) continue;
    const parts = entry.path.split("/");
    for (let length = parts.length; length > 0; length -= 1) {
      const candidate = parts.slice(0, length).join("/");
      const stage = command("git", ["-C", repository.path, "ls-files", "--stage", "--", candidate], repository.path).toString("utf8").trim();
      if (stage.startsWith("160000 ")) fail(`missing explicit repository root for dirty gitlink: ${repository.name}:${candidate}`);
    }
  }
  const status = all.filter((entry) => !repository.nestedRoots.includes(entry.path));
  const head = command("git", ["-C", repository.path, "rev-parse", "HEAD"], repository.path).toString("utf8").trim();
  const index = command("git", ["-C", repository.path, "write-tree"], repository.path).toString("utf8").trim();
  return { head, index, status };
}
function canonicalRepoPath(root, repository, repoPath) {
  validateRelative(repoPath, "git status path");
  const absolute = resolve(repository.path, repoPath);
  ensurePathInside(repository.path, absolute, "git status path");
  ensurePathInside(root, absolute, "git status path");
  return relative(root, absolute);
}
function protectedIdentity(path, relativePath) {
  if (!existsSync(path)) return { path: relativePath, state: "absent" };
  const stat = rejectSpecial(path, "protected path");
  if (!stat.isFile()) fail(`expected regular protected file: ${relativePath}`);
  const digest = createHash("sha256");
  const fd = openSync(path, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try { for (let read = readSync(fd, buffer, 0, buffer.length, null); read > 0; read = readSync(fd, buffer, 0, buffer.length, null)) digest.update(buffer.subarray(0, read)); }
  finally { closeSync(fd); }
  const after = rejectSpecial(path, "protected path");
  if (!after.isFile() || statToken(stat) !== statToken(after)) fail(`protected path mutated during hash: ${relativePath}`);
  return { path: relativePath, state: "present", bytes: after.size, mode: modeOf(after), sha256: digest.digest("hex") };
}
function dirtyOutsideGrants(root, artifactRoot, repositories, grants, node) {
  const snapshot = [];
  let usedBytes = 0;
  let count = 0;
  for (const repository of repositories) {
    const git = statusFor(repository);
    const protectedPaths = [];
    for (const entry of git.status) {
      const candidates = [entry.path, entry.originalPath].filter(Boolean);
      for (const candidate of candidates) {
        const rel = canonicalRepoPath(root, repository, candidate);
        if (isCurrentArtifactPath(root, artifactRoot, node, rel) || grantMatches(grants, rel)) continue;
        const absolute = checkedPath(root, rel, { label: "pre-existing dirty path" });
        const identity = protectedIdentity(absolute, rel);
        if (identity.state === "present") {
          count += 1; usedBytes += identity.bytes;
          if (count > PROTECTED_HARD_MAX_FILES || usedBytes > PROTECTED_HARD_MAX_BYTES) fail(`dirty/untracked protection exceeds hard limits files=${PROTECTED_HARD_MAX_FILES} bytes=${PROTECTED_HARD_MAX_BYTES}`);
        }
        protectedPaths.push(identity);
      }
    }
    const deduped = [...new Map(protectedPaths.map((entry) => [entry.path, entry])).values()].sort((a, b) => a.path.localeCompare(b.path));
    snapshot.push({ name: repository.name, path: repository.relative, ...git, protectedPaths: deduped });
  }
  return snapshot;
}
function mkdirChecked(root, target) {
  ensurePathInside(root, target, "recovery artifact");
  const rel = relative(root, target);
  let cursor = root;
  for (const part of rel.split(sep)) {
    if (!part) continue;
    cursor = join(cursor, part);
    if (existsSync(cursor)) {
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink() || !stat.isDirectory()) fail(`recovery artifact parent is unsafe: ${cursor}`);
    } else mkdirSync(cursor, { mode: 0o700 });
  }
}
function writeAtomic(root, target, bytes) {
  mkdirChecked(root, dirname(target));
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) fail(`refusing symlink artifact: ${target}`);
  const temporary = join(dirname(target), `.${basename(target)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(temporary, bytes, { mode: 0o600 });
  renameSync(temporary, target);
}
function statePath(artifactRoot, node) { return join(artifactNodePath(artifactRoot, node), "state.json"); }
function checkedArtifactPath(artifactRoot, rel, label = "artifact", allowMissing = false) {
  return checkedPath(artifactRoot, rel, { label, allowMissing });
}
function loadState(root, artifactRoot, node) {
  const path = statePath(artifactRoot, node);
  if (!existsSync(path)) fail(`no capture exists for node ${node}`);
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) fail("state manifest is unsafe");
  let state;
  try { state = JSON.parse(readFileSync(path, "utf8")); } catch { fail("state manifest is invalid JSON"); }
  if (!state || state.schemaVersion !== VERSION || state.node !== node || state.root !== root || state.artifactRoot !== artifactRoot || !Array.isArray(state.grants) || !Array.isArray(state.repositories)) fail("state manifest does not match this harness, target, or artifact root");
  return state;
}
function snapshotPath(artifactRoot, node, rel) { return join(artifactNodePath(artifactRoot, node), "files", `${HASH(Buffer.from(rel))}.bin`); }
function savePreimageFiles(root, artifactRoot, node, state) {
  for (const entry of state.preimage.grants.files) {
    const source = checkedPath(root, entry.path, { allowMissing: false, label: "captured grant" });
    const { stat, bytes } = stableRead(source, "captured grant");
    if (HASH(bytes) !== entry.sha256 || bytes.length !== entry.bytes || modeOf(stat) !== entry.mode) fail(`captured file changed during begin: ${entry.path}`);
    const destination = snapshotPath(artifactRoot, node, entry.path);
    writeAtomic(artifactRoot, destination, bytes);
    entry.snapshot = relative(artifactRoot, destination);
    writeAtomic(artifactRoot, statePath(artifactRoot, node), json(state));
    if (process.env.RECOVERY_HARNESS_INTERRUPT_AFTER_CAPTURE === "1") fail("simulated interrupted capture; state remains inspectable");
  }
}
function activeOverlap(artifactRoot, node, grants, repositories) {
  const base = artifactRoot;
  if (!existsSync(base)) return;
  rejectSpecial(base, "recovery root");
  for (const child of readdirSync(base).sort()) {
    if (child === node) continue;
    const candidate = join(base, child, "state.json");
    if (!existsSync(candidate)) continue;
    if (lstatSync(candidate).isSymbolicLink() || !lstatSync(candidate).isFile()) fail(`unsafe active capture state: ${child}`);
    let state;
    try { state = JSON.parse(readFileSync(candidate, "utf8")); } catch { fail(`unsafe unreadable active capture: ${child}`); }
    if (state.state !== "active" && state.state !== "capturing") continue;
    const commonRepository = state.repositories?.some((repo) => repositories.some((current) => current.path === repo.path));
    if (!commonRepository) continue;
    const overlap = state.grants?.some((old) => grants.some((fresh) => old === fresh.value || fresh.value === old || old.replace(/\/\*\*$/, "").startsWith(`${fresh.body}/`) || fresh.body.startsWith(`${old.replace(/\/\*\*$/, "")}/`)));
    if (overlap) fail(`overlapping active capture exists: ${child}`);
  }
}
function begin(options) {
  const node = validateNode(options.node);
  const root = checkedCanonicalRoot(options.root);
  const artifactRoot = checkedArtifactRoot(options.artifactRoot, { create: true });
  const config = parseGrantConfiguration(options);
  const repositories = parseRepositories(root, options.repoRoots, true);
  assertGrantScopes(root, config.grants, repositories);
  const artifactDir = artifactNodePath(artifactRoot, node);
  if (artifactIsInsideTarget(root, artifactRoot) && config.grants.some((grant) => {
    const granted = resolve(root, grant.body);
    return isWithin(artifactDir, granted) || isWithin(granted, artifactDir);
  })) fail("grant overlaps the current node recovery artifact subtree");
  if (existsSync(artifactDir)) fail(`recovery artifact already exists for node ${node}`);
  activeOverlap(artifactRoot, node, config.grants, repositories);
  mkdirChecked(artifactRoot, artifactDir);
  const state = {
    schemaVersion: VERSION, node, root, artifactRoot, state: "capturing", createdAt: new Date().toISOString(),
    grants: config.grants.map((grant) => grant.value), limits: { maxFiles: config.maxFiles, maxBytes: config.maxBytes },
    repositories, preimage: { grants: captureGrants(root, config.grants, config), repositories: [] },
  };
  writeAtomic(artifactRoot, statePath(artifactRoot, node), json(state));
  savePreimageFiles(root, artifactRoot, node, state);
  state.preimage.repositories = dirtyOutsideGrants(root, artifactRoot, repositories, config.grants, node);
  state.state = "active";
  writeAtomic(artifactRoot, statePath(artifactRoot, node), json(state));
  process.stdout.write(json({ ok: true, node, state: state.state, artifactRoot }));
}
function grantsFromState(state) { return state.grants.map((value) => validateRelative(value)); }
function currentGrantSnapshot(root, state) { return captureGrants(root, grantsFromState(state), state.limits); }
function sameIdentity(a, b) { return JSON.stringify(stable(a)) === JSON.stringify(stable(b)); }
function changedGrantPaths(before, after) {
  const left = new Map(before.files.map((entry) => [entry.path, entry]));
  const right = new Map(after.files.map((entry) => [entry.path, entry]));
  const paths = [...new Set([...left.keys(), ...right.keys()])].sort();
  return paths.filter((path) => !sameIdentity(left.get(path) ?? { path, state: "absent" }, right.get(path) ?? { path, state: "absent" }));
}
function assertOutsideUntouched(root, artifactRoot, state) {
  const grants = grantsFromState(state);
  const findings = new Set();
  for (const original of state.preimage.repositories) {
    const repository = state.repositories.find((entry) => entry.name === original.name);
    const fresh = statusFor(repository);
    if (fresh.head !== original.head) findings.add(`${repository.name}:HEAD-drift`);
    if (fresh.index !== original.index) findings.add(`${repository.name}:index-drift`);
    const protectedByPath = new Map(original.protectedPaths.map((entry) => [entry.path, entry]));
    const freshOutside = new Set();
    for (const item of fresh.status) {
      for (const candidate of [item.path, item.originalPath].filter(Boolean)) {
        const rel = canonicalRepoPath(root, repository, candidate);
        if (!isCurrentArtifactPath(root, artifactRoot, state.node, rel) && !grantMatches(grants, rel)) freshOutside.add(rel);
      }
    }
    for (const rel of [...freshOutside].sort()) {
      const expected = protectedByPath.get(rel);
      if (!expected) findings.add(`${repository.name}:${rel}:new-or-clean-outside-grant`);
      else {
        const actual = protectedIdentity(checkedPath(root, rel, { label: "fresh dirty path" }), rel);
        if (!sameIdentity(expected, actual)) findings.add(`${repository.name}:${rel}:pre-existing-dirty-changed`);
      }
    }
    for (const [rel, expected] of protectedByPath) {
      if (!freshOutside.has(rel)) findings.add(`${repository.name}:${rel}:pre-existing-dirty-status-disappeared`);
      else {
        const actual = protectedIdentity(checkedPath(root, rel, { label: "protected dirty path" }), rel);
        if (!sameIdentity(expected, actual)) findings.add(`${repository.name}:${rel}:pre-existing-dirty-changed`);
      }
    }
  }
  if (findings.size) fail(`out-of-grant mutation rejected: ${[...findings].sort().slice(0, 40).join(", ")}`);
}
function writeReverseEvidence(root, artifactRoot, state, before, after, changed) {
  const evidence = [];
  for (const rel of changed) {
    const repository = state.repositories.filter((repo) => isWithin(resolve(root, rel), repo.path)).sort((a, b) => b.path.length - a.path.length)[0];
    if (!repository) continue;
    const repoRel = relative(repository.path, resolve(root, rel));
    let tracked = false;
    try { command("git", ["-C", repository.path, "cat-file", "-e", `HEAD:${repoRel}`], repository.path); tracked = true; } catch { /* untracked evidence is a manifest only */ }
    if (!tracked) continue;
    const snapshot = before.files.find((entry) => entry.path === rel);
    const current = after.files.find((entry) => entry.path === rel);
    if (!snapshot || !current) continue; // exact snapshots still describe create/delete.
    const from = checkedPath(root, rel, { allowMissing: false, label: "reverse evidence" });
    const to = checkedArtifactPath(artifactRoot, snapshot.snapshot, "reverse snapshot");
    let patch = Buffer.alloc(0);
    try { patch = execFileSync("git", ["diff", "--binary", "--full-index", "--no-index", "--", from, to], { cwd: root, encoding: "buffer", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 }); }
    catch (error) { patch = Buffer.isBuffer(error.stdout) ? error.stdout : Buffer.from(""); if (!patch.length) fail(`could not produce binary-safe reverse evidence for ${rel}`); }
    const destination = join(artifactNodePath(artifactRoot, state.node), "reverse", `${HASH(Buffer.from(rel))}.patch`);
    writeAtomic(artifactRoot, destination, patch);
    evidence.push({ path: rel, tracked: true, reversePatch: relative(artifactRoot, destination), sha256: HASH(patch), bytes: patch.length });
  }
  return evidence.sort((a, b) => a.path.localeCompare(b.path));
}
function finish(options) {
  const node = validateNode(options.node);
  const root = checkedCanonicalRoot(options.root);
  const artifactRoot = checkedArtifactRoot(options.artifactRoot);
  const state = loadState(root, artifactRoot, node);
  if (state.state !== "active") fail(`finish requires active state, got ${state.state}`);
  assertOutsideUntouched(root, artifactRoot, state);
  const postimage = currentGrantSnapshot(root, state);
  const changedPaths = changedGrantPaths(state.preimage.grants, postimage);
  const reversePatches = writeReverseEvidence(root, artifactRoot, state, state.preimage.grants, postimage, changedPaths);
  const initiallyAbsent = state.preimage.grants.absentDirectories;
  const createdDirectories = [...new Set([
    ...initiallyAbsent,
    ...postimage.directories.filter((rel) => initiallyAbsent.some((base) => rel === base || rel.startsWith(`${base}/`))),
  ])].filter((rel) => existsSync(checkedPath(root, rel, { label: "created directory" })) && lstatSync(checkedPath(root, rel, { label: "created directory" })).isDirectory()).sort();
  state.postimage = { grants: postimage, changedPaths, createdDirectories, reversePatches, finishedAt: new Date().toISOString() };
  state.state = "finished";
  writeAtomic(artifactRoot, statePath(artifactRoot, node), json(state));
  const recovery = { schemaVersion: VERSION, node, root, changedPaths, grantSha256: HASH(Buffer.from(JSON.stringify(stable(postimage)))), reversePatches };
  writeAtomic(artifactRoot, join(artifactNodePath(artifactRoot, node), "recovery-manifest.json"), json(recovery));
  process.stdout.write(json({ ok: true, node, state: state.state, changedPaths, recoveryManifest: join(artifactNodePath(artifactRoot, node), "recovery-manifest.json") }));
}
function inspect(options) {
  const node = validateNode(options.node);
  const root = checkedCanonicalRoot(options.root);
  const artifactRoot = checkedArtifactRoot(options.artifactRoot);
  if (options.repoRoots.length || options.grants.length || options.grantJson || options.maxFiles || options.maxBytes || options.dryRun) fail("inspect accepts only --node, --root, and --artifact-root");
  const state = loadState(root, artifactRoot, node);
  process.stdout.write(json({ schemaVersion: VERSION, node: state.node, root: state.root, artifactRoot: state.artifactRoot, state: state.state, grants: state.grants, limits: state.limits, repositories: state.repositories.map(({ name, relative }) => ({ name, relative })), preimage: state.preimage, postimage: state.postimage ?? null }));
}
function safeRemoveEmptyDirectories(root, directories, dryRun) {
  for (const rel of [...directories].sort((a, b) => b.length - a.length || a.localeCompare(b))) {
    const path = checkedPath(root, rel, { label: "created grant directory" });
    if (!existsSync(path)) continue;
    const stat = rejectSpecial(path, "created grant directory");
    if (!stat.isDirectory()) fail(`created grant directory replaced: ${rel}`);
    if (readdirSync(path).length === 0 && !dryRun) rmdirSync(path);
  }
}
function restore(options) {
  const node = validateNode(options.node);
  const root = checkedCanonicalRoot(options.root);
  const artifactRoot = checkedArtifactRoot(options.artifactRoot);
  if (options.repoRoots.length || options.grants.length || options.grantJson || options.maxFiles || options.maxBytes) fail("restore accepts only --node, --root, --artifact-root, and optional --dry-run");
  const state = loadState(root, artifactRoot, node);
  if (state.state !== "finished") fail(`restore requires finished state, got ${state.state}`);
  const before = state.preimage.grants;
  const after = state.postimage?.grants;
  if (!after) fail("finished state lacks postimage");
  const beforeByPath = new Map(before.files.map((entry) => [entry.path, entry]));
  const afterByPath = new Map(after.files.map((entry) => [entry.path, entry]));
  const actions = [];
  for (const [rel, initial] of beforeByPath) {
    const current = fileIdentity(checkedPath(root, rel, { label: "restore target" }), rel);
    const post = afterByPath.get(rel) ?? { path: rel, state: "absent" };
    if (sameIdentity(current, initial)) continue;
    if (!sameIdentity(current, post)) fail(`restore refuses divergent granted file: ${rel}`);
    actions.push({ action: "restore", path: rel, snapshot: initial.snapshot });
  }
  for (const [rel, post] of afterByPath) {
    if (beforeByPath.has(rel)) continue;
    const current = fileIdentity(checkedPath(root, rel, { label: "remove created target" }), rel);
    if (current.state === "absent") continue;
    if (!sameIdentity(current, post)) fail(`restore refuses divergent created file: ${rel}`);
    actions.push({ action: "remove", path: rel });
  }
  for (const rel of before.absentExact) {
    const post = afterByPath.get(rel);
    const current = fileIdentity(checkedPath(root, rel, { label: "remove absent exact target" }), rel);
    if (current.state === "absent") continue;
    if (!post || !sameIdentity(current, post)) fail(`restore refuses unproven created exact file: ${rel}`);
    actions.push({ action: "remove", path: rel });
  }
  const uniqueActions = [...new Map(actions.map((entry) => [`${entry.action}:${entry.path}`, entry])).values()].sort((a, b) => a.path.localeCompare(b.path));
  if (!options.dryRun) {
    for (const action of uniqueActions) {
      const target = checkedPath(root, action.path, { label: "restore write" });
      if (action.action === "remove") unlinkSync(target);
      else {
        const snapshot = checkedArtifactPath(artifactRoot, action.snapshot, "restore snapshot");
        const bytes = readFileSync(snapshot);
        writeFileSync(target, bytes, { mode: beforeByPath.get(action.path).mode });
        chmodSync(target, beforeByPath.get(action.path).mode);
      }
    }
    safeRemoveEmptyDirectories(root, state.postimage.createdDirectories ?? [], false);
    state.state = "restored";
    state.restoredAt = new Date().toISOString();
    writeAtomic(artifactRoot, statePath(artifactRoot, node), json(state));
  }
  process.stdout.write(json({ ok: true, node, dryRun: options.dryRun, actions: uniqueActions }));
}
function invokeSelf(script, args, env = {}) {
  try { return execFileSync(process.execPath, [script, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } }); }
  catch (error) { return { failed: true, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? "") }; }
}
function selfTest() {
  const root = mkdtempSync(join(tmpdir(), "context-magnet-recovery-"));
  const artifactRoot = mkdtempSync(join(tmpdir(), "context-magnet-recovery-artifacts-"));
  const script = resolve(process.argv[1]);
  const node = "fixture-node";
  const repo = join(root, "repo");
  const rawRun = (args, env) => invokeSelf(script, args, env);
  const run = (args, env) => {
    if (args[0] !== "begin" || !args.includes("--root") || args.includes(`parent=${root}`)) return rawRun(args, env);
    const insertAt = args.findIndex((value) => value === "--grant" || value === "--grant-json");
    if (insertAt < 0) return rawRun(args, env);
    return rawRun([...args.slice(0, insertAt), "--repo-root", `parent=${root}`, ...args.slice(insertAt)], env);
  };
  const expectOk = (result, label) => { if (result?.failed) fail(`${label} unexpectedly failed: ${result.stderr}`); return result; };
  const expectFail = (result, witness) => { if (!result?.failed) fail(`${witness} unexpectedly succeeded`); return result.stderr.trim().split("\n").slice(-1)[0]; };
  try {
    command("git", ["init", "-q"], root); command("git", ["config", "user.email", "fixture@example.test"], root); command("git", ["config", "user.name", "Fixture"], root);
    command("git", ["init", "-q"], artifactRoot); command("git", ["config", "user.email", "fixture@example.test"], artifactRoot); command("git", ["config", "user.name", "Fixture"], artifactRoot);
    mkdirSync(repo, { recursive: true });
    command("git", ["init", "-q"], repo); command("git", ["config", "user.email", "fixture@example.test"], repo); command("git", ["config", "user.name", "Fixture"], repo);
    writeFileSync(join(repo, "clean.txt"), "clean-before\n"); writeFileSync(join(repo, "allowed.txt"), "allowed-before\n"); writeFileSync(join(repo, "outside.txt"), "outside-before\n");
    command("git", ["add", "."], repo); command("git", ["commit", "-qm", "fixture"], repo);
    command("git", ["-C", root, "add", "repo"], root); command("git", ["-C", root, "commit", "-qm", "nested gitlink"], root);
    writeFileSync(join(repo, "dirty.txt"), "dirty-before\n"); writeFileSync(join(repo, "untracked.txt"), "untracked-before\n");
    writeFileSync(join(repo, "granted-dirty.txt"), "tracked-base\n"); command("git", ["add", "granted-dirty.txt"], repo); command("git", ["commit", "-qm", "grant-dirty-base"], repo); writeFileSync(join(repo, "granted-dirty.txt"), "tracked-dirty-before\n");
    writeFileSync(join(repo, "granted-untracked.txt"), "untracked-before\n");
    // Keep unrelated dirty data byte-for-byte through the entire exercise.
    writeFileSync(join(repo, "unrelated.txt"), "unrelated-before\n");
    const unrelated = readFileSync(join(repo, "unrelated.txt"));
    const base = ["--node", node, "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/allowed.txt", "--grant", "repo/new.txt", "--grant", "repo/granted-dirty.txt", "--grant", "repo/granted-untracked.txt"];
    expectOk(run(["begin", ...base]), "begin");
    writeFileSync(join(repo, "dirty.txt"), "dirty-mutated\n");
    const dirtyWitness = expectFail(run(["finish", "--node", node, "--root", root, "--artifact-root", artifactRoot]), "pre-existing dirty out-of-grant edit");
    writeFileSync(join(repo, "dirty.txt"), "dirty-before\n");
    writeFileSync(join(repo, "clean.txt"), "clean-mutated\n");
    const cleanWitness = expectFail(run(["finish", "--node", node, "--root", root, "--artifact-root", artifactRoot]), "clean tracked out-of-grant edit");
    writeFileSync(join(repo, "clean.txt"), "clean-before\n");
    writeFileSync(join(repo, "untracked.txt"), "untracked-mutated\n");
    const untrackedWitness = expectFail(run(["finish", "--node", node, "--root", root, "--artifact-root", artifactRoot]), "pre-existing untracked out-of-grant edit");
    writeFileSync(join(repo, "untracked.txt"), "untracked-before\n");
    writeFileSync(join(repo, "outside-new.txt"), "outside-new\n");
    const newWitness = expectFail(run(["finish", "--node", node, "--root", root, "--artifact-root", artifactRoot]), "new out-of-grant path");
    unlinkSync(join(repo, "outside-new.txt"));
    writeFileSync(join(repo, "allowed.txt"), "allowed-after\n"); writeFileSync(join(repo, "new.txt"), "new-grant-file\n");
    writeFileSync(join(repo, "granted-dirty.txt"), "tracked-dirty-after\n"); writeFileSync(join(repo, "granted-untracked.txt"), "untracked-after\n");
    expectOk(run(["finish", "--node", node, "--root", root, "--artifact-root", artifactRoot]), "finish");
    const finished = JSON.parse(expectOk(run(["inspect", "--node", node, "--root", root, "--artifact-root", artifactRoot]), "inspect finished"));
    for (const expectedPath of ["repo/allowed.txt", "repo/new.txt", "repo/granted-dirty.txt", "repo/granted-untracked.txt"]) {
      if (!finished.postimage.changedPaths.includes(expectedPath)) fail(`finish did not record granted change: ${expectedPath}`);
    }
    const dryBefore = readFileSync(join(repo, "allowed.txt"));
    expectOk(run(["restore", "--node", node, "--root", root, "--artifact-root", artifactRoot, "--dry-run"]), "restore dry-run");
    if (!readFileSync(join(repo, "allowed.txt")).equals(dryBefore) || !existsSync(join(repo, "new.txt"))) fail("restore dry-run changed fixture");
    expectOk(run(["restore", "--node", node, "--root", root, "--artifact-root", artifactRoot]), "restore");
    if (readFileSync(join(repo, "allowed.txt"), "utf8") !== "allowed-before\n" || readFileSync(join(repo, "granted-dirty.txt"), "utf8") !== "tracked-dirty-before\n" || readFileSync(join(repo, "granted-untracked.txt"), "utf8") !== "untracked-before\n" || existsSync(join(repo, "new.txt"))) fail("grant restoration failed");
    if (readFileSync(join(repo, "dirty.txt"), "utf8") !== "dirty-before\n" || readFileSync(join(repo, "untracked.txt"), "utf8") !== "untracked-before\n") fail("protected dirty/untracked paths changed");
    if (!readFileSync(join(repo, "unrelated.txt")).equals(unrelated)) fail("unrelated dirty file changed");
    if (command("git", ["-C", root, "status", "--porcelain=v1"], root).toString("utf8").includes(artifactRoot)) fail("distinct artifact root leaked into target status");

    // Absent exact and directory grants record only their missing components;
    // restoration removes the proven files and then those proven-empty parents.
    const absentBase = ["--node", "absent-grants", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/absent-tree/**", "--grant", "repo/absent-parents/a/new.txt"];
    expectOk(run(["begin", ...absentBase]), "absent grant begin");
    mkdirSync(join(repo, "absent-tree", "empty"), { recursive: true }); mkdirSync(join(repo, "absent-tree", "nested"), { recursive: true });
    writeFileSync(join(repo, "absent-tree", "nested", "file.txt"), "created\n"); mkdirSync(join(repo, "absent-parents", "a"), { recursive: true }); writeFileSync(join(repo, "absent-parents", "a", "new.txt"), "exact\n");
    expectOk(run(["finish", "--node", "absent-grants", "--root", root, "--artifact-root", artifactRoot]), "absent grant finish");
    expectOk(run(["restore", "--node", "absent-grants", "--root", root, "--artifact-root", artifactRoot]), "absent grant restore");
    if (existsSync(join(repo, "absent-tree")) || existsSync(join(repo, "absent-parents"))) fail("absent grant restoration left proven-empty parents");

    // The target root may parent an explicit nested gitlink.  Parent status
    // must skip only that exact child and the child repository supplies it.
    const nestedArgs = ["--node", "nested-parent", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `parent=${root}`, "--repo-root", `child=${repo}`, "--grant", "repo/allowed.txt"];
    expectOk(run(["begin", ...nestedArgs]), "nested parent begin");
    const nestedState = JSON.parse(expectOk(run(["inspect", "--node", "nested-parent", "--root", root, "--artifact-root", artifactRoot]), "nested parent inspect"));
    if (nestedState.preimage.repositories.find((entry) => entry.name === "parent").status.some((entry) => entry.path === "repo")) fail("parent status retained explicit nested repository entry");
    expectOk(run(["finish", "--node", "nested-parent", "--root", root, "--artifact-root", artifactRoot]), "nested parent finish");

    // An explicitly supplied in-target artifact root excludes only this node's
    // state. A sibling artifact remains an observable out-of-grant mutation.
    const internalArtifacts = join(root, "internal-artifacts");
    const internalArgs = ["--node", "internal-current", "--root", root, "--artifact-root", internalArtifacts, "--repo-root", `parent=${root}`, "--repo-root", `child=${repo}`, "--grant", "repo/allowed.txt"];
    expectOk(run(["begin", ...internalArgs]), "internal artifact begin");
    mkdirSync(join(internalArtifacts, "sibling"), { recursive: true }); writeFileSync(join(internalArtifacts, "sibling", "foreign.json"), "foreign\n");
    const siblingArtifactWitness = expectFail(run(["finish", "--node", "internal-current", "--root", root, "--artifact-root", internalArtifacts]), "sibling artifact mutation");
    rmSync(join(internalArtifacts, "sibling"), { recursive: true, force: true });
    expectOk(run(["finish", "--node", "internal-current", "--root", root, "--artifact-root", internalArtifacts]), "internal artifact finish");

    // Protected hashes stream independently of the grant-copy budget.
    writeFileSync(join(repo, "tiny.txt"), "x"); writeFileSync(join(repo, "protected-large.txt"), Buffer.alloc(2 * 1024 * 1024, 7));
    const largeArgs = ["--node", "protected-large", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant-json", '{"grants":["repo/tiny.txt"],"maxBytes":1}'];
    expectOk(run(["begin", ...largeArgs]), "large protected begin");
    writeFileSync(join(repo, "protected-large.txt"), Buffer.alloc(2 * 1024 * 1024, 8));
    const protectedLargeWitness = expectFail(run(["finish", "--node", "protected-large", "--root", root, "--artifact-root", artifactRoot]), "large protected mutation");
    writeFileSync(join(repo, "protected-large.txt"), Buffer.alloc(2 * 1024 * 1024, 7));
    expectOk(run(["finish", "--node", "protected-large", "--root", root, "--artifact-root", artifactRoot]), "large protected finish");

    // HEAD and index are independent preimage witnesses, not consequences of
    // porcelain status. Restore only this exact temporary fixture afterward.
    const headArgs = ["--node", "head-drift", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/allowed.txt"];
    expectOk(run(["begin", ...headArgs]), "head drift begin");
    const oldHead = command("git", ["-C", repo, "rev-parse", "HEAD"], repo).toString("utf8").trim();
    command("git", ["-C", repo, "commit", "--allow-empty", "-qm", "temporary head drift"], repo);
    const headWitness = expectFail(run(["finish", "--node", "head-drift", "--root", root, "--artifact-root", artifactRoot]), "HEAD drift");
    command("git", ["-C", repo, "update-ref", "HEAD", oldHead], repo);
    expectOk(run(["finish", "--node", "head-drift", "--root", root, "--artifact-root", artifactRoot]), "head drift recovery");
    const indexArgs = ["--node", "index-drift", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/allowed.txt"];
    expectOk(run(["begin", ...indexArgs]), "index drift begin");
    writeFileSync(join(repo, "index-only.txt"), "index\n"); command("git", ["-C", repo, "add", "index-only.txt"], repo);
    const indexWitness = expectFail(run(["finish", "--node", "index-drift", "--root", root, "--artifact-root", artifactRoot]), "index drift");
    command("git", ["-C", repo, "update-index", "--force-remove", "index-only.txt"], repo); unlinkSync(join(repo, "index-only.txt"));
    expectOk(run(["finish", "--node", "index-drift", "--root", root, "--artifact-root", artifactRoot]), "index drift recovery");

    // A root -> child -> grandchild chain is accepted only through each
    // explicit nearest-parent gitlink; each parent skips just its direct child.
    const grand = join(repo, "grand"); mkdirSync(grand); command("git", ["init", "-q"], grand); command("git", ["config", "user.email", "fixture@example.test"], grand); command("git", ["config", "user.name", "Fixture"], grand); writeFileSync(join(grand, "leaf.txt"), "leaf\n"); command("git", ["-C", grand, "add", "."], grand); command("git", ["-C", grand, "commit", "-qm", "leaf"], grand);
    command("git", ["-C", repo, "add", "grand"], repo); command("git", ["-C", repo, "commit", "-qm", "nested grand gitlink"], repo);
    const chainArgs = ["--node", "nested-chain", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `parent=${root}`, "--repo-root", `child=${repo}`, "--repo-root", `grand=${grand}`, "--grant", "repo/allowed.txt"];
    expectOk(run(["begin", ...chainArgs]), "nested chain begin");
    const chainState = JSON.parse(expectOk(run(["inspect", "--node", "nested-chain", "--root", root, "--artifact-root", artifactRoot]), "nested chain inspect"));
    if (chainState.preimage.repositories.find((entry) => entry.name === "child").status.some((entry) => entry.path === "grand")) fail("child status retained explicit nested gitlink");
    expectOk(run(["finish", "--node", "nested-chain", "--root", root, "--artifact-root", artifactRoot]), "nested chain finish");
    const unsafe = [];
    unsafe.push(expectFail(rawRun(["begin", "--node", "missing-root-scope", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/allowed.txt"]), "missing root repository scope"));
    const grandHead = command("git", ["-C", grand, "rev-parse", "HEAD"], grand).toString("utf8").trim();
    command("git", ["-C", repo, "update-index", "--add", "--cacheinfo", `160000,${"1".repeat(40)},grand`], repo);
    if (!command("git", ["-C", repo, "ls-files", "--stage", "--", "grand"], repo).toString("utf8").includes("1".repeat(40))) fail("dirty gitlink fixture was not staged");
    unsafe.push(expectFail(run(["begin", "--node", "missing-gitlink-scope", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `parent=${root}`, "--repo-root", `fixture=${repo}`, "--grant", "repo/allowed.txt"]), "missing explicit dirty gitlink scope"));
    command("git", ["-C", repo, "update-index", "--add", "--cacheinfo", `160000,${grandHead},grand`], repo);
    rmSync(join(artifactRoot, "missing-gitlink-scope"), { recursive: true, force: true });
    unsafe.push(expectFail(run(["begin", "--node", "artifact-grant-overlap", "--root", root, "--artifact-root", internalArtifacts, "--repo-root", `parent=${root}`, "--repo-root", `child=${repo}`, "--grant", "internal-artifacts/**"]), "artifact grant overlap"));
    unsafe.push(expectFail(run(["begin", "--node", "missing-root", "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/allowed.txt"]), "missing root"));
    unsafe.push(expectFail(run(["begin", "--node", "missing-artifact", "--root", root, "--repo-root", `fixture=${repo}`, "--grant", "repo/allowed.txt"]), "missing artifact root"));
    unsafe.push(expectFail(run(["begin", "--node", "root-slash", "--root", "/", "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/allowed.txt"]), "root slash"));
    mkdirSync(join(root, "not-git")); unsafe.push(expectFail(run(["begin", "--node", "root-nongit", "--root", join(root, "not-git"), "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/allowed.txt"]), "non-git root"));
    try { execFileSync("ln", ["-s", repo, join(root, "root-link")]); unsafe.push(expectFail(run(["begin", "--node", "root-link", "--root", join(root, "root-link"), "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/allowed.txt"]), "symlink root")); unlinkSync(join(root, "root-link")); } catch { unsafe.push("symlink-root fixture unavailable"); }
    unsafe.push(expectFail(run(["begin", "--node", "traversal", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "../escape"]), "traversal"));
    mkdirSync(join(repo, "dir")); writeFileSync(join(repo, "dir", "item"), "x");
    try { execFileSync("ln", ["-s", "../allowed.txt", join(repo, "dir", "link")]); unsafe.push(expectFail(run(["begin", "--node", "symlink", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/dir/**"]), "symlink")); unlinkSync(join(repo, "dir", "link")); rmSync(join(repo, "dir"), { recursive: true, force: true }); } catch { unsafe.push("symlink fixture unavailable"); }
    try { execFileSync("mkfifo", [join(repo, "fifo")]); unsafe.push(expectFail(run(["begin", "--node", "fifo", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/fifo"]), "FIFO")); unlinkSync(join(repo, "fifo")); } catch { unsafe.push("FIFO fixture unavailable"); }
    writeFileSync(join(repo, "large.txt"), "too-large"); unsafe.push(expectFail(run(["begin", "--node", "oversize", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant-json", '{"grants":["repo/large.txt"],"maxBytes":1}']), "oversize"));
    unsafe.push(expectFail(run(["begin", "--node", "oversize", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/allowed.txt"]), "prior artifact"));
    const rogue = join(repo, "rogue-nested"); mkdirSync(rogue); command("git", ["init", "-q"], rogue);
    unsafe.push(expectFail(run(["begin", "--node", "bad-nested", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--repo-root", `rogue=${rogue}`, "--grant", "repo/allowed.txt"]), "unapproved nested root"));
    rmSync(rogue, { recursive: true, force: true });
    expectOk(run(["begin", "--node", "overlap-a", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/allowed.txt"]), "overlap begin");
    unsafe.push(expectFail(run(["begin", "--node", "overlap-b", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/allowed.txt"]), "overlap"));
    expectOk(run(["finish", "--node", "overlap-a", "--root", root, "--artifact-root", artifactRoot]), "overlap finish");
    writeFileSync(join(repo, "interrupt.txt"), "interrupt");
    const interrupted = expectFail(run(["begin", "--node", "interrupted", "--root", root, "--artifact-root", artifactRoot, "--repo-root", `fixture=${repo}`, "--grant", "repo/interrupt.txt"], { RECOVERY_HARNESS_INTERRUPT_AFTER_CAPTURE: "1" }), "interrupted capture");
    expectOk(run(["inspect", "--node", "interrupted", "--root", root, "--artifact-root", artifactRoot]), "inspect interrupted capture");
    process.stdout.write(json({ ok: true, selfTest: true, rootRetired: true, failureWitnesses: { dirtyWitness, cleanWitness, untrackedWitness, newWitness, siblingArtifactWitness, protectedLargeWitness, headWitness, indexWitness, unsafe, interrupted } }));
  } finally {
    // These are the exact mkdtemp target and artifact roots created above.
    rmSync(root, { recursive: true, force: true });
    rmSync(artifactRoot, { recursive: true, force: true });
  }
}
function main() {
  const { subcommand, options } = parseArgs(process.argv.slice(2));
  if (subcommand === "self-test") {
    if (Object.keys(options).some((key) => key !== "grants" && key !== "repoRoots" && key !== "dryRun") || options.grants.length || options.repoRoots.length || options.dryRun) fail("self-test accepts no options");
    selfTest(); return;
  }
  if (!["begin", "finish", "inspect", "restore"].includes(subcommand)) fail(usage());
  if (subcommand === "begin") begin(options);
  else if (subcommand === "finish") finish(options);
  else if (subcommand === "inspect") inspect(options);
  else restore(options);
}
try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
