import { _electron as electron } from "playwright";
import path from "node:path";

const root = process.cwd();
const executablePath = path.join(root, "test-results", "installed", "Nodus", "Nodus.exe");
const dataDir = path.join(root, ".forma-data", "installed-smoke");
const browserDataDir = path.join(root, ".forma-data", "installed-browser-profile");
const restrictedPath = "C:\\Windows\\System32;C:\\Windows";
const app = await electron.launch({
  executablePath,
  args: [`--user-data-dir=${browserDataDir}`],
  env: { ...process.env, PATH: restrictedPath, NODUS_DATA_DIR: dataDir },
});
const page = await app.firstWindow();
await page.waitForLoadState("domcontentloaded");
await page.locator('#versionSelect option[value="v1"]').waitFor({ state: "attached" });
const result = {
  title: await page.title(),
  brand: (await page.locator(".brand-copy strong").innerText()).trim(),
  model: (await page.locator("#accountModelStatus").innerText()).trim(),
  version: await page.locator("#versionSelect").inputValue(),
  preview: await page.locator("#sitePreview").getAttribute("src"),
  app: await app.evaluate(({ app }) => ({ name: app.getName(), exe: app.getPath("exe"), path: process.env.PATH })),
};
if (result.title !== "Nodus · Agent 工作台" || result.brand !== "NODUS" || result.model === "模型未配置") throw new Error("installed identity or saved model configuration was not restored");
if (result.version !== "v1" || !result.preview?.includes("/v1/index.html")) throw new Error("installed saved version or preview was not restored");
if (/node|git|bash/i.test(result.app.path)) throw new Error("external Node/Git/Bash is present on the installed app PATH");
await app.close();
console.log(JSON.stringify(result, null, 2));
