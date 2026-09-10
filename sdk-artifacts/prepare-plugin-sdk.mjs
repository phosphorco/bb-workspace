import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, copyFile, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

const sourceArgument = argument("--source");
const sourceReceipt = argument("--source-receipt");
const outputArgument = argument("--output") ?? ".";
const verifyExisting = process.argv.includes("--verify-existing");
if (sourceArgument === null || sourceReceipt === null) {
  throw new Error("Usage: node prepare-plugin-sdk.mjs --source <fork/build/bb> --source-receipt <worktree-tree> [--output <sdk-artifacts-dir>] [--verify-existing]");
}
if (!/^[0-9a-f]{40}$/u.test(sourceReceipt)) {
  throw new Error("--source-receipt must be an exact 40-character Git tree identifier");
}

const sourceRoot = resolve(sourceArgument);
const outputDir = resolve(outputArgument);
const packageDir = join(sourceRoot, "packages", "plugin-sdk");
const sourceManifestPath = join(packageDir, "package.json");
const sourceManifest = JSON.parse(await readFile(sourceManifestPath, "utf8"));
if (sourceManifest.name !== "@get-bb/plugin-sdk") {
  throw new Error("Expected packages/plugin-sdk to be @get-bb/plugin-sdk");
}
if (typeof sourceManifest.version !== "string" || !/^\d+\.\d+\.\d+$/u.test(sourceManifest.version)) {
  throw new Error("Expected a stable source SDK version");
}

async function regularFiles(root, relativeRoot) {
  const full = join(root, relativeRoot);
  const info = await stat(full);
  if (info.isFile()) return [relativeRoot];
  if (!info.isDirectory()) throw new Error(`Unsupported package member ${relativeRoot}`);
  const entries = await readdir(full, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    files.push(...await regularFiles(root, join(relativeRoot, entry.name)));
  }
  return files;
}

const requestedMembers = ["README.md", "bundled-types", "dist"];
const members = [];
for (const member of requestedMembers) {
  await access(join(packageDir, member));
  members.push(...await regularFiles(packageDir, member));
}
members.sort((left, right) => left.localeCompare(right));

const sourceMemberRoots = ["README.md", "package.json", "scripts", "src"];
const sourceMembers = [];
for (const member of sourceMemberRoots) {
  await access(join(packageDir, member));
  sourceMembers.push(...await regularFiles(packageDir, member));
}
sourceMembers.sort((left, right) => left.localeCompare(right));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const sourceManifestText = await readFile(sourceManifestPath, "utf8");
const inputMembers = [];
for (const member of members) {
  const body = await readFile(join(packageDir, member));
  inputMembers.push({ path: member, sha256: sha256(body), bytes: body.byteLength });
}
const sourceInputMembers = [];
for (const member of sourceMembers) {
  const body = await readFile(join(packageDir, member));
  sourceInputMembers.push({ path: member, sha256: sha256(body), bytes: body.byteLength });
}
const sourceInputDigest = sha256(JSON.stringify(sourceInputMembers));
const inputDigest = sha256(JSON.stringify({
  sourceManifestSha256: sha256(sourceManifestText),
  members: inputMembers,
}));
const packageVersion = `${sourceManifest.version}+phosphor.${sourceReceipt.slice(0, 12)}.sdk.${inputDigest.slice(0, 12)}`;
const artifactName = `get-bb-plugin-sdk-${packageVersion}.tgz`;
const receiptName = `${artifactName}.provenance.json`;

async function git(args, env = process.env) {
  const { stdout } = await execFileAsync("git", ["-C", sourceRoot, ...args], { env, maxBuffer: 10 * 1024 * 1024 });
  return stdout.trim();
}

