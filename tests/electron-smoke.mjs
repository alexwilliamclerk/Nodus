import { _electron as electron } from "playwright";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), ".forma-data", "electron-smoke");
await rm(dataDir, { recursive: true, force: true });

async function launch(targetDataDir = dataDir) {
  return electron.launch({
    executablePath: path.join(process.cwd(), "node_modules", "electron", "dist", "electron.exe"),
    args: ["."],
    cwd: process.cwd(),
    env: { ...process.env, FORMA_DATA_DIR: targetDataDir },
  });
}

let app = await launch();
let page = await app.firstWindow();
await page.waitForLoadState("domcontentloaded");
if (await page.locator(".selection-summary").innerText() !== "桌面后端已连接") throw new Error("Electron preload bridge is not active");
await page.locator("#requirementInput").fill("为一家精密设备企业制作介绍页面，面向采购负责人，不虚构客户与业绩。");
await page.getByRole("button", { name: "提交需求并生成方案" }).click();
await page.locator("#settingsModal:not([hidden])").waitFor();
if (await page.locator("#accountModelStatus").innerText() !== "模型未配置") throw new Error("unconfigured state is not truthful");
await page.getByRole("button", { name: "取消" }).click();
await page.waitForTimeout(300);
await app.close();

app = await launch();
page = await app.firstWindow();
await page.waitForLoadState("domcontentloaded");
await page.locator("#requirementInput").waitFor();
if (await page.locator(".selection-summary").innerText() !== "桌面后端已连接") throw new Error("Electron preload bridge was lost after restart");
const restored = await page.locator("#requirementInput").inputValue();
if (!restored.includes("精密设备企业")) throw new Error("task requirement was not restored after restart");
await page.screenshot({ path: path.join(process.cwd(), "desktop-screenshot.png"), fullPage: true });
await app.close();

console.log("electron persistence smoke passed");

const versionDataDir = path.join(process.cwd(), ".forma-data", "electron-version-smoke");
await rm(versionDataDir, { recursive: true, force: true });
for (const version of ["v1", "v2"]) {
  const dir = path.join(versionDataDir, "artifacts", "task-version", version);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), `<!doctype html><html><body>${version.toUpperCase()}</body></html>`, "utf8");
}
await mkdir(versionDataDir, { recursive: true });
await writeFile(path.join(versionDataDir, "state.json"), JSON.stringify({
  schemaVersion: 1,
  activeTaskId: "task-version",
  settings: { provider: "kimi-coding", modelId: "" },
  tasks: [{
    id: "task-version",
    title: "版本恢复测试",
    requirement: "测试本地版本恢复",
    stage: "rating",
    status: "可评价",
    timeline: [],
    options: [],
    selectedOptionIds: [],
    optionNotes: {},
    freeform: "",
    versions: [
      { id: "v1", label: "V1 · 初始生成", previewUrl: "http://127.0.0.1:1/stale" },
      { id: "v2", label: "V2 · 确认修改", previewUrl: "http://127.0.0.1:1/stale" },
    ],
    currentVersionId: "v2",
    previewVersionId: "v2",
    evaluations: [],
    ratingsDraft: {},
    createdAt: new Date().toISOString(),
  }],
}, null, 2), "utf8");

app = await launch(versionDataDir);
page = await app.firstWindow();
await page.waitForLoadState("domcontentloaded");
await page.locator("#sitePreview").waitFor();
await page.locator("#versionSelect").selectOption("v1");
await page.locator("#restoreVersion:not([hidden])").waitFor();
await page.getByRole("button", { name: "恢复此版本" }).click();
await page.locator("#versionSelect option[value='v3']").waitFor({ state: "attached" });
await app.close();
const restoredHtml = await readFile(path.join(versionDataDir, "artifacts", "task-version", "v3", "index.html"), "utf8");
if (!restoredHtml.includes("V1")) throw new Error("restored version does not contain V1 files");

console.log("electron version restore smoke passed");
