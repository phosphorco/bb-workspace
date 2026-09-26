#!/usr/bin/env node
// Bounded rollback rehearsal for context-magnet-session-etl.  This program
// deliberately has no normal-runtime mutation path: it models activation and
// rollback only beneath a mkdtemp root, while hash-fencing the real inputs.
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, chmodSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const PLAN = join(ROOT, "plans", "context-magnet-session-etl-activation-preimage.json");
const WORKSPACE = join(ROOT, "plans", "context-magnet-session-etl-workspace-preimage.json");
const RECEIPT = join(ROOT, "plans", "context-magnet-session-etl-rollback-receipt.json");
const GRANTS = new Set([
  "plans/context-magnet-session-etl-rollback.mjs",
  "plans/context-magnet-session-etl-rollback-receipt.json",
]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const digestFile = (path) => sha256(readFileSync(path));
const fail = (message) => { throw new Error(`rollback-harness: ${message}`); };
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function command(file, args, cwd = ROOT) {
  const result = spawnSync(file, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) fail(`${file} ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout;
}
function observe(file, args) {
  const result = spawnSync(file, args, { cwd: ROOT, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}
function atomicWrite(path, bytes, mode = 0o600) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(temporary, bytes, { mode });
  renameSync(temporary, path);
  chmodSync(path, mode);
}
function fileIdentity(path) {
  const stat = statSync(path);
  if (!stat.isFile()) fail(`expected regular file: ${path}`);
  return { path, bytes: stat.size, mode: stat.mode & 0o7777, sha256: digestFile(path) };
}
function assertIdentity(path, expected, label) {
  const actual = fileIdentity(path);
  if (actual.bytes !== expected.bytes || actual.mode !== expected.mode || actual.sha256 !== expected.sha256) {
    fail(`${label} identity changed: ${path}`);
  }
  return actual;
}
function copyExact(from, to, expected) {
  const bytes = readFileSync(from);
  if (sha256(bytes) !== expected.sha256 || bytes.length !== expected.bytes) fail(`preimage source drift: ${from}`);
  atomicWrite(to, bytes, expected.mode);
  return bytes;
}
function gitStatus(path) {
  return command("git", ["-C", path, "status", "--porcelain=v1", "-z", "--untracked-files=all"])
    .split("\0").filter(Boolean).map((line) => ({ code: line.slice(0, 2), path: line.slice(3) }))
    .filter((entry) => !GRANTS.has(entry.path)).sort((a, b) => `${a.code}:${a.path}`.localeCompare(`${b.code}:${b.path}`));
}
function workspaceFence() {
  const repos = [ROOT, join(ROOT, "fork"), join(ROOT, "plugins"), join(ROOT, "community-plugins"), join(ROOT, "fork", "upstream")];
  return repos.map((path) => ({ path: relative(ROOT, path) || ".", head: command("git", ["-C", path, "rev-parse", "HEAD"]).trim(), status: gitStatus(path) }));
}
function canonical(value) { return JSON.stringify(value); }
function assertSame(before, after, label) {
  if (canonical(before) !== canonical(after)) {
    const fields = before && after && typeof before === "object" && typeof after === "object"
      ? [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => canonical(before[key]) !== canonical(after[key])).join(",")
      : "value";
    fail(`${label} fence changed in ${fields} (${sha256(canonical(before))} -> ${sha256(canonical(after))})`);
  }
}
function priorRecord(preimage) {
  const encoded = preimage.observation.runtime.sharedHooks.reversibleRecord;
  const bytes = Buffer.from(encoded.base64, "base64");
  if (bytes.length !== encoded.bytes || sha256(bytes) !== encoded.sha256) fail("invalid shared-hook reversible record");
  const parsed = JSON.parse(bytes.toString("utf8"));
  if (parsed.formatVersion !== 1 || !parsed.workbench?.executable || !parsed.codex?.executable) fail("invalid prior shared-hook record");
  return { bytes, parsed, identity: { bytes: encoded.bytes, mode: 0o600, sha256: encoded.sha256 } };
}
function normalFence(preimage, workspacePreimage) {
  const runtime = preimage.observation.runtime;
  const prior = priorRecord(preimage);
  const installation = workspacePreimage.observation.runtime.sharedHooks.installation;
  const hook = fileIdentity(installation.path);
  if (hook.bytes !== installation.bytes || hook.sha256 !== installation.sha256) fail("normal shared-hook preimage is already stale");
  const plugins = runtime.plugins.map((plugin) => ({
    id: plugin.id,
    app: assertIdentity(plugin.app.path, plugin.app, `normal ${plugin.id} app`),
    server: assertIdentity(plugin.server.path, plugin.server, `normal ${plugin.id} server`),
  }));
  const workbench = assertIdentity(runtime.sharedHooks.workbench.executable.path, runtime.sharedHooks.workbench.executable, "normal prior Workbench");
  const codex = assertIdentity(runtime.sharedHooks.codex.executable.path, runtime.sharedHooks.codex.executable, "normal Codex launcher");
  const routerState = workspacePreimage.observation.runtime.router.state;
  const router = { path: routerState.path, sha256: digestFile(routerState.path) };
  // stateDigest is the router's bounded logical-state digest, not a raw
  // SQLite-file digest.  Preserve the actual file identity as our stronger
  // noninterference fence while the isolated fixture restores the recorded
  // schema/revision pair below.
  const runtimeFile = workspacePreimage.observation.runtime.bbRuntime;
  const liveRuntime = JSON.parse(readFileSync(runtimeFile.path, "utf8"));
  const bbRuntime = { path: runtimeFile.path, entryPath: liveRuntime.entryPath, pid: liveRuntime.pid, serverUrl: liveRuntime.serverUrl, version: liveRuntime.version };
  // bb-app-runtime.json contains a live timestamp, so retain only stable
  // runtime identity fields.  Its direct children are queried separately.
  // Observation-only service/port/child fences.  The temporary providers use
  // loopback ephemeral ports and are retired before this postimage is taken.
  const ports = observe("ss", ["-ltnH"]);
  const services = observe("systemctl", ["--no-legend", "--type=service", "--state=running"]);
  const directChildren = observe("ps", ["-o", "pid=,ppid=,comm=,args=", "--ppid", String(liveRuntime.pid)]);
  const preexistingProviders = workspacePreimage.observation.runtime.providerProcesses ?? [];
  const processRows = observe("ps", ["-eo", "pid=,ppid=,comm=,args="]).stdout.split("\n");
  const providers = preexistingProviders.map((provider) => ({
    executablePath: provider.executablePath,
    executableSha256: provider.executableSha256,
    processes: processRows.filter((row) => row.includes(provider.executablePath)).sort(),
  }));
  return { hook, priorHookSha256: prior.identity.sha256, plugins, workbench, codex, router, bbRuntime, ports, services, directChildren, providers, configuredProviderLaunches: runtime.providerLaunches, selectedTarget: "normal-bb-machine-explicit" };
}

const CHILD_SOURCE = String.raw`
const net = require('node:net');
const crypto = require('node:crypto');
const config = JSON.parse(process.env.CM_ROLLBACK_PROVIDER_CONFIG);
const server = net.createServer((socket) => socket.end('context-magnet-isolated-provider\n'));
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  process.stdout.write(JSON.stringify({kind:'ready',pid:process.pid,port:address.port,configurationSha256:crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex'),configuration:config})+'\n');
});
const stop = () => server.close(() => process.exit(0));
process.on('SIGTERM', stop); process.on('SIGINT', stop);
`;

async function launchProvider(configuration) {
  const child = spawn(process.execPath, ["-e", CHILD_SOURCE], {
    cwd: ROOT,
    env: { ...process.env, CM_ROLLBACK_PROVIDER_CONFIG: JSON.stringify(configuration) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const ready = await new Promise((resolveReady, rejectReady) => {
    let stdout = "";
    const timer = setTimeout(() => rejectReady(new Error(`provider readiness timeout: ${stderr}`)), 5000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const newline = stdout.indexOf("\n");
      if (newline < 0) return;
      clearTimeout(timer);
      try { resolveReady(JSON.parse(stdout.slice(0, newline))); } catch (error) { rejectReady(error); }
    });
    child.once("exit", (code, signal) => { clearTimeout(timer); rejectReady(new Error(`provider exited before ready (${code ?? signal}): ${stderr}`)); });
  });
  if (ready.kind !== "ready" || ready.pid !== child.pid || !Number.isInteger(ready.port) || ready.port < 1024) fail("invalid isolated provider readiness");
  return { child, ready, configuration };
}
async function terminateProvider(provider) {
  if (!provider || provider.child.exitCode !== null || provider.child.signalCode !== null) return { pid: provider?.child.pid ?? null, port: provider?.ready?.port ?? null, alreadyExited: true };
  const exited = new Promise((resolveExit) => provider.child.once("exit", (code, signal) => resolveExit({ code, signal })));
  provider.child.kill("SIGTERM");
  const result = await Promise.race([exited, sleep(250).then(() => null)]);
  const resultRecord = !result
    ? (provider.child.kill("SIGKILL"), { pid: provider.child.pid, ...(await exited), escalated: true })
    : { pid: provider.child.pid, ...result, escalated: false };
  const listeners = observe("ss", ["-ltnH"]).stdout;
  if (listeners.split("\n").some((line) => line.endsWith(`:${provider.ready.port}`) || line.includes(`:${provider.ready.port} `))) fail(`isolated provider port remains listening: ${provider.ready.port}`);
  return { ...resultRecord, port: provider.ready.port, after: "closed" };
}
function noOwnedProvider(provider) { return !provider || provider.child.exitCode !== null || provider.child.signalCode !== null; }
function assertFixture(fixture) {
  assertIdentity(fixture.hook, fixture.prior.hookIdentity, "isolated shared-hook");
  assertIdentity(fixture.workbench, fixture.prior.workbench, "isolated prior Workbench");
  for (const plugin of fixture.plugins) {
    assertIdentity(plugin.app, plugin.expected.app, `isolated ${plugin.expected.id} app`);
    assertIdentity(plugin.server, plugin.expected.server, `isolated ${plugin.expected.id} server`);
  }
  const router = JSON.parse(readFileSync(fixture.router, "utf8"));
  if (router.schemaVersion !== fixture.prior.router.schemaVersion || router.selectionRevision !== fixture.prior.router.selectionRevision || router.mode !== "prior") fail("isolated router was not restored");
}
function corrupt(path) { atomicWrite(path, Buffer.from("proof-generation-not-prior\n"), 0o600); }
function activateFixture(fixture) {
  corrupt(fixture.hook); corrupt(fixture.workbench); corrupt(fixture.plugins[0].app); corrupt(fixture.plugins[1].server);
  atomicWrite(fixture.router, Buffer.from(json({ schemaVersion: fixture.prior.router.schemaVersion, selectionRevision: fixture.prior.router.selectionRevision + 1, mode: "proof" })), 0o600);
}
function restoreFixture(fixture) {
  atomicWrite(fixture.hook, fixture.prior.hookBytes, fixture.prior.hookIdentity.mode);
  atomicWrite(fixture.workbench, fixture.prior.workbenchBytes, fixture.prior.workbench.mode);
  for (const plugin of fixture.plugins) {
    atomicWrite(plugin.app, plugin.appBytes, plugin.expected.app.mode);
    atomicWrite(plugin.server, plugin.serverBytes, plugin.expected.server.mode);
  }
  atomicWrite(fixture.router, Buffer.from(json({ schemaVersion: fixture.prior.router.schemaVersion, selectionRevision: fixture.prior.router.selectionRevision, mode: "prior" })), 0o600);
}

async function rollback(fixture, state) {
  const retired = [];
  if (state.proof) { retired.push(await terminateProvider(state.proof)); state.proof = null; }
  restoreFixture(fixture);
  assertFixture(fixture);
  if (state.prior && !noOwnedProvider(state.prior)) {
    const expected = sha256(JSON.stringify(state.prior.configuration));
    if (state.prior.ready.configurationSha256 !== expected) fail("existing prior witness has wrong configuration");
    return { retiredProofProviders: retired, idempotent: true, freshPriorWitness: state.prior.ready };
  }
  state.prior = await launchProvider(fixture.prior.providerConfiguration);
  if (state.prior.ready.configurationSha256 !== sha256(JSON.stringify(fixture.prior.providerConfiguration))) fail("fresh prior witness configuration mismatch");
  return { retiredProofProviders: retired, idempotent: false, freshPriorWitness: state.prior.ready };
}

function buildFixture(root, preimage, workspacePreimage) {
  const runtime = preimage.observation.runtime;
  const prior = priorRecord(preimage);
  const base = join(root, "isolated-router-root");
  const hook = join(base, "shared-hooks.json");
  const workbench = join(base, "bin", "prior-workbench");
  atomicWrite(hook, prior.bytes, 0o600);
  const priorWorkbench = runtime.sharedHooks.workbench.executable;
  const workbenchBytes = copyExact(priorWorkbench.path, workbench, priorWorkbench);
  const plugins = runtime.plugins.map((expected) => {
    const dir = join(base, "plugins", expected.id, "dist");
    const app = join(dir, "app.js"), server = join(dir, "server.js");
    return { expected, app, server, appBytes: copyExact(expected.app.path, app, expected.app), serverBytes: copyExact(expected.server.path, server, expected.server) };
  });
  const router = join(base, "router", "state.json");
  const routerPreimage = workspacePreimage.observation.runtime.router.state;
  atomicWrite(router, Buffer.from(json({ schemaVersion: routerPreimage.schemaVersion, selectionRevision: routerPreimage.selectionRevision, mode: "prior" })), 0o600);
  return { root: base, hook, workbench, plugins, router, prior: {
    hookBytes: prior.bytes,
    hookIdentity: { bytes: prior.bytes.length, mode: 0o600, sha256: sha256(prior.bytes) },
    workbench: priorWorkbench,
    workbenchBytes,
    router: routerPreimage,
    providerConfiguration: { mode: "prior", hookSha256: sha256(prior.bytes), workbenchSha256: priorWorkbench.sha256, pluginGeneration: runtime.plugins.map((p) => ({ id: p.id, appSha256: p.app.sha256, serverSha256: p.server.sha256 })) },
  } };
}

async function rehearse() {
  const preimage = JSON.parse(readFileSync(PLAN, "utf8"));
  const workspacePreimage = JSON.parse(readFileSync(WORKSPACE, "utf8"));
  if (preimage.observation?.schemaVersion !== 2 || preimage.observation?.runtime?.router?.schemaVersion !== 5) fail("unexpected activation preimage schema");
  const targetRuling = "sha256:90ef7ad19a65e382ae7f85e7d9a257e7165784d22ab5f0ea2956b397132ca47f";
  const before = { normal: normalFence(preimage, workspacePreimage), workspace: workspaceFence() };
  const root = mkdtempSync(join(tmpdir(), "context-magnet-session-etl-rollback-"));
  let fixture, state = { proof: null, prior: null }, primaryError = null;
  const evidence = { schemaVersion: 1, node: "rollback-harness", command: "rehearse", cwd: ROOT, activationTarget: { choice: "normal-bb-machine-explicit", rulingSha256: targetRuling, normalRuntimeMutation: false }, temporaryRoots: [{ path: root, before: "absent", after: "removed" }], phases: [], normalBefore: before.normal, workspaceBefore: before.workspace };
  try {
    fixture = buildFixture(root, preimage, workspacePreimage);
    assertFixture(fixture);
    activateFixture(fixture);
    state.proof = await launchProvider({ mode: "proof", routerRoot: fixture.root, selectedWorkbenchSha256: preimage.observation.selectedWorkbench.artifact.sha256 });
    evidence.phases.push({ phase: "proof-activation", proofProvider: state.proof.ready, fixtureState: "proof", ports: [{ port: state.proof.ready.port, before: "absent", during: "listening" }] });
    const first = await rollback(fixture, state);
    evidence.phases.push({ phase: "rollback", ...first });
    const repeat = await rollback(fixture, state);
    evidence.phases.push({ phase: "idempotent-repeat", ...repeat, samePriorPid: repeat.freshPriorWitness.pid === first.freshPriorWitness.pid });
    if (!repeat.idempotent || !evidence.phases.at(-1).samePriorPid) fail("idempotent rollback replaced healthy prior witness");
    await terminateProvider(state.prior); state.prior = null;
    activateFixture(fixture);
    state.proof = await launchProvider({ mode: "proof-adversarial", routerRoot: fixture.root });
    let adversarial = null;
    try { throw new Error("intentional proof failure after activation"); }
    catch (error) { adversarial = error.message; }
    finally {
      const recovery = await rollback(fixture, state);
      evidence.phases.push({ phase: "adversarial-finally", injectedFailure: adversarial, ...recovery, finallyRestored: true });
    }
    assertFixture(fixture);
    evidence.protectedState = { result: "pass", normalRuntimeReadOnly: true, priorHookRestored: true, priorWorkbenchRestored: true, directPluginGenerationRestored: true, proofConfiguredProviderRetired: true, freshPriorConfigurationWitness: state.prior.ready };
  } catch (error) {
    primaryError = error;
    evidence.failure = String(error?.message || error);
  } finally {
    // This is deliberately unconditional.  A future activation/proof runner
    // can rely on the same finally behavior: any owned proof process is
    // retired and prior bytes are restored before the bounded root is retired.
    if (fixture) {
      try {
        const emergency = await rollback(fixture, state);
        evidence.emergencyFinally = { invoked: true, ...emergency };
      } catch (error) {
        evidence.emergencyFinally = { invoked: true, error: String(error?.message || error) };
        if (!primaryError) primaryError = error;
      }
    }
    const childTermination = [];
    if (state.proof) childTermination.push(await terminateProvider(state.proof));
    if (state.prior) childTermination.push(await terminateProvider(state.prior));
    evidence.childProcesses = childTermination;
    if (fixture) assertFixture(fixture);
    rmSync(root, { recursive: true, force: true });
    evidence.temporaryRoots[0].after = existsSync(root) ? "present" : "removed";
    const after = { normal: normalFence(preimage, workspacePreimage), workspace: workspaceFence() };
    assertSame(before.normal, after.normal, "normal runtime/hook/router/plugin/service/port/child");
    assertSame(before.workspace, after.workspace, "protected workspace");
    evidence.normalAfter = after.normal;
    evidence.workspaceAfter = after.workspace;
    evidence.normalRuntimeDeltas = [];
    evidence.workspaceDeltasOutsideGrant = [];
    evidence.planAndLedgerWritten = false;
    evidence.commitCreated = false;
    evidence.ok = !primaryError && evidence.temporaryRoots[0].after === "removed";
    atomicWrite(RECEIPT, Buffer.from(json(evidence)), 0o600);
  }
  if (primaryError) throw primaryError;
  process.stdout.write(json({ ok: true, receipt: relative(ROOT, RECEIPT), protectedState: "pass", normalRuntimeDeltas: [], isolatedOnly: true }));
}

if (process.argv.length !== 3 || process.argv[2] !== "rehearse") {
  process.stderr.write("usage: node plans/context-magnet-session-etl-rollback.mjs rehearse\n");
  process.exitCode = 2;
} else {
  rehearse().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
