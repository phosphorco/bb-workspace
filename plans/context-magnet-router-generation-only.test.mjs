import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouterGenerationController, HOST_FILES, RouterGenerationFailure } from './context-magnet-router-generation-only.mjs';
import { HOST_FILES as CANONICAL_HOST_FILES } from '../plugins/plugins/subscription-router/deployment.ts';

const root = '/fixture/router-generation-only';
const source = `${root}/source`;
const lib = `${root}/host/lib`;
const versions = `${lib}/versions`;
const launcher = `${lib}/router-command`;
const owner = 'fixture-owner-001';
const preimage = `${root}/receipts/${owner}.json`;
const oldDigest = 'a'.repeat(64);
const oldLauncher = `#!/bin/sh\nexec '/fixture/runtime/bun' '${versions}/${oldDigest}/router.mjs' "$@"\n`;
const oldReceipt = { generation_digest: oldDigest, activated_at: 7 };
const guard = { mode: 'compatible', evidence: 'reader-only compatible process overlap reviewed' };

test('controller stages the canonical deployment.ts HOST_FILES in canonical order', () => {
  assert.deepEqual(HOST_FILES, CANONICAL_HOST_FILES);
  const f = fixture();
  assert.deepEqual(Object.keys(f.manifest().files).sort(), [...CANONICAL_HOST_FILES].sort());
});

