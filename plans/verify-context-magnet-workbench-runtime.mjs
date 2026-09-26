#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const workspaceRoot = "/home/ubuntu/bb";
const receiptPath = path.join(workspaceRoot, "plans/context-magnet-workbench-runtime-receipt.json");
const artifactRoot = path.join(workspaceRoot, "plans/context-magnet-workbench-runtime");
const mode = process.argv[2];

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function command(commandPath, args, cwd) {
  return execFileSync(commandPath, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function relativeContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

try {
  if (mode !== "build-only") fail("usage: node plans/verify-context-magnet-workbench-runtime.mjs build-only");

  const receiptBytes = readFileSync(receiptPath);
  const receipt = JSON.parse(receiptBytes);
  if (receipt.schemaVersion !== 1 || receipt.kind !== "context-magnet-workbench-runtime-receipt") fail("invalid receipt schema");
  if (!/^[0-9a-f]{64}$/.test(receipt.source.dirtyDiffSha256)) fail("invalid source dirty diff digest");
  if (path.basename(path.dirname(receipt.artifact.path)) !== receipt.source.dirtyDiffSha256) fail("artifact digest directory drift");
  if (!path.isAbsolute(receipt.artifact.path) || !relativeContained(artifactRoot, receipt.artifact.path)) fail("artifact path escapes root");
  if (receipt.artifact.path !== path.join(artifactRoot, receipt.source.dirtyDiffSha256, "workbench")) fail("artifact path is not canonical");
  if (!/^[0-9a-f]{64}$/.test(receipt.artifact.sha256)) fail("invalid artifact SHA-256");

  const artifactStat = lstatSync(receipt.artifact.path);
  if (!artifactStat.isFile() || artifactStat.isSymbolicLink()) fail("artifact is not a regular non-symlink file");
  if ((artifactStat.mode & 0o777) !== 0o755) fail(`artifact mode drift: ${String(artifactStat.mode & 0o777).padStart(4, "0")}`);
  const artifactRealpath = realpathSync(receipt.artifact.path);
  if (artifactRealpath !== receipt.artifact.path || !relativeContained(artifactRoot, artifactRealpath)) fail("artifact realpath containment drift");
  if (sha256(readFileSync(receipt.artifact.path)) !== receipt.artifact.sha256) fail("artifact hash drift");
  const hostArchitecture = process.arch === "x64" ? "amd64" : process.arch === "arm64" ? "arm64" : process.arch;
  if (process.platform !== receipt.artifact.platform || hostArchitecture !== receipt.artifact.architecture) fail("target platform or architecture drift");

  const sourceRoot = receipt.source.root;
  if (!path.isAbsolute(sourceRoot) || !lstatSync(sourceRoot).isDirectory()) fail("source root unavailable");
  if (command("git", ["-C", sourceRoot, "branch", "--show-current"]).trim() !== receipt.source.branch) fail("source branch drift");
  if (command("git", ["-C", sourceRoot, "rev-parse", "HEAD"]).trim() !== receipt.source.sourceRevision) fail("source revision drift");
  if (command("git", ["-C", sourceRoot, "merge-base", "HEAD", receipt.source.baseRevision]).trim() !== receipt.source.baseRevision) fail("source base drift");
  const diff = execFileSync("git", ["-C", sourceRoot, "diff", "--binary"], { encoding: "buffer" });
  if (sha256(diff) !== receipt.source.dirtyDiffSha256) fail("source dirty diff digest drift");
  const changedFiles = command("git", ["-C", sourceRoot, "diff", "--name-only"]).trim().split("\n").filter(Boolean);
  if (changedFiles.length !== receipt.source.changedFileCount) fail("source changed-file count drift");

  if (command("go", ["version"]).trim() !== receipt.build.toolchain) fail("Go toolchain drift");
  if (command(receipt.artifact.path, ["version"]).trim() !== receipt.identity.version) fail("binary version drift");
  const contextHelp = command(receipt.artifact.path, ["context", "--help"]);
  if (!contextHelp.includes("inspect decision-slots SESSION_SLOT TURN_SLOT [NONCE_SLOT]")) fail("decision-slots help witness missing");

  console.log(`verified build-only: ${receipt.artifact.path}`);
  console.log(`receipt_sha256=${sha256(receiptBytes)}`);
  console.log(`artifact_sha256=${receipt.artifact.sha256}`);
  console.log(`version=${receipt.identity.version}`);
  console.log(`source_dirty_diff_sha256=${receipt.source.dirtyDiffSha256}`);
} catch (error) {
  console.error(`build-only verification failed: ${error.message}`);
  process.exitCode = 1;
}
