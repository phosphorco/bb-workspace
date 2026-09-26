import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, renameSync, truncateSync, writeFileSync } from "node:fs";
import { lstat, mkdtemp, mkdir, readFile, readdir, readlink, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { BACKUP_KIND, MAX_ENVELOPE_BYTES, backupIdentity, capture, createFixtureScope, parse, restore, serialize } from "./context-magnet-session-etl-plugin-backup.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const outputs = ["app.css", "app.js", "app.meta.json", "server.js", "server.js.map", "server.meta.json"];

async function put(pathname, text, mode = 0o644) {
  await mkdir(dirname(pathname), { recursive: true });
  await writeFile(pathname, text, { mode });
  chmodSync(pathname, mode);
}

function generationWithContents(contents, runtime = "/opt/pinned-bun") {
  const files = Object.fromEntries(
    Object.entries(contents)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, contents]) => [name, hash(contents)]),
  );
  const digest = hash(JSON.stringify({ formatVersion: 1, files }));
  return { digest, files, contents, json: JSON.stringify({ formatVersion: 1, digest, files, capabilities: { runtimeExecPath: runtime, runtimeVersion: "1.2.3", bun: "1.2.3", sqliteAvailable: true, sqliteError: null } }) };
}

function generation(names, runtime = "/opt/pinned-bun") {
  return generationWithContents(
    Object.fromEntries(names.map((name) => [name, "router:" + name])),
    runtime,
  );
}

async function install(scope, data) {
  for (const name of Object.keys(data.files)) await put(join(scope.routerLibRoot, "versions", data.digest, name), data.contents[name]);
  await put(join(scope.routerLibRoot, "versions", data.digest, "manifest.json"), data.json, 0o600);
}

function launcher(scope, digest, runtime = "/opt/pinned-bun") {
  return `#!/bin/sh\nexec '${runtime}' '${join(scope.routerLibRoot, "versions", digest, "router.mjs")}' "$@"\n`;
}