function fixture() {
  const entries = new Map();
  const writes = [];
  const events = [];
  const fault = { at: null, once: true, race: null, raceCorrupt: false };
  let nextInode = 1;
  const item = (type, value = null, mode = 0o700) => ({ type, value, mode, inode: nextInode++ });
  for (const dir of ['/fixture', root, source, `${root}/host`, lib, versions, `${root}/receipts`, `${versions}/${oldDigest}`]) entries.set(dir, item('dir'));
  for (const name of CANONICAL_HOST_FILES) entries.set(`${source}/${name}`, item('file', `canonical:${name}\n`, 0o600));
  entries.set(launcher, item('file', oldLauncher));
  entries.set(`${lib}/router.mjs`, item('link', 'router-command'));
  entries.set(`${lib}/bun`, item('link', '/fixture/runtime/bun'));
  entries.set(`${versions}/${oldDigest}/router.mjs`, item('file', 'old generation', 0o700));
  let row = structuredClone(oldReceipt);
  let provenance = 'head=fixture index=fixture status=fixture';
  const deny = path => {
    const allowed = path === preimage || path === launcher || path === `${lib}/deployment.db` ||
      /^\/fixture\/router-generation-only\/host\/lib\/\.router-command-fixture-owner-001-(publish|restore)\.tmp$/.test(path) ||
      path.startsWith(`${versions}/.stage-`) ||
      (path.startsWith(`${versions}/`) && !path.startsWith(`${versions}/${oldDigest}`));
    assert.ok(allowed, `write outside private fixture allowlist: ${path}`);
    assert.ok(!/(?:\/lib\/router\.mjs|\/lib\/bun|\/state\.db(?:-wal|-shm)?|\/accounts\/|\/shim(?:\/|$)|\/hooks(?:\/|$)|\/dist\/|\/source\/)/.test(path), `protected write: ${path}`);
    writes.push(path);
  };
  const trip = label => {
    if (fault.at === label) {
      if (fault.once) fault.at = null;
      throw new Error(`injected ${label} failure`);
    }
  };
  const get = path => {
    const found = entries.get(path);
    if (!found) { const error = new Error(`missing ${path}`); error.code = 'ENOENT'; throw error; }
    return found;
  };
  const move = (from, to, replace) => {
    deny(to);
    trip(`rename:${to}`);
    if (!replace && fault.race === to) {
      fault.race = null;
      // A rival published the same immutable bytes without touching our temp.
      for (const [path, value] of [...entries]) if (path === from || path.startsWith(`${from}/`))
        entries.set(to + path.slice(from.length), structuredClone(value));
      if (fault.raceCorrupt) entries.get(`${to}/router.mjs`).value = 'foreign same-digest bytes';
    }
    if (!replace && entries.has(to)) { const error = new Error('exists'); error.code = 'EEXIST'; throw error; }
    for (const [path, value] of [...entries]) if (path === from || path.startsWith(`${from}/`)) {
      entries.delete(path);
      entries.set(to + path.slice(from.length), value);
    }
  };
  const fs = {
    exists: path => entries.has(path),
    readFile: path => { const entry = get(path); assert.equal(entry.type, 'file'); return entry.value; },
    readLink: path => { const entry = get(path); assert.equal(entry.type, 'link'); return entry.value; },
    stat: path => { const { type, mode, inode } = get(path); return { type, mode, inode }; },
    list: dir => [...entries.keys()].filter(path => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes('/')).map(path => path.slice(dir.length + 1)),
    mkdirExclusive(path, mode) { deny(path); trip('stage'); assert.ok(!entries.has(path)); entries.set(path, item('dir', null, mode)); },
    writeExclusive(path, bytes, mode) { deny(path); trip(`write:${path}`); assert.ok(!entries.has(path)); entries.set(path, item('file', bytes, mode)); },
    renameNoReplace: (from, to) => move(from, to, false),
    renameReplace: (from, to) => move(from, to, true),
    fsyncFile: path => { get(path); events.push(`fsync:${path}`); },
    fsyncDir: path => { get(path); events.push(`fsync:${path}`); },
  };
  const db = {
    read: () => structuredClone(row),
    set(value) { deny(`${lib}/deployment.db`); trip('db-set'); row = structuredClone(value); },
    transaction(fn) {
      events.push('BEGIN IMMEDIATE');
      const before = structuredClone(row);
      try { const result = fn(); trip('db-commit'); events.push('COMMIT'); return result; }
      catch (error) { row = before; events.push('ROLLBACK'); throw error; }
    },
  };
  // deployment.db is the sole DB write in this fixture. It represents the
  // transaction and its WAL/SHM companions; state.db is never an adapter input.
  const process = {
    sourceIdentity: () => provenance,
    runtimeIdentity: runtime => ({ path: runtime, sha256: 'b'.repeat(64) }),
    assertOverlapGuard: selected => selected.mode === 'compatible' || selected.mode === 'barrier',
    preflight: (dir, runtime) => { events.push(`preflight:${dir}`); trip('preflight'); return runtime.sha256 === 'b'.repeat(64); },
  };
  const paths = { root, source, lib, preimage };
  const controller = createRouterGenerationController({ fs, db, clock: { now: () => 12345 }, process, paths, owner });
  return { controller, fs, db, paths, entries, writes, events, fault,
    get row() { return row; }, set row(value) { row = value; },
    get provenance() { return provenance; }, set provenance(value) { provenance = value; },
    manifest: () => controller.inspect().manifest,
    saved: () => JSON.parse(fs.readFile(preimage)),
    assertProtected() {
      assert.equal(fs.readLink(`${lib}/router.mjs`), 'router-command');
      assert.equal(fs.readLink(`${lib}/bun`), '/fixture/runtime/bun');
      assert.equal(fs.readFile(`${versions}/${oldDigest}/router.mjs`), 'old generation');
      assert.equal(writes.filter(path => !path.startsWith('/fixture/')).length, 0);
      for (const path of writes) assert.ok(!/(?:\/state\.db(?:-wal|-shm)?|\/accounts\/|\/shim(?:\/|$)|\/hooks(?:\/|$)|\/dist\/|\/source\/|\/lib\/router\.mjs|\/lib\/bun)/.test(path));
    },
  };
}

test('requires explicit old/new process overlap disposition before any write', () => {
  const f = fixture();
  assert.throws(() => f.controller.activate(), /overlap guard required/);
  assert.deepEqual(f.writes, []);
});

test('stages exact canonical HOST_FILES and publishes launcher/receipt under injected transaction', () => {
  const f = fixture();
  const digest = f.manifest().digest;
  const result = f.controller.activate(guard);
  assert.equal(result.generation, digest);
  assert.equal(f.saved().old.launcher, oldLauncher);
  assert.equal(f.saved().old.receipt.generation_digest, oldDigest);
  assert.equal(f.row.generation_digest, digest);
  assert.match(f.fs.readFile(launcher), new RegExp(digest));
  assert.deepEqual(f.fs.list(`${versions}/${digest}`).sort(), [...HOST_FILES, 'manifest.json'].sort());
  assert.ok(f.events.includes('BEGIN IMMEDIATE'));
  f.assertProtected();
});

