import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const artifactName = "get-bb-plugin-sdk-0.4.98+phosphor.045a825edd2b.sdk.92b3acd09a4a.tgz";
const artifact = resolve(root, "sdk-artifacts", artifactName);
const receiptPath = `${artifact}.provenance.json`;
const expectedTree = "045a825edd2baf1d56dfaaf676642e071619c515";
const expectedSdkTree = "e30fcdd7f9f67a7920be51af0ed4ec59bf6ada1c";
const expectedSha256 = "feb4c3d309b2b5752459d63b2c8bdfc3bd0c49d08f6f7355538cc9b82a0db1a3";
const expectedVersion = "0.4.98+phosphor.045a825edd2b.sdk.92b3acd09a4a";
const expectedInputSha256 = "92b3acd09a4aad41a43f8829952402aabf29285d5be0e00b2964fef0db915947";
const expectedPatchSha256 = "634f8ad29799f89086b81f00f7684fb0c6d849f8ead8310d0526af55e4b8f860";
const emptySha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const installedManifestPath = resolve(root, "plugins", "node_modules", "@get-bb", "plugin-sdk", "package.json");
const definitionPath = resolve(root, "plugins", "tools", "workspaces-sync", "definition.ts");
const upstream = resolve(root, "fork", "upstream");
const patchPath = resolve(root, "fork", "patches", "0026-feat-context-magnet-provider-admission.patch");
const requiredDeclarations = [
  "experimental_contextMagnetTrace",
  "admissions",
  "admissionGaps",
  "admissionAttemptSeqHighWatermark",
  "admissionObservationSeqHighWatermark",
  "admissionRetentionHighWatermark",
];

function requireEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

if (!existsSync(artifact) || !existsSync(receiptPath)) throw new Error("selected SDK archive or provenance receipt is missing");
const archive = readFileSync(artifact);
requireEqual(createHash("sha256").update(archive).digest("hex"), expectedSha256, "archive sha256");
const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
requireEqual(receipt.format, "bb-plugin-sdk-local-artifact-v1", "receipt format");
requireEqual(receipt.artifact.file, artifactName, "receipt artifact file");
requireEqual(receipt.artifact.sha256, expectedSha256, "receipt artifact sha256");
requireEqual(receipt.artifact.bytes, archive.byteLength, "receipt artifact bytes");
requireEqual(receipt.package.name, "@get-bb/plugin-sdk", "receipt package name");
requireEqual(receipt.package.version, expectedVersion, "receipt package version");
requireEqual(receipt.source.declaredReceipt, expectedTree, "declared result tree");
requireEqual(receipt.source.verifiedWorktreeTree, expectedTree, "verified result tree");
requireEqual(receipt.source.indexTree, expectedTree, "source index tree");
requireEqual(receipt.source.indexSdkTree, expectedSdkTree, "source SDK tree");
requireEqual(receipt.source.workingSdkDiffSha256, emptySha256, "source working SDK diff");
requireEqual(receipt.source.stagedSdkDiffSha256, emptySha256, "source staged SDK diff");
if (!Array.isArray(receipt.source.workingSdkStatus) || receipt.source.workingSdkStatus.length !== 0) {
  throw new Error("source SDK status is not clean");
}
requireEqual(receipt.source.packagedInputSha256, expectedInputSha256, "packaged input sha256");
requireEqual(expectedVersion.split(".sdk.").at(-1), expectedInputSha256.slice(0, 12), "version input suffix");
requireEqual(readFileSync(resolve(root, "fork", "result-tree.lock"), "utf8").trim(), expectedTree, "fork result-tree.lock");
requireEqual(createHash("sha256").update(readFileSync(patchPath)).digest("hex"), expectedPatchSha256, "0026 patch sha256");
requireEqual(execFileSync("git", ["-C", upstream, "cat-file", "-t", expectedTree], { encoding: "utf8" }).trim(), "tree", "result object type");
requireEqual(execFileSync("git", ["-C", upstream, "rev-parse", `${expectedTree}:packages/plugin-sdk`], { encoding: "utf8" }).trim(), expectedSdkTree, "result SDK tree object");
const definition = readFileSync(definitionPath, "utf8");
for (const value of [artifactName, expectedVersion, expectedSha256]) {
  if (!definition.includes(value)) throw new Error(`shared SDK definition does not select ${value}`);
}
const listing = execFileSync("tar", ["-xOf", artifact, "package/bundled-types/bb-plugin-sdk.d.ts"], { encoding: "utf8" });
for (const declaration of requiredDeclarations) {
  if (!listing.includes(declaration)) throw new Error(`packed public declarations omit ${declaration}`);
}
if (!existsSync(installedManifestPath)) throw new Error("installed plugin SDK manifest is missing; run bun install in plugins");
const installedManifest = JSON.parse(readFileSync(installedManifestPath, "utf8"));
requireEqual(installedManifest.name, "@get-bb/plugin-sdk", "installed package name");
requireEqual(installedManifest.version, expectedVersion, "installed package version");
const installedDeclarations = readFileSync(resolve(root, "plugins", "node_modules", "@get-bb", "plugin-sdk", "bundled-types", "bb-plugin-sdk.d.ts"), "utf8");
for (const declaration of requiredDeclarations) {
  if (!installedDeclarations.includes(declaration)) throw new Error(`installed public declarations omit ${declaration}`);
}
console.log(JSON.stringify({ artifact: artifactName, sha256: expectedSha256, resultTree: expectedTree, declarations: requiredDeclarations, installedVersion: expectedVersion }));
