/** Private, adapter-only model of a generation-only router publication.
 * This module has no CLI, host filesystem import, or live adapter. A later
 * guarded action must review and supply any real adapter separately.
 */
import { createHash } from 'node:crypto';

export const HOST_FILES = Object.freeze([
  'router.mjs', 'accounts.mjs', 'routing.mjs', 'state.mjs',
  'context-magnet-session-reader.mjs', 'context-magnet-session-etl.mjs',
  'backend.mjs', 'backend-config.mjs', 'sqlite-state.mjs', 'process-identity.mjs',
  'migration.mjs', 'session-migration.mjs', 'shared-hooks.mjs',
  'SessionId.ts', 'HistoryBase.ts', 'Lineage.ts', 'RolloutFault.ts',
]);

const LIMIT = 16 * 1024;
const SOURCE_LIMIT = 2 * 1024 * 1024;
const hex = value => createHash('sha256').update(value).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const bounded = (value, label, limit = LIMIT) => {
  requireValue(Buffer.byteLength(value) <= limit, `${label} exceeds ${limit} bytes`);
  return value;
};
const join = (root, ...parts) => `${root}/${parts.join('/')}`;

export class RouterGenerationFailure extends Error {
  constructor(primary, restoration = null) {
    super(`generation-only publication failed: ${primary.message}${restoration ? `; restoration failed: ${restoration.message}` : ''}`);
    this.name = 'RouterGenerationFailure';
    this.primary = primary;
    this.restoration = restoration;
  }
}

/**
 * fs: readFile/stat/readLink/exists/mkdirExclusive/writeExclusive/renameNoReplace/
 *     renameReplace/fsyncFile/fsyncDir. db: transaction(fn), read(), set(value).
 * All paths and all side effects go through these injected adapters.
 */