test('exclusive staging race accepts only byte-identical existing digest', () => {
  const f = fixture();
  const digest = f.manifest().digest;
  f.fault.race = `${versions}/${digest}`;
  f.controller.activate(guard);
  assert.equal(f.row.generation_digest, digest);
  f.assertProtected();
});

test('exclusive staging race rejects same-digest path with foreign bytes', () => {
  const f = fixture();
  const digest = f.manifest().digest;
  f.fault.race = `${versions}/${digest}`;
  f.fault.raceCorrupt = true;
  assert.throws(() => f.controller.activate(guard), error =>
    error instanceof RouterGenerationFailure && /bytes mismatch/.test(error.primary.message));
  assert.equal(f.fs.readFile(`${versions}/${digest}/router.mjs`), 'foreign same-digest bytes');
  assert.equal(f.fs.readFile(launcher), oldLauncher);
  assert.deepEqual(f.row, oldReceipt);
  f.assertProtected();
});

test('existing digest path with mismatched bytes fails without rewrite', () => {
  const f = fixture();
  const digest = f.manifest().digest;
  const dir = `${versions}/${digest}`;
  f.entries.set(dir, { type: 'dir', mode: 0o700, inode: 900 });
  f.entries.set(`${dir}/manifest.json`, { type: 'file', value: 'foreign', mode: 0o600, inode: 901 });
  assert.throws(() => f.controller.activate(guard), error => error instanceof RouterGenerationFailure && /manifest mismatch/.test(error.primary.message));
  assert.equal(f.fs.readFile(`${dir}/manifest.json`), 'foreign');
  assert.equal(f.fs.readFile(launcher), oldLauncher);
  assert.deepEqual(f.row, oldReceipt);
  f.assertProtected();
});

test('stage and preflight failures preserve active pair and retain inert candidate', () => {
  for (const at of ['stage', 'preflight']) {
    const f = fixture();
    f.fault.at = at;
    assert.throws(() => f.controller.activate(guard), error => error instanceof RouterGenerationFailure && !error.restoration);
    assert.equal(f.fs.readFile(launcher), oldLauncher);
    assert.deepEqual(f.row, oldReceipt);
    f.assertProtected();
  }
});

test('publish and receipt-commit interruptions restore exact old pair', () => {
  for (const at of [`rename:${launcher}`, 'db-set', 'db-commit']) {
    const f = fixture();
    f.fault.at = at;
    assert.throws(() => f.controller.activate(guard), error => error instanceof RouterGenerationFailure && !error.restoration);
    assert.equal(f.fs.readFile(launcher), oldLauncher);
    assert.deepEqual(f.row, oldReceipt);
    f.assertProtected();
  }
});

test('primary and restoration failures are separately exposed', () => {
  const f = fixture();
  f.fault.at = 'db-commit';
  const rename = f.fs.renameReplace;
  let count = 0;
  f.fs.renameReplace = (from, to) => { if (++count === 2) throw new Error('restore denied'); return rename(from, to); };
  assert.throws(() => f.controller.activate(guard), error =>
    error instanceof RouterGenerationFailure && /db-commit/.test(error.primary.message) && /restore denied/.test(error.restoration.message));
  f.assertProtected();
});

test('crash-gap recovery restores owned candidate pointer and is idempotent', () => {
  for (const committed of [false, true]) {
    const f = fixture();
    f.controller.activate(guard);
    const saved = f.saved();
    if (!committed) f.row = structuredClone(saved.old.receipt); // crash after launcher rename, before DB commit
    assert.equal(f.controller.recover(), 'restored');
    assert.equal(f.controller.recover(), 'already-restored');
    assert.equal(f.fs.readFile(launcher), oldLauncher);
    assert.deepEqual(f.row, oldReceipt);
    assert.ok(f.fs.exists(`${versions}/${saved.candidate}`));
    f.assertProtected();
  }
});

