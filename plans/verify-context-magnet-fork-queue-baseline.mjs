#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = "/home/ubuntu/bb";
const fork = join(root, "fork");
const evidencePath = join(root, "plans/context-magnet-fork-queue-baseline.json");
const receiptPaths = ["DOWNSTREAM.md", "patches/series", "patches/sha256", "result-tree.lock"];
const mode = process.argv[2];

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function checkedPath(path) {
  const absolute = resolve(path);
  assert(absolute === root || absolute.startsWith(`${root}/`), `refusing non-workspace path: ${absolute}`);
  return absolute;
}

function readText(path) {
  const absolute = checkedPath(path);
  try {
    const stat = lstatSync(absolute);
    assert(stat.isFile() && !stat.isSymbolicLink(), `missing regular file: ${absolute}`);
    assert(realpathSync(absolute).startsWith(`${root}/`), `path escapes workspace: ${absolute}`);
    return readFileSync(absolute, "utf8");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("missing regular file:")) throw error;
    fail(`cannot read ${absolute}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function git(args) {
  try {
    return execFileSync("git", ["-C", fork, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    fail(`git ${args.join(" ")} failed${stderr ? `: ${stderr.trim()}` : ""}`);
  }
}

function lines(text) {
  return text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
}

function sameArray(actual, expected, label) {
  assert(actual.length === expected.length && actual.every((value, index) => value === expected[index]), `${label} differs from the recorded baseline`);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(checkedPath(path))).digest("hex");
}

function regularPatchNames() {
  const patches = checkedPath(join(fork, "patches"));
  const entries = readdirSync(patches, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".patch"))
    .map((entry) => entry.name)
    .sort();
  return entries;
}

function checksumEntries(text) {
  return lines(text).map((line) => {
    const match = /^([a-f0-9]{64})  ([^/\n]+\.patch)$/.exec(line);
    assert(match, `invalid checksum line: ${line}`);
    return { hash: match[1], filename: match[2] };
  });
}

function receiptDiff(cached = false) {
  return git(["diff", ...(cached ? ["--cached"] : []), "--no-ext-diff", "--no-color", "--full-index", "--binary", "--", ...receiptPaths]);
}

function receiptAdditions(diff, filename) {
  let active = "";
  const values = [];
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git a/")) {
      active = line.slice("diff --git a/".length).split(" b/")[0];
    } else if (active === filename && line.startsWith("+") && !line.startsWith("+++")) {
      values.push(line.slice(1));
    }
  }
  return values;
}

function receiptRemovals(diff, filename) {
  let active = "";
  const values = [];
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git a/")) {
      active = line.slice("diff --git a/".length).split(" b/")[0];
    } else if (active === filename && line.startsWith("-") && !line.startsWith("---")) {
      values.push(line.slice(1));
    }
  }
  return values;
}

function requireSubsequence(actual, expected, label) {
  let index = 0;
  for (const value of actual) if (value === expected[index]) index += 1;
  assert(index === expected.length, `${label} is missing recorded 0024 intent`);
}

function queueCountFromReceipt(line) {
  const match = /^- Patch queue: ([a-z0-9-]+) logical patches$/.exec(line);
  assert(match, "DOWNSTREAM.md is missing its changed queue count");
  const numeric = Number(match[1]);
  if (Number.isSafeInteger(numeric)) return numeric;
  const words = new Map([
    ["twenty-three", 23],
    ["twenty-four", 24],
  ]);
  const count = words.get(match[1]);
  assert(count !== undefined, `unsupported queue-count receipt: ${match[1]}`);
  return count;
}

function currentStatus(patchNames) {
  return git(["status", "--porcelain=v1", "--untracked-files=all", "--", ...receiptPaths, ...patchNames.map((name) => `patches/${name}`)])
    .split("\n").filter(Boolean);
}

function validateQueue(evidence, expectedSeries, expectedChecksums) {
  const seriesText = readText(join(fork, "patches/series"));
  const checksumText = readText(join(fork, "patches/sha256"));
  const series = lines(seriesText);
  const checksums = checksumEntries(checksumText);
  sameArray(series, expectedSeries, "series lines");
  sameArray(checksums.map((entry) => `${entry.hash}  ${entry.filename}`), expectedChecksums, "checksum lines");
  sameArray(checksums.map((entry) => entry.filename), series, "checksum filenames");
  sameArray(regularPatchNames(), [...series].sort(), "patch directory entries");
  for (const entry of checksums) {
    assert(sha256(join(fork, "patches", entry.filename)) === entry.hash, `checksum mismatch for ${entry.filename}`);
  }
  const patch0024 = evidence.fork.patch0024;
  assert(series.includes(patch0024.filename), "0024 was removed from the series");
  assert(sha256(join(fork, "patches", patch0024.filename)) === patch0024.sha256, "0024 patch bytes or SHA-256 changed");
  return { seriesText, checksumText, series, checksums };
}

function validateUnchangedMetadata(evidence) {
  assert(git(["rev-parse", "HEAD"]).trim() === evidence.fork.head, "fork HEAD changed from the recorded baseline");
  assert(receiptDiff(true) === evidence.fork.targetedReceipt.stagedDiff, "targeted receipt has staged changes");
}

function baseline(evidence) {
  validateUnchangedMetadata(evidence);
  const expectedSeries = lines(evidence.fork.series.text);
  const expectedChecksums = lines(evidence.fork.checksums.text);
  const queue = validateQueue(evidence, expectedSeries, expectedChecksums);
  assert(queue.seriesText === evidence.fork.series.text, "series bytes differ from the recorded baseline");
  assert(queue.checksumText === evidence.fork.checksums.text, "checksum bytes differ from the recorded baseline");
  assert(readText(join(fork, "result-tree.lock")).trimEnd() === evidence.fork.resultTree, "result-tree.lock differs from the recorded baseline");
  assert(receiptDiff() === evidence.fork.targetedReceipt.unstagedDiff, "targeted receipt diff differs from the recorded baseline");
  sameArray(currentStatus(evidence.fork.patchesDirectoryEntries), evidence.fork.queueStatusEntries, "queue status entries");
}

function appended(evidence) {
  validateUnchangedMetadata(evidence);
  const baselineSeries = lines(evidence.fork.series.text);
  const baselineChecksums = lines(evidence.fork.checksums.text);
  const patch0025 = evidence.append.filename;
  const expectedSeries = [...baselineSeries, patch0025];
  const currentSeries = lines(readText(join(fork, "patches/series")));
  assert(currentSeries.length === expectedSeries.length, "extra or missing queue entries; only 0025 may append");
  sameArray(currentSeries, expectedSeries, "series prefix or append entry");

  const currentChecksumLines = lines(readText(join(fork, "patches/sha256")));
  assert(currentChecksumLines.length === baselineChecksums.length + 1, "extra or missing checksum entries");
  sameArray(currentChecksumLines.slice(0, baselineChecksums.length), baselineChecksums, "checksum prefix");
  const currentChecksums = checksumEntries(currentChecksumLines.join("\n"));
  assert(currentChecksums.at(-1).filename === patch0025, "0025 checksum is not the sole appended checksum");
  assert(currentChecksums.at(-1).hash === sha256(join(fork, "patches", patch0025)), "0025 checksum does not match patch bytes");
  validateQueue(evidence, expectedSeries, currentChecksumLines);
  assert(readText(join(fork, "result-tree.lock")).trimEnd() !== evidence.fork.resultTree, "result tree did not change after 0025");

  const expectedStatus = [...evidence.fork.queueStatusEntries, `?? patches/${patch0025}`];
  sameArray(currentStatus([...evidence.fork.patchesDirectoryEntries, patch0025]), expectedStatus, "queue status entries");

  const diff = receiptDiff();
  const changed = git(["diff", "--name-only", "--", ...receiptPaths]).split("\n").filter(Boolean);
  sameArray(changed, receiptPaths, "targeted receipt paths");
  const additions = receiptAdditions(diff, "DOWNSTREAM.md");
  const removals = receiptRemovals(diff, "DOWNSTREAM.md");
  requireSubsequence(additions, evidence.fork.targetedReceipt.downstreamIntentLines, "DOWNSTREAM.md");
  sameArray(removals, evidence.fork.targetedReceipt.downstreamRemovedLines, "DOWNSTREAM.md removals");
  const queueLine = additions.find((line) => line.startsWith("- Patch queue: "));
  const queueCount = queueCountFromReceipt(queueLine ?? "");
  assert(queueCount === evidence.fork.targetedReceipt.baselineQueueCount + 1, "DOWNSTREAM.md queue count did not advance by exactly one");
  const extraAdditions = additions.filter((line) => !evidence.fork.targetedReceipt.downstreamIntentLines.includes(line) && line !== queueLine);
  assert(extraAdditions.length <= evidence.fork.targetedReceipt.maxAdditionalDownstreamAddedLines, "broad unexpected DOWNSTREAM.md receipt change");
  assert(extraAdditions.join("\n").includes(evidence.append.requiredPhrase), "DOWNSTREAM.md append receipt is not Context Magnet-specific");
}

try {
  assert(mode === "baseline" || mode === "appended", "usage: node plans/verify-context-magnet-fork-queue-baseline.mjs baseline|appended");
  const evidence = JSON.parse(readText(evidencePath));
  assert(evidence.schemaVersion === 1, "unsupported baseline evidence schema");
  if (mode === "baseline") baseline(evidence);
  else appended(evidence);
  console.log(`fork-queue-baseline ${mode}: verified`);
} catch (error) {
  console.error(`fork-queue-baseline ${mode ?? "invalid"}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
