#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

const root = "/home/ubuntu/bb";
const fork = join(root, "fork");
const evidencePath = join(root, "plans/context-magnet-provider-admission-queue-baseline.json");
const receiptPaths = ["DOWNSTREAM.md", "patches/series", "patches/sha256", "result-tree.lock"];
const mode = process.argv[2];
const fail = (message) => { throw new Error(message); };
const assert = (value, message) => { if (!value) fail(message); };

function workspacePath(path) {
  const absolute = resolve(path);
  assert(absolute === root || absolute.startsWith(`${root}/`), `refusing non-workspace path: ${absolute}`);
  return absolute;
}
function text(path) {
  const absolute = workspacePath(path);
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
  try { return execFileSync("git", ["-C", fork, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (error) { fail(`git ${args.join(" ")} failed: ${String(error.stderr ?? error.message).trim()}`); }
}
function lines(value) { return value.endsWith("\n") ? value.slice(0, -1).split("\n") : value.split("\n"); }
function same(actual, expected, name) {
  assert(actual.length === expected.length && actual.every((value, index) => value === expected[index]), `${name} differs from the recorded baseline`);
}
function hash(path) { return createHash("sha256").update(readFileSync(workspacePath(path))).digest("hex"); }
function checksums(value) {
  return lines(value).map((line) => {
    const match = /^([a-f0-9]{64})  ([^/\n]+\.patch)$/.exec(line);
    assert(match, `invalid checksum line: ${line}`);
    return { hash: match[1], filename: match[2] };
  });
}
function patches() {
  return readdirSync(workspacePath(join(fork, "patches")), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".patch")).map((entry) => entry.name).sort();
}
function status(names) {
  return git(["status", "--porcelain=v1", "--untracked-files=all", "--", ".", ...names.map((name) => `patches/${name}`)]).split("\n").filter(Boolean);
}
function diff(cached = false) {
  return git(["diff", ...(cached ? ["--cached"] : []), "--no-ext-diff", "--no-color", "--full-index", "--binary", "--", ...receiptPaths]);
}
function hunks(value, file, prefix) {
  let active = ""; const found = [];
  for (const line of value.split("\n")) {
    if (line.startsWith("diff --git a/")) active = /^diff --git a\/(.+) b\//.exec(line)?.[1] ?? "";
    else if (active === file && line.startsWith(prefix) && !line.startsWith(prefix.repeat(3))) found.push(line.slice(1));
  }
  return found;
}
function subsequence(actual, expected, name) {
  let index = 0;
  for (const value of actual) if (value === expected[index]) index += 1;
  assert(index === expected.length, `${name} is missing preserved 0025 receipt intent`);
}
function verifyQueue(evidence, expectedSeries, expectedChecksumLines) {
  const currentSeriesText = text(join(fork, "patches/series"));
  const currentChecksumText = text(join(fork, "patches/sha256"));
  const series = lines(currentSeriesText);
  const entries = checksums(currentChecksumText);
  same(series, expectedSeries, "series lines");
  same(entries.map((entry) => `${entry.hash}  ${entry.filename}`), expectedChecksumLines, "checksum lines");
  same(entries.map((entry) => entry.filename), series, "checksum filenames");
  same(patches(), [...series].sort(), "patch directory entries");
  for (const entry of entries) assert(hash(join(fork, "patches", entry.filename)) === entry.hash, `checksum mismatch for ${entry.filename}`);
  assert(hash(join(fork, "patches", evidence.patch0025.filename)) === evidence.patch0025.sha256, "0025 patch bytes or SHA-256 changed");
  return { currentSeriesText, currentChecksumText };
}
function stable(evidence) {
  assert(git(["rev-parse", "HEAD"]).trim() === evidence.forkHead, "fork HEAD changed from the recorded baseline");
  assert(diff(true) === evidence.receipt.stagedDiff, "targeted receipt has staged changes");
}
function baseline(evidence) {
  stable(evidence);
  const queue = verifyQueue(evidence, lines(evidence.seriesText), lines(evidence.checksumsText));
  assert(queue.currentSeriesText === evidence.seriesText, "series bytes differ from the recorded baseline");
  assert(queue.currentChecksumText === evidence.checksumsText, "checksum bytes differ from the recorded baseline");
  assert(text(join(fork, "result-tree.lock")).trimEnd() === evidence.resultTree, "result-tree.lock differs from the recorded baseline");
  assert(diff() === evidence.receipt.unstagedDiff, "targeted receipt diff differs from the recorded baseline");
  same(status(lines(evidence.seriesText)), evidence.statusEntries, "fork status entries");
}
function appended(evidence) {
  stable(evidence);
  const prefixSeries = lines(evidence.seriesText), prefixChecksums = lines(evidence.checksumsText);
  const expectedSeries = [...prefixSeries, evidence.append.filename];
  const currentSeries = lines(text(join(fork, "patches/series")));
  same(currentSeries, expectedSeries, "series prefix or appended 0026 entry");
  const currentChecksumLines = lines(text(join(fork, "patches/sha256")));
  assert(currentChecksumLines.length === prefixChecksums.length + 1, "extra or missing checksum entries");
  same(currentChecksumLines.slice(0, prefixChecksums.length), prefixChecksums, "checksum prefix");
  const finalChecksum = checksums(currentChecksumLines.join("\n")).at(-1);
  assert(finalChecksum.filename === evidence.append.filename, "0026 checksum is not the sole appended checksum");
  assert(finalChecksum.hash === hash(join(fork, "patches", evidence.append.filename)), "0026 checksum does not match patch bytes");
  verifyQueue(evidence, expectedSeries, currentChecksumLines);
  assert(text(join(fork, "result-tree.lock")).trimEnd() !== evidence.resultTree, "result tree did not change after 0026");
  const expectedStatus = [...evidence.statusEntries, `?? patches/${evidence.append.filename}`, ...evidence.append.allowedStatusEntries];
  same(status(expectedSeries).sort(), expectedStatus.sort(), "fork status entries");
  const receipt = diff();
  same(git(["diff", "--name-only", "--", ...receiptPaths]).split("\n").filter(Boolean), receiptPaths, "targeted receipt paths");
  const additions = hunks(receipt, "DOWNSTREAM.md", "+"), removals = hunks(receipt, "DOWNSTREAM.md", "-");
  subsequence(additions, evidence.receipt.intentLines, "DOWNSTREAM.md");
  same(removals, evidence.receipt.removedLines, "DOWNSTREAM.md removals");
  const queueLine = additions.find((line) => /^- Patch queue: .+ logical patches$/.test(line));
  assert(queueLine, "DOWNSTREAM.md is missing its changed queue count");
  assert(expectedSeries.length > evidence.receipt.baselineQueueCount, "DOWNSTREAM.md queue count did not advance");
  const extras = additions.filter((line) => !evidence.receipt.intentLines.includes(line) && line !== queueLine);
  assert(extras.length <= evidence.receipt.maxAdditionalDownstreamAddedLines, "broad unexpected DOWNSTREAM.md receipt change");
  assert(extras.join("\n").toLowerCase().includes(evidence.append.requiredPhrase), "DOWNSTREAM.md append receipt is not provider-admission-specific");
}
try {
  assert(mode === "baseline" || mode === "appended", "usage: node plans/verify-context-magnet-provider-admission-queue-baseline.mjs baseline|appended");
  const evidence = JSON.parse(text(evidencePath));
  assert(evidence.schemaVersion === 1, "unsupported baseline evidence schema");
  if (mode === "baseline") baseline(evidence); else appended(evidence);
  console.log(`provider-admission-queue-baseline ${mode}: verified`);
} catch (error) {
  console.error(`provider-admission-queue-baseline ${mode ?? "invalid"}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