test('failed restoration commit leaves owned old-launcher/candidate-receipt gap that recover completes', () => {
  const f = fixture();
  const { generation } = f.controller.activate(guard);
  f.fault.at = 'db-commit';
  assert.throws(() => f.controller.recover(), /injected db-commit failure/);
  assert.equal(f.fs.readFile(launcher), oldLauncher);
  assert.equal(f.row.generation_digest, generation);
  assert.equal(f.row.owner, owner);
  assert.throws(() => f.controller.replay(), /interrupted launcher\/deployment receipt/);
  assert.equal(f.controller.recover(), 'restored');
  assert.equal(f.controller.recover(), 'already-restored');
  assert.equal(f.fs.readFile(launcher), oldLauncher);
  assert.deepEqual(f.row, oldReceipt);
  f.assertProtected();
});

test('old launcher with foreign receipt or changed source cannot complete restoration', () => {
  for (const drift of ['receipt', 'source']) {
    const f = fixture();
    f.controller.activate(guard);
    f.fault.at = 'db-commit';
    assert.throws(() => f.controller.recover(), /injected db-commit failure/);
    if (drift === 'receipt') f.row = { generation_digest: 'c'.repeat(64), activated_at: 88, owner };
    else f.provenance = 'foreign HEAD/index/status';
    const before = structuredClone(f.row);
    assert.throws(() => f.controller.recover(), /foreign launcher\/deployment receipt drift|saved source drift/);
    assert.equal(f.fs.readFile(launcher), oldLauncher);
    assert.deepEqual(f.row, before);
    f.assertProtected();
  }
});

test('replay is read-only and accepts only exact owned active or restored pairs', () => {
  const f = fixture();
  const result = f.controller.activate(guard);
  const before = f.writes.length;
  assert.deepEqual(f.controller.replay(), { state: 'active', generation: result.generation });
  assert.equal(f.writes.length, before);
  f.controller.recover();
  const after = f.writes.length;
  assert.deepEqual(f.controller.replay(), { state: 'restored', generation: result.generation });
  assert.equal(f.writes.length, after);
  f.assertProtected();
});

test('foreign pointer, receipt, owner, and alias drift fail closed', () => {
  for (const drift of ['launcher', 'receipt', 'owner', 'alias']) {
    const f = fixture();
    f.controller.activate(guard);
    if (drift === 'launcher') f.entries.get(launcher).value += '# foreign\n';
    if (drift === 'receipt') f.row = { generation_digest: 'c'.repeat(64), activated_at: 44 };
    if (drift === 'owner') f.entries.get(preimage).value = f.fs.readFile(preimage).replace(owner, 'foreign-owner-001');
    if (drift === 'alias') f.entries.get(`${lib}/router.mjs`).value = 'foreign';
    const before = f.fs.readFile(launcher);
    assert.throws(() => f.controller.recover(), /drift|ownership mismatch/);
    assert.equal(f.fs.readFile(launcher), before);
    f.assertProtected = () => {}; // intentional foreign fixture drift, not a controller write
    assert.ok(f.writes.every(path => path.startsWith(root)));
  }
});

test('source identity and bytes are fenced before publish', () => {
  for (const drift of ['identity', 'bytes']) {
    const f = fixture();
    const preflight = f.controller.inspect().manifest;
    const fsync = f.fs.fsyncDir;
    f.fs.fsyncDir = path => {
      fsync(path);
      if (path === `${root}/receipts`) {
        if (drift === 'identity') f.provenance = 'foreign HEAD/index/status';
        else f.entries.get(`${source}/router.mjs`).value = 'foreign source';
      }
    };
    assert.throws(() => f.controller.activate(guard), error => error instanceof RouterGenerationFailure && /source drift/.test(error.primary.message));
    assert.equal(f.fs.readFile(launcher), oldLauncher);
    assert.deepEqual(f.row, oldReceipt);
    assert.ok(preflight.digest);
    f.assertProtected();
  }
});

test('controller rejects any live or noncanonical path and exposes no CLI', () => {
  const f = fixture();
  for (const hostile of ['/home/ubuntu/.codex-subscription-router', '/fixture/../../home/ubuntu/.codex-subscription-router'])
    assert.throws(() => createRouterGenerationController({ fs: f.fs, db: f.db, clock: { now: () => 1 },
      process: { sourceIdentity: () => 'x' }, paths: { ...f.paths, root: hostile }, owner }),
    /private fixture root/);
  assert.deepEqual(f.writes, []);
});
