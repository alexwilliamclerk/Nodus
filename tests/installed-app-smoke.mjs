import { _electron as electron } from "playwright";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const executablePath = path.join(root, "test-results", "installed", "Nodus", "Nodus.exe");
const dataDir = path.join(root, ".forma-data", "installed-smoke");
const browserDataDir = path.join(root, ".forma-data", "installed-browser-profile");
const sourceCredential = path.join(root, ".forma-data", "live-flow-check", "credentials.json");
const legacyBrowserState = path.join(process.env.APPDATA, "forma-agent-workspace", "Local State");
const restrictedPath = "C:\\Windows\\System32;C:\\Windows";

await rm(dataDir, { recursive: true, force: true });
await rm(browserDataDir, { recursive: true, force: true });
await mkdir(dataDir, { recursive: true });
await mkdir(browserDataDir, { recursive: true });
await cp(sourceCredential, path.join(dataDir, "credentials.json"));
await cp(legacyBrowserState, path.join(browserDataDir, "Local State"));

function launch() {
  return electron.launch({
    executablePath,
    args: [`--user-data-dir=${browserDataDir}`],
    env: { ...process.env, PATH: restrictedPath, NODUS_DATA_DIR: dataDir },
  });
}

let app = await launch();
let page = await app.firstWindow();
await page.waitForLoadState("domcontentloaded");
if ((await page.title()) !== "Nodus · Agent 工作台") throw new Error("installed window title is not Nodus");
if ((await page.locator(".brand-copy strong").innerText()).trim() !== "NODUS") throw new Error("installed app brand is not NODUS");
if ((await page.locator("#accountModelStatus").innerText()).trim() === "模型未配置") throw new Error("installed Pi could not restore the encrypted model configuration");

const appPath = await app.evaluate(({ app }) => ({ name: app.getName(), exe: app.getPath("exe"), runtimePath: process.env.PATH }));
if (appPath.name !== "Nodus" || !appPath.exe.endsWith("Nodus.exe")) throw new Error("installed app identity is incorrect");
if (/node|git|bash/i.test(appPath.runtimePath)) throw new Error("external Node/Git/Bash remained on the installed app PATH");

await page.locator("#requirementInput").fill("为一家工业传感器企业制作简洁的中文介绍页，面向采购人员；仅使用已给需求，不虚构客户、资质、业绩或联系方式。");
await page.locator("#submitRequirement").click();
const optionOutcome = await Promise.race([
  page.locator("#submitDecision").waitFor({ state: "visible", timeout: 180_000 }).then(() => "options"),
  page.locator(".error-panel").waitFor({ state: "visible", timeout: 180_000 }).then(() => "error"),
]);
if (optionOutcome === "error") throw new Error(`installed option generation failed: ${await page.locator(".error-panel").innerText()}`);
if (await page.locator("[data-option]").count() !== 4) throw new Error("installed model did not generate four options");

await page.locator("[data-option]").first().click();
await page.locator("#submitDecision").click();
const generationOutcome = await Promise.race([
  page.locator("#submitRating").waitFor({ state: "visible", timeout: 300_000 }).then(() => "rating"),
  page.locator(".error-panel").waitFor({ state: "visible", timeout: 300_000 }).then(() => "error"),
]);
if (generationOutcome === "error") throw new Error(`installed Pi generation failed: ${await page.locator(".error-panel").innerText()}`);
await page.locator('#versionSelect option[value="v1"]').waitFor({ state: "attached" });
const previewUrl = await page.locator("#sitePreview").getAttribute("src");
if (!previewUrl?.includes("/v1/index.html")) throw new Error("installed preview does not point to generated V1");
await page.screenshot({ path: path.join(root, "test-results", "installed", "installed-real-v1.png") });
await app.close();

const state = JSON.parse(await readFile(path.join(dataDir, "state.json"), "utf8"));
const task = state.tasks.find(item => item.id === state.activeTaskId);
const artifactFiles = ["index.html", "styles.css", "app.js"];
for (const file of artifactFiles) await readFile(path.join(dataDir, "artifacts", task.id, "v1", file));

app = await launch();
page = await app.firstWindow();
await page.waitForLoadState("domcontentloaded");
await page.locator('#versionSelect option[value="v1"]').waitFor({ state: "attached" });
if (!(await page.locator("#taskTitle").innerText()).includes("工业传感器企业")) throw new Error("installed app did not restore the saved task after restart");
if (!(await page.locator("#sitePreview").getAttribute("src"))?.includes("/v1/index.html")) throw new Error("installed app did not restore the preview after restart");
await app.close();

await rm(browserDataDir, { recursive: true, force: true });

console.log(JSON.stringify({
  appName: appPath.name,
  executable: appPath.exe,
  externalRuntimePathRemoved: true,
  modelConfigurationRestored: true,
  generatedOptions: 4,
  generatedVersion: task.currentVersionId,
  artifactFiles,
  previewLoaded: true,
  taskRestoredAfterRestart: true,
}, null, 2));