export function createRouterGenerationController({ fs, db, clock, process, paths, owner }) {
  requireValue(fs && db && clock && process && paths, 'all private adapters are required');
  requireValue(typeof owner === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(owner), 'invalid owner');
  requireValue(/^\/fixture\/[a-zA-Z0-9_-]+$/.test(paths.root), 'controller is restricted to a private fixture root');
  requireValue(paths.source === join(paths.root, 'source') && paths.lib === join(paths.root, 'host/lib') &&
    paths.preimage === join(paths.root, 'receipts', `${owner}.json`), 'non-fixture or noncanonical path');

  const launcherPath = join(paths.lib, 'router-command');
  const versions = join(paths.lib, 'versions');
  const digestDir = digest => join(versions, digest);
  const readText = (path, label, limit) => bounded(fs.readFile(path), label, limit);
  const receipt = () => structuredClone(db.read());
  const source = () => {
    const contents = Object.fromEntries(HOST_FILES.map(name => [name, readText(join(paths.source, name), `source ${name}`, SOURCE_LIMIT)]));
    const hashes = Object.fromEntries(Object.entries(contents).sort(([a], [b]) => a.localeCompare(b))
      .map(([name, bytes]) => [name, hex(bytes)]));
    const manifest = { formatVersion: 1, files: hashes };
    const provenance = process.sourceIdentity();
    requireValue(typeof provenance === 'string' && provenance.length > 0 && provenance.length <= 4096,
      'invalid source HEAD/index/status identity');
    return { contents, manifest: { ...manifest, digest: hex(JSON.stringify(manifest)) }, provenance };
  };
  const exactGeneration = (dir, image) => {
    const expected = JSON.stringify(image.manifest) + '\n';
    requireValue(readText(join(dir, 'manifest.json'), 'manifest') === expected, 'existing generation manifest mismatch');
    const actualNames = fs.list(dir).sort();
    requireValue(same(actualNames, [...HOST_FILES, 'manifest.json'].sort()), 'existing generation entries mismatch');
    for (const name of HOST_FILES) requireValue(readText(join(dir, name), name, SOURCE_LIMIT) === image.contents[name], `existing generation bytes mismatch: ${name}`);
  };
  const fenceSource = image => requireValue(same(source(), image), 'canonical source drift');
  const overlap = guard => {
    requireValue(guard && ['compatible', 'barrier'].includes(guard.mode) &&
      typeof guard.evidence === 'string' && guard.evidence.length >= 8 && guard.evidence.length <= 1024,
    'explicit old/new process overlap guard required');
    requireValue(process.assertOverlapGuard(guard) === true, 'process overlap guard rejected');
  };
  const boundHost = () => {
    requireValue(fs.readLink(join(paths.lib, 'router.mjs')) === 'router-command', 'router alias drift');
    const runtime = fs.readLink(join(paths.lib, 'bun'));
    requireValue(typeof runtime === 'string' && runtime.startsWith('/fixture/runtime/'), 'runtime alias drift');
    const identity = process.runtimeIdentity(runtime);
    requireValue(identity && /^[a-f0-9]{64}$/.test(identity.sha256), 'invalid runtime identity');
    return { runtime, identity };
  };
  const capture = image => {
    const launcher = readText(launcherPath, 'launcher');
    const launcherStat = fs.stat(launcherPath);
    requireValue(launcherStat.type === 'file' && launcherStat.mode === 0o700, 'launcher type/mode drift');
    const oldReceipt = receipt();
    bounded(JSON.stringify(oldReceipt), 'deployment receipt');
    requireValue(oldReceipt && /^[a-f0-9]{64}$/.test(oldReceipt.generation_digest), 'invalid old deployment receipt');
    requireValue(launcher.includes(`/versions/${oldReceipt.generation_digest}/router.mjs`) &&
      fs.exists(digestDir(oldReceipt.generation_digest)), 'active launcher/deployment receipt mismatch');
    const host = boundHost();
    const preimage = { formatVersion: 1, owner, candidate: image.manifest.digest,
      source: { manifest: image.manifest, provenance: image.provenance },
      old: { launcher, launcherStat, receipt: oldReceipt }, host,
      candidateLauncher: launcherFor(host.runtime, image.manifest.digest, owner),
      createdAt: clock.now() };
    bounded(JSON.stringify(preimage), 'preimage');
    return preimage;
  };
  const launcherFor = (runtime, digest, tag) =>
    `#!/bin/sh\n# generation-owner:${tag}\nexec '${runtime}' '${digestDir(digest)}/router.mjs' "$@"\n`;
  const load = () => {
    const saved = JSON.parse(readText(paths.preimage, 'saved preimage'));
    requireValue(saved.formatVersion === 1 && saved.owner === owner &&
      /^[a-f0-9]{64}$/.test(saved.candidate) &&
      saved.candidateLauncher === launcherFor(saved.host.runtime, saved.candidate, owner), 'saved ownership mismatch');
    requireValue(typeof saved.old.launcher === 'string' && saved.old.launcherStat.type === 'file', 'invalid saved launcher');
    bounded(JSON.stringify(saved.old.receipt), 'saved deployment receipt');
    requireValue(saved.source && saved.source.manifest?.digest === saved.candidate &&
      typeof saved.source.provenance === 'string' &&
      saved.old.receipt?.generation_digest &&
      saved.old.launcher.includes(`/versions/${saved.old.receipt.generation_digest}/router.mjs`),
    'invalid saved source or old pair');
    return saved;
  };
  const pair = () => ({ launcher: readText(launcherPath, 'current launcher'), receipt: receipt() });
  const oldPair = saved => ({ launcher: saved.old.launcher, receipt: saved.old.receipt });
  const newPair = saved => ({ launcher: saved.candidateLauncher,
    receipt: { generation_digest: saved.candidate, activated_at: saved.createdAt, owner } });
  const publishLauncher = (bytes, suffix) => {
    const temp = join(paths.lib, `.router-command-${owner}-${suffix}.tmp`);
    fs.writeExclusive(temp, bytes, 0o700);
    fs.fsyncFile(temp);
    fs.renameReplace(temp, launcherPath);
    fs.fsyncDir(paths.lib);
  };
  const assertHost = saved => requireValue(same(boundHost(), saved.host), 'host alias/runtime drift');
  const assertSource = saved => {
    const current = source();
    requireValue(same(current.manifest, saved.source.manifest) && current.provenance === saved.source.provenance,
      'saved source drift');
  };
  const restore = saved => db.transaction(() => {
    assertHost(saved);
    assertSource(saved);
    const launcherStat = fs.stat(launcherPath);
    requireValue(launcherStat.type === 'file' && launcherStat.mode === 0o700, 'current launcher type/mode drift');
    const current = pair();
    if (same(current, oldPair(saved))) return 'already-restored';
    const candidate = newPair(saved);
    const candidateLauncher = current.launcher === candidate.launcher;
    const oldLauncher = current.launcher === saved.old.launcher;
    requireValue((candidateLauncher &&
      (same(current.receipt, saved.old.receipt) || same(current.receipt, candidate.receipt))) ||
      (oldLauncher && same(current.receipt, candidate.receipt)),
    'foreign launcher/deployment receipt drift');
    if (candidateLauncher) publishLauncher(saved.old.launcher, 'restore');
    db.set(structuredClone(saved.old.receipt));
    requireValue(same(pair(), oldPair(saved)), 'restoration postimage mismatch');
    return 'restored';
  });

  const stage = image => {
    const final = digestDir(image.manifest.digest);
    if (fs.exists(final)) { exactGeneration(final, image); return 'existing'; }
    const temp = join(versions, `.stage-${image.manifest.digest}-${owner}`);
    fs.mkdirExclusive(temp, 0o700);
    for (const name of HOST_FILES) {
      const path = join(temp, name);
      fs.writeExclusive(path, image.contents[name], name === 'router.mjs' ? 0o700 : 0o600);
      fs.fsyncFile(path);
    }
    fs.writeExclusive(join(temp, 'manifest.json'), JSON.stringify(image.manifest) + '\n', 0o600);
    fs.fsyncFile(join(temp, 'manifest.json'));
    fs.fsyncDir(temp);
    fenceSource(image);
    try { fs.renameNoReplace(temp, final); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      exactGeneration(final, image);
      return 'raced-existing';
    }
    fs.fsyncDir(versions);
    exactGeneration(final, image);
    return 'created';
  };

  return Object.freeze({
    inspect: () => ({ manifest: source().manifest, current: pair() }),
    recover: () => restore(load()),
    replay() {
      const saved = load();
      assertSource(saved);
      assertHost(saved);
      const current = pair();
      if (same(current, newPair(saved))) return { state: 'active', generation: saved.candidate };
      if (same(current, oldPair(saved))) return { state: 'restored', generation: saved.candidate };
      throw new Error('foreign or interrupted launcher/deployment receipt; recover first');
    },
    activate(guard) {
      overlap(guard);
      const image = source();
      const saved = capture(image);
      fs.writeExclusive(paths.preimage, JSON.stringify(saved) + '\n', 0o600);
      fs.fsyncFile(paths.preimage);
      fs.fsyncDir(join(paths.root, 'receipts'));
      try {
        stage(image);
        fenceSource(image);
        assertHost(saved);
        requireValue(process.preflight(digestDir(saved.candidate), saved.host.identity) === true, 'candidate preflight failed');
        db.transaction(() => {
          fenceSource(image);
          assertHost(saved);
          requireValue(same(pair(), oldPair(saved)) && same(fs.stat(launcherPath), saved.old.launcherStat),
            'launcher/deployment receipt compare-and-swap failed');
          publishLauncher(saved.candidateLauncher, 'publish');
          db.set(newPair(saved).receipt);
        });
        fenceSource(image);
        requireValue(same(pair(), newPair(saved)), 'publication postimage mismatch');
        return { generation: saved.candidate, preimage: paths.preimage };
      } catch (primary) {
        let restoration = null;
        try { restore(saved); } catch (error) { restoration = error; }
        throw new RouterGenerationFailure(primary, restoration);
      }
    },
  });
}
