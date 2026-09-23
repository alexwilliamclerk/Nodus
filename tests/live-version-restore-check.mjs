import { _electron as electron } from "playwright";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, ".forma-data", "live-flow-check");
const artifactRoot = path.join(dataDir, "artifacts");
const state = JSON.parse(await readFile(path.join(dataDir, "state.json"), "utf8"));
const task = state.tasks.find(item => item.id === state.activeTaskId);
if (!task) throw new Error("active isolated test task is missing");

const restored = [...task.versions].reverse().find(version => version.restored && version.sourceVersionId);
if (!restored) throw new Error("no existing restored version is available for read-only verification");
const source = task.versions.find(version => version.id === restored.sourceVersionId);
if (!source) throw new Error(`restore source ${restored.sourceVersionId} is missing from history`);

async function listEntries(directory, prefix = "") {
  const entries = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, item.name);
    if (item.isDirectory()) {
      entries.push({ relative, type: "directory" });
      entries.push(...await listEntries(path.join(directory, item.name), relative));
    } else if (item.isFile()) {
      entries.push({ relative, type: "file" });
    }
  }
  return entries.sort((a, b) => `${a.relative}:${a.type}`.localeCompare(`${b.relative}:${b.type}`));
}

const sourceDir = path.join(artifactRoot, task.id, source.id);
const restoredDir = path.join(artifactRoot, task.id, restored.id);
const sourceEntries = await listEntries(sourceDir);
const restoredEntries = await listEntries(restoredDir);
const sourceNames = sourceEntries.map(entry => `${entry.type}:${entry.relative}`);
const restoredNames = restoredEntries.map(entry => `${entry.type}:${entry.relative}`);
if (JSON.stringify(sourceNames) !== JSON.stringify(restoredNames)) {
  const missing = sourceNames.filter(entry => !restoredNames.includes(entry));
  const extra = restoredNames.filter(entry => !sourceNames.includes(entry));
  throw new Error(`restore file tree differs; missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"}`);
}

for (const entry of sourceEntries.filter(item => item.type === "file")) {
  const sourceBytes = await readFile(path.join(sourceDir, entry.relative));
  const restoredBytes = await readFile(path.join(restoredDir, entry.relative));
  if (!sourceBytes.equals(restoredBytes)) throw new Error(`restored content differs: ${entry.relative}`);
}

const historicalIds = task.versions.map(version => version.id);
if (task.currentVersionId !== restored.id || task.previewVersionId !== restored.id) {
  throw new Error(`current/preview version does not point to ${restored.id}`);
}
for (const expected of [source.id, "v2", "v3", restored.id]) {
  if (!historicalIds.includes(expected)) throw new Error(`historical version ${expected} is missing`);
}

const executablePath = path.join(root, "node_modules", "electron", "dist", "electron.exe");
const app = await electron.launch({ executablePath, args: ["."], cwd: root, env: { ...process.env, FORMA_DATA_DIR: dataDir } });
const page = await app.firstWindow();
await page.waitForLoadState("domcontentloaded");
await page.locator("#sitePreview:not([hidden])").waitFor();
if (await page.locator("#versionSelect").inputValue() !== restored.id) throw new Error("version picker does not show the restored current version");

await page.waitForTimeout(250);
const frame = page.frames().find(item => item.url().includes(`/${task.id}/${restored.id}/index.html`));
if (!frame) throw new Error("restored preview frame did not load");
await frame.waitForLoadState("load");
const linkedUrls = await frame.evaluate(() => [
    ...[...document.querySelectorAll('link[rel="stylesheet"][href]')].map(item => item.href),
    ...[...document.querySelectorAll("script[src]")].map(item => item.src),
]);
const resourceNames = linkedUrls.map(url => path.basename(new URL(url).pathname));
for (const expected of ["styles.css", "app.js"]) {
  if (!resourceNames.includes(expected)) throw new Error(`restored preview did not load ${expected}`);
}
const resourceResponses = await Promise.all([
  ...resourceNames.map(name => page.waitForResponse(response => response.url().includes(`/${task.id}/${restored.id}/`) && new URL(response.url()).pathname.endsWith(`/${name}`) && response.status() === 200)),
  page.locator("#refreshPreview").click(),
]);
for (let index = 0; index < resourceNames.length; index += 1) {
  const response = resourceResponses[index];
  const relative = decodeURIComponent(new URL(response.url()).pathname.split(`/${restored.id}/`)[1]);
  const expected = await readFile(path.join(restoredDir, relative));
  const actual = await response.body();
  if (!actual.equals(expected)) throw new Error(`preview served incorrect restored resource: ${relative}`);
}

await page.screenshot({ path: path.join(root, "test-results", "live-flow", "version-restored-complete.png") });
await app.close();

console.log(JSON.stringify({
  source: source.id,
  restored: restored.id,
  exactTreeCopy: true,
  entries: sourceEntries,
  currentVersionId: task.currentVersionId,
  previewVersionId: task.previewVersionId,
  historicalVersions: historicalIds,
  previewResourcesLoaded: resourceNames,
}, null, 2));