async function verifiedWorktreeTree() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "bb-sdk-index-"));
  try {
    const temporaryIndex = join(temporaryDirectory, "index");
    const env = { ...process.env, GIT_INDEX_FILE: temporaryIndex };
    await git(["read-tree", "HEAD"], env);
    await git(["add", "-A", "--", "."], env);
    return git(["write-tree"], env);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

const [commit, indexTree, workingSdkDiff, workingTree] = await Promise.all([
  git(["rev-parse", "HEAD"]),
  git(["write-tree"]),
  git(["diff", "--binary", "--", "packages/plugin-sdk"]),
  verifiedWorktreeTree(),
]);
if (workingTree !== sourceReceipt) {
  throw new Error(`Declared source receipt ${sourceReceipt} does not match verified worktree tree ${workingTree}`);
}
const indexSdkTree = await git(["rev-parse", `${indexTree}:packages/plugin-sdk`]);
const stagedSdkDiff = await git(["diff", "--cached", "--binary", "--", "packages/plugin-sdk"]);
const workingSdkStatus = await git(["status", "--porcelain=v1", "--", "packages/plugin-sdk"]);

await mkdir(outputDir, { recursive: true });
const artifactPath = join(outputDir, artifactName);
let existingArtifact = false;
try {
  await access(artifactPath);
  existingArtifact = true;
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
}
if (existingArtifact && !verifyExisting) {
  throw new Error(`Refusing to overwrite existing artifact ${artifactPath}`);
}

if (!existingArtifact) {
const staging = await mkdtemp(join(tmpdir(), "bb-plugin-sdk-pack-"));
try {
  const stagingPackage = join(staging, "package");
  await mkdir(stagingPackage, { recursive: true });
  const packedManifest = { ...sourceManifest, version: packageVersion };
  await writeFile(join(stagingPackage, "package.json"), `${JSON.stringify(packedManifest, null, 2)}\n`);
  for (const member of members) {
    const destination = join(stagingPackage, member);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(packageDir, member), destination);
  }
  const { stdout } = await execFileAsync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", outputDir], {
    cwd: stagingPackage,
    maxBuffer: 10 * 1024 * 1024,
  });
  const packed = JSON.parse(stdout);
  if (!Array.isArray(packed) || packed.length !== 1 || packed[0]?.filename !== artifactName) {
    throw new Error(`Unexpected npm pack result: ${stdout}`);
  }
} finally {
  await rm(staging, { recursive: true, force: true });
}
}

const artifact = await readFile(artifactPath);
const receipt = {
  format: "bb-plugin-sdk-local-artifact-v1",
  artifact: {
    file: artifactName,
    sha256: sha256(artifact),
    bytes: artifact.byteLength,
  },
  package: {
    name: sourceManifest.name,
    version: packageVersion,
    sourceVersion: sourceManifest.version,
    exports: Object.keys(sourceManifest.exports ?? {}).sort(),
    peerDependencies: sourceManifest.peerDependencies ?? {},
    files: sourceManifest.files ?? [],
  },
  source: {
    relativeRoot: relative(outputDir, sourceRoot) || ".",
    commit,
    indexTree,
    indexSdkTree,
    declaredReceipt: sourceReceipt,
    verifiedWorktreeTree: workingTree,
    sourceManifestSha256: sha256(sourceManifestText),
    sourceInputSha256: sourceInputDigest,
    sourceMembers: sourceInputMembers,
    workingSdkDiffSha256: sha256(workingSdkDiff),
    stagedSdkDiffSha256: sha256(stagedSdkDiff),
    workingSdkStatus: workingSdkStatus === "" ? [] : workingSdkStatus.split("\n"),
    packagedInputSha256: inputDigest,
    members: inputMembers,
  },
  recipe: {
    file: basename(import.meta.filename ?? process.argv[1]),
    sha256: sha256(await readFile(process.argv[1])),
    command: `node ${basename(process.argv[1])} --source ${relative(outputDir, sourceRoot) || "."} --source-receipt ${sourceReceipt} --output .`,
  },
};
await writeFile(join(outputDir, receiptName), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ artifact: artifactPath, receipt: join(outputDir, receiptName), ...receipt.artifact, package: receipt.package }, null, 2));