async function fixture(t, { hook = true, distMode = null } = {}) {
  const root = await mkdtemp(join(os.tmpdir(), "backup-v1-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scope = createFixtureScope(root);
  for (const id of ["context-magnet-inspector", "subscription-router"])
    for (const name of outputs)
      await put(join(scope.pluginRoots[id], name), id + ":" + name, distMode ?? (name.endsWith(".js") ? 0o755 : 0o644));
  const active = generation(["router.mjs", "state.mjs"]);
  await install(scope, active);
  for (const prefix of ["1", "2", "3", "4", "5", "6", "7", "8"])
    await mkdir(join(scope.routerLibRoot, "versions", prefix.repeat(64)), { recursive: true });
  await put(join(scope.routerLibRoot, "router-command"), launcher(scope, active.digest), 0o700);
  await symlink("router-command", join(scope.routerLibRoot, "router.mjs"));
  await symlink("/opt/pinned-bun", join(scope.routerLibRoot, "bun"));
  if (hook) await put(scope.hookPath, "saved hook", 0o600);
  return { root, scope, active };
}

function controlledEqual(saved, fresh) {
  assert.deepEqual(fresh.scope, saved.scope);
  assert.equal(fresh.generation, saved.generation);
  assert.deepEqual(fresh.records, saved.records);
  for (const name of saved.preimageGenerations) assert.ok(fresh.preimageGenerations.includes(name));
}

async function treeDigest(root) {
  const lines = [];
  async function visit(pathname, prefix = "") {
    const entries = await readdir(pathname, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = join(pathname, entry.name), label = prefix ? prefix + "/" + entry.name : entry.name;
      if (entry.isDirectory()) { lines.push("d " + label); await visit(child, label); }
      else if (entry.isSymbolicLink()) lines.push("l " + label + " " + (await readlink(child)));
      else { const metadata = await stat(child); lines.push("f " + label + " " + (metadata.mode & 0o777) + " " + hash(await readFile(child))); }
    }
  }
  await visit(root);
  return hash(lines.join("\n"));
}

async function inodeAndMtime(pathname, alias = false) {
  const metadata = await (alias ? lstat(pathname, { bigint: true }) : stat(pathname, { bigint: true }));
  return { ino: metadata.ino, mtimeNs: metadata.mtimeNs };
}

async function routerIdentity(scope, active) {
  const paths = [
    ...Object.keys(active.files).sort().map((name) => join(scope.routerLibRoot, "versions", active.digest, name)),
    join(scope.routerLibRoot, "versions", active.digest, "manifest.json"),
    join(scope.routerLibRoot, "router-command"),
    join(scope.routerLibRoot, "router.mjs"),
    join(scope.routerLibRoot, "bun"),
  ];
  return Object.fromEntries(
    await Promise.all(paths.map(async (pathname) => [
      pathname,
      await inodeAndMtime(pathname, pathname.endsWith("/router.mjs") || pathname.endsWith("/bun")),
    ])),
  );
}

async function identityVariant(t, label, mutate) {
  const { scope, active } = await fixture(t);
  const before = backupIdentity(capture(scope));
  await mutate({ scope, active });
  assert.notEqual(backupIdentity(capture(scope)), before, label);
}

test("real layout capture binds the active router, runtime, capabilities, and artifacts", async (t) => {
  const { scope, active } = await fixture(t);
  const backup = capture(scope);
  assert.equal(backup.generation, active.digest);
  assert.equal(backup.preimageGenerations.length, 9);
  assert.equal(backupIdentity(backup), backupIdentity(parse(serialize(backup))));
  assert.equal(backup.records.find((record) => record.target === "launcher:router-command").mode, 0o700);
  assert.equal(backup.records.find((record) => record.target === "runtime:bun").linkTarget, "/opt/pinned-bun");
  assert.ok(backup.records.some((record) => record.target === "router-file" && record.relativePath === "router.mjs"));
});

test("both six-file direct dist trees at 0664 round trip and restore exactly", async (t) => {
  const { scope } = await fixture(t, { distMode: 0o664 });
  const saved = capture(scope);
  const pluginRecords = saved.records.filter((record) => record.target.startsWith("plugin:"));
  assert.equal(pluginRecords.length, 12);
  for (const id of ["context-magnet-inspector", "subscription-router"]) {
    assert.deepEqual(
      pluginRecords.filter((record) => record.target === "plugin:" + id).map((record) => record.relativePath),
      outputs,
    );
  }
  assert.ok(pluginRecords.every((record) => record.kind === "regular-file" && record.mode === 0o664));
  const roundTrip = parse(serialize(saved));
  controlledEqual(saved, roundTrip);
  assert.equal(backupIdentity(saved), backupIdentity(roundTrip));

  const changed = join(scope.pluginRoots["context-magnet-inspector"], "app.js");
  await put(changed, "changed dist", 0o644);
  const first = restore(scope, roundTrip, backupIdentity(saved));
  controlledEqual(saved, first);
  controlledEqual(saved, capture(scope));
  assert.equal((await stat(changed)).mode & 0o777, 0o664);
  const unchanged = join(scope.pluginRoots["subscription-router"], "server.js");
  const before = await inodeAndMtime(unchanged);
  const changedBefore = await inodeAndMtime(changed);
  const second = restore(scope, roundTrip, backupIdentity(saved));
  controlledEqual(saved, second);
  assert.deepEqual(await inodeAndMtime(unchanged), before);
  assert.deepEqual(await inodeAndMtime(changed), changedBefore);
});

test("0664 remains forbidden for router and hook capture and parsed records", async (t) => {
  for (const [label, destination] of [
    ["launcher", ({ scope }) => join(scope.routerLibRoot, "router-command")],
    ["manifest", ({ scope, active }) => join(scope.routerLibRoot, "versions", active.digest, "manifest.json")],
    ["router file", ({ scope, active }) => join(scope.routerLibRoot, "versions", active.digest, "state.mjs")],
    ["hook", ({ scope }) => scope.hookPath],
  ]) {
    const fixtureState = await fixture(t);
    const saved = capture(fixtureState.scope);
    const pathname = destination(fixtureState);
    const contents = await readFile(pathname);
    await put(pathname, contents, 0o664);
    assert.throws(() => capture(fixtureState.scope), /unsafe file/, label);
    const forged = JSON.parse(serialize(saved));
    const record = forged.records.find((item) =>
      item.target === (label === "launcher" ? "launcher:router-command" : label === "manifest" ? "router-manifest" : label === "router file" ? "router-file" : "hook") &&
      (label !== "router file" || item.relativePath === "state.mjs"),
    );
    record.mode = 0o664;
    assert.throws(() => parse(forged), /record bounds/, label);
  }
});

test("restoration repairs every controlled surface and returns a fresh post-capture", async (t) => {
  const { scope } = await fixture(t);
  const saved = capture(scope);
  const candidate = generation(["router.mjs", "state.mjs", "candidate.mjs"]);
  await install(scope, candidate);
  const candidateRoot = join(scope.routerLibRoot, "versions", candidate.digest);
  const candidateBefore = await treeDigest(candidateRoot);
  const oldInactive = join(scope.routerLibRoot, "versions", "1".repeat(64));
  await put(join(oldInactive, "retained.mjs"), "old inactive");
  const oldBefore = await treeDigest(oldInactive);
  await put(join(scope.pluginRoots["context-magnet-inspector"], "app.js"), "drift", 0o600);
  await put(join(scope.routerLibRoot, "router-command"), launcher(scope, candidate.digest), 0o644);
  await rm(join(scope.routerLibRoot, "router.mjs"));
  await symlink("not-router-command", join(scope.routerLibRoot, "router.mjs"));
  await rm(join(scope.routerLibRoot, "bun"));
  await symlink("/opt/drifted-bun", join(scope.routerLibRoot, "bun"));
  await put(scope.hookPath, "drifted hook", 0o644);
  const returned = restore(scope, saved, backupIdentity(saved));
  const independentlyCaptured = capture(scope);
  assert.notStrictEqual(returned, saved);
  controlledEqual(saved, returned);
  controlledEqual(saved, independentlyCaptured);
  assert.equal(await readlink(join(scope.routerLibRoot, "router.mjs")), "router-command");
  assert.equal(await readlink(join(scope.routerLibRoot, "bun")), "/opt/pinned-bun");
  assert.equal(candidateBefore, await treeDigest(candidateRoot));
  assert.equal(oldBefore, await treeDigest(oldInactive));
  assert.ok(returned.preimageGenerations.includes(candidate.digest));
  assert.equal(returned.generation, saved.generation);
});

test("failure rollback preserves byte-identical router inodes and mtimes", async (t) => {
  const { scope, active } = await fixture(t);
  const saved = capture(scope);
  const routerBefore = await routerIdentity(scope, active);
  await put(join(scope.pluginRoots["context-magnet-inspector"], "app.js"), "failed activation", 0o600);
  await put(scope.hookPath, "failed hook", 0o644);
  const restored = restore(scope, saved, backupIdentity(saved));
  controlledEqual(saved, restored);
  assert.deepEqual(await routerIdentity(scope, active), routerBefore);
  assert.equal(
    await readFile(join(scope.pluginRoots["context-magnet-inspector"], "app.js"), "utf8"),
    "context-magnet-inspector:app.js",
  );
  assert.equal(await readFile(scope.hookPath, "utf8"), "saved hook");
});

test("retained inactive generations remain byte-identical and cannot become active", async (t) => {
  const { scope, active } = await fixture(t);
  const saved = capture(scope);
  const candidate = generation(["router.mjs", "state.mjs", "later.mjs"]);
  await install(scope, candidate);
  const inactive = join(scope.routerLibRoot, "versions", "2".repeat(64));
  await put(join(inactive, "legacy.mjs"), "legacy generation");
  const candidateBefore = await treeDigest(join(scope.routerLibRoot, "versions", candidate.digest));
  const inactiveBefore = await treeDigest(inactive);
  await put(join(scope.routerLibRoot, "router-command"), launcher(scope, candidate.digest), 0o700);
  const fresh = restore(scope, saved, backupIdentity(saved));
  assert.equal(fresh.generation, active.digest);
  assert.match(await readFile(join(scope.routerLibRoot, "router-command"), "utf8"), new RegExp(active.digest));
  assert.equal(candidateBefore, await treeDigest(join(scope.routerLibRoot, "versions", candidate.digest)));
  assert.equal(inactiveBefore, await treeDigest(inactive));
});

test("production backup identity changes for every variable controlled surface", async (t) => {
  for (const id of ["context-magnet-inspector", "subscription-router"])
    for (const name of outputs)
      await identityVariant(t, "plugin " + id + "/" + name, async ({ scope }) => {
        await put(
          join(scope.pluginRoots[id], name),
          "changed " + id + "/" + name,
          name.endsWith(".js") ? 0o755 : 0o644,
        );
      });
  await identityVariant(t, "router manifest", async ({ scope, active }) => {
    const pathname = join(scope.routerLibRoot, "versions", active.digest, "manifest.json");
    const changed = JSON.parse(await readFile(pathname, "utf8"));
    changed.capabilities.runtimeVersion = "2.0.0";
    await put(pathname, JSON.stringify(changed), 0o600);
  });
  for (const name of ["router.mjs", "state.mjs"])
    await identityVariant(t, "router listed file " + name, async ({ scope }) => {
      const contents = { "router.mjs": "router:router.mjs", "state.mjs": "router:state.mjs" };
      contents[name] = "changed router:" + name;
      const changed = generationWithContents(contents);
      await install(scope, changed);
      await put(join(scope.routerLibRoot, "router-command"), launcher(scope, changed.digest), 0o700);
    });
  await identityVariant(t, "launcher", async ({ scope }) => {
    chmodSync(join(scope.routerLibRoot, "router-command"), 0o755);
  });
  await identityVariant(t, "lib/bun runtime alias", async ({ scope }) => {
    const changed = generation(["router.mjs", "state.mjs"], "/opt/other-bun");
    await install(scope, changed);
    await put(join(scope.routerLibRoot, "router-command"), launcher(scope, changed.digest, "/opt/other-bun"), 0o700);
    await rm(join(scope.routerLibRoot, "bun"));
    await symlink("/opt/other-bun", join(scope.routerLibRoot, "bun"));
  });
  await identityVariant(t, "retained generation list", async ({ scope }) => {
    await mkdir(join(scope.routerLibRoot, "versions", "a".repeat(64)));
  });
  await identityVariant(t, "hook", async ({ scope }) => {
    await put(scope.hookPath, "changed hook", 0o600);
  });
  const first = await fixture(t), second = await fixture(t);
  assert.notEqual(backupIdentity(capture(first.scope)), backupIdentity(capture(second.scope)), "scope");
});

test("wrong and stale production identities reject before any filesystem mutation", async (t) => {
  const { root, scope } = await fixture(t);
  const saved = capture(scope), before = await treeDigest(root);
  assert.throws(() => restore(scope, saved, "0".repeat(64)), /backup identity mismatch/);
  const staleFixture = await fixture(t);
  const stale = backupIdentity(capture(staleFixture.scope));
  assert.notEqual(stale, backupIdentity(saved));
  assert.throws(() => restore(scope, saved, stale), /backup identity mismatch/);
  assert.equal(await treeDigest(root), before);
});

test("an absent hook restores as absent and repeated restoration is idempotent", async (t) => {
  const { scope } = await fixture(t, { hook: false });
  const saved = capture(scope);
  assert.equal(saved.records.find((record) => record.target === "hook").kind, "absent");
  await put(scope.hookPath, "unexpected hook", 0o600);
  const first = restore(scope, saved, backupIdentity(saved));
  await assert.rejects(readFile(scope.hookPath), { code: "ENOENT" });
  const second = restore(scope, saved, backupIdentity(saved));
  controlledEqual(saved, first);
  controlledEqual(saved, second);
});

test("launcher, alias, runtime, and capabilities attacks are rejected by capture", async (t) => {
  const { scope, active } = await fixture(t);
  await put(join(scope.routerLibRoot, "router-command"), launcher(scope, active.digest, "/opt/attacker-bun"), 0o700);
  assert.throws(() => capture(scope), /runtime identity/);
  await put(join(scope.routerLibRoot, "router-command"), launcher(scope, active.digest), 0o700);
  await rm(join(scope.routerLibRoot, "router.mjs")); await symlink("not-router-command", join(scope.routerLibRoot, "router.mjs"));
  assert.throws(() => capture(scope), /unsafe symlink target/);
  await rm(join(scope.routerLibRoot, "router.mjs")); await symlink("router-command", join(scope.routerLibRoot, "router.mjs"));
  await rm(join(scope.routerLibRoot, "bun")); await symlink("relative-bun", join(scope.routerLibRoot, "bun"));
  assert.throws(() => capture(scope), /unsafe runtime target/);
  await rm(join(scope.routerLibRoot, "bun")); await symlink("/opt/pinned-bun", join(scope.routerLibRoot, "bun"));
  const manifestPath = join(scope.routerLibRoot, "versions", active.digest, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.capabilities.runtimeExecPath = "/opt/attacker-bun";
  await put(manifestPath, JSON.stringify(manifest), 0o600);
  assert.throws(() => capture(scope), /runtime identity/);
});

test("foreign targets and target-path mismatches reject before restore mutation", async (t) => {
  const { root, scope } = await fixture(t);
  const saved = capture(scope), before = await treeDigest(root);
  const foreign = JSON.parse(serialize(saved));
  Object.assign(
    foreign.records.find((record) => record.target.startsWith("plugin:")),
    { target: "foreign", relativePath: "shared-hooks.json" },
  );
  assert.throws(
    () => restore(scope, foreign, backupIdentity(saved)),
    /record bounds/,
  );
  assert.equal(await treeDigest(root), before);
  const hookMapping = JSON.parse(serialize(saved));
  Object.assign(
    hookMapping.records.find((record) => record.target.startsWith("plugin:")),
    { target: "hook", relativePath: "app.js" },
  );
  assert.throws(
    () => restore(scope, hookMapping, backupIdentity(saved)),
    /record bounds/,
  );
  assert.equal(await treeDigest(root), before);
  const manifestMapping = JSON.parse(serialize(saved));
  Object.assign(
    manifestMapping.records.find((record) => record.target === "router-manifest"),
    { relativePath: "state.mjs" },
  );
  assert.throws(
    () => restore(scope, manifestMapping, backupIdentity(saved)),
    /record bounds/,
  );
  assert.equal(await treeDigest(root), before);
  const nested = JSON.parse(serialize(saved));
  const bytes = Buffer.from("nested plugin record");
  nested.records.push({
    target: "plugin:context-magnet-inspector",
    relativePath: "nested/extra.js",
    kind: "regular-file",
    present: true,
    mode: 0o644,
    byteLength: bytes.length,
    sha256: hash(bytes),
    bytesBase64: bytes.toString("base64"),
    linkTarget: null,
  });
  nested.records.sort((left, right) => (left.target + "\0" + left.relativePath).localeCompare(right.target + "\0" + right.relativePath));
  nested.recordCount += 1;
  nested.totalBytes += bytes.length;
  assert.throws(
    () => restore(scope, nested, backupIdentity(saved)),
    /record bounds/,
  );
  assert.equal(await treeDigest(root), before);
});

test("the fixed router.mjs alias rejects target, kind, and presence deviations", async (t) => {
  const { scope } = await fixture(t);
  const saved = capture(scope);
  const alias = (raw) => raw.records.find((record) => record.target === "launcher:router.mjs");
  const wrongTarget = JSON.parse(serialize(saved));
  alias(wrongTarget).linkTarget = "other-command";
  assert.throws(() => parse(wrongTarget), /symlink record/);
  const wrongKind = JSON.parse(serialize(saved));
  alias(wrongKind).kind = "regular-file";
  assert.throws(() => parse(wrongKind), /record bounds/);
  const absent = JSON.parse(serialize(saved));
  alias(absent).present = false;
  assert.throws(() => parse(absent), /symlink record/);
  await rm(join(scope.routerLibRoot, "router.mjs"));
  await put(join(scope.routerLibRoot, "router.mjs"), "not an alias", 0o644);
  assert.throws(() => capture(scope), /expected symlink/);
  await rm(join(scope.routerLibRoot, "router.mjs"));
  assert.throws(() => capture(scope), /ENOENT/);
});

test("malformed and oversized records fail before decoding unbounded payloads", async (t) => {
  const { scope } = await fixture(t), saved = capture(scope);
  assert.throws(() => parse("{"), /backup JSON/);
  assert.throws(
    () => parse(" ".repeat(MAX_ENVELOPE_BYTES + 1)),
    /backup envelope bound/,
  );
  assert.throws(
    () => parse(Buffer.alloc(MAX_ENVELOPE_BYTES + 1, 0x20)),
    /backup envelope bound/,
  );
  const foreignEnvelope = JSON.stringify({
    kind: BACKUP_KIND,
    ignored: "x".repeat(MAX_ENVELOPE_BYTES),
  });
  assert.throws(() => parse(foreignEnvelope), /backup envelope bound/);
  const oversized = JSON.parse(serialize(saved)); oversized.totalBytes = 32 * 1024 * 1024 + 1;
  assert.throws(() => parse(oversized), /backup bounds/);
  const duplicate = JSON.parse(serialize(saved)); duplicate.records.push(structuredClone(duplicate.records[0])); duplicate.records.sort((left, right) => (left.target + "\0" + left.relativePath).localeCompare(right.target + "\0" + right.relativePath)); duplicate.recordCount += 1; duplicate.totalBytes += duplicate.records[0].byteLength;
  assert.throws(() => parse(duplicate), /duplicate record/);
  const corrupt = JSON.parse(serialize(saved)); const corruptRecord = corrupt.records.find((record) => record.kind === "regular-file"); corruptRecord.bytesBase64 = Buffer.alloc(corruptRecord.byteLength).toString("base64");
  assert.throws(() => parse(corrupt), /record hash/);
});

test("rename, chmod, truncate, and in-place capture races are fenced", async (t) => {
  const races = [
    ["rename", (pathname) => { const replacement = pathname + ".replacement"; writeFileSync(replacement, "replacement"); renameSync(replacement, pathname); }],
    ["chmod", (pathname) => chmodSync(pathname, 0o600)],
    ["truncate", (pathname) => truncateSync(pathname, 1)],
    ["in-place", (pathname) => writeFileSync(pathname, "X".repeat(31))],
  ];
  for (const [name, mutate] of races) {
    const { scope } = await fixture(t);
    assert.throws(() => capture(scope, { afterOpen(pathname) { if (pathname.endsWith("app.js")) mutate(pathname); } }), /race witness|short read/, name);
  }
});

test("restore rejects ancestor and destination symlinks", async (t) => {
  const first = await fixture(t), saved = capture(first.scope);
  const destination = join(first.scope.pluginRoots["context-magnet-inspector"], "app.js");
  await rm(destination); await symlink("/tmp/attacker", destination);
  assert.throws(() => restore(first.scope, saved, backupIdentity(saved)), /unsafe restore destination/);
  const second = await fixture(t), secondSaved = capture(second.scope);
  const pluginRoot = second.scope.pluginRoots["subscription-router"];
  await rm(pluginRoot, { recursive: true }); await symlink("/tmp", pluginRoot);
  assert.throws(() => restore(second.scope, secondSaved, backupIdentity(secondSaved)), /unsafe directory/);
});

test("public exports are readable and the codec has no generation deletion path", async () => {
  const source = await readFile(new URL("./context-magnet-session-etl-plugin-backup.mjs", import.meta.url), "utf8");
  assert.match(source, /export function captureBackup/);
  assert.match(source, /export function restoreBackup/);
  assert.match(source, /export const backupIdentity/);
  assert.doesNotMatch(source, /cleanupCandidates|rmdirSync|rmSync|candidate deletion/);
});
