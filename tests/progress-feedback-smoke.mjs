import { _electron as electron } from "playwright";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, ".forma-data", "live-flow-check");
const legacyBrowserData = path.join(process.env.APPDATA, "forma-agent-workspace");
const app = await electron.launch({
  executablePath: path.join(root, "node_modules", "electron", "dist", "electron.exe"),
  args: [".", `--user-data-dir=${legacyBrowserData}`],
  cwd: root,
  env: { ...process.env, FORMA_DATA_DIR: dataDir },
});

const page = await app.firstWindow();
await page.waitForLoadState("domcontentloaded");
await page.locator("#dialogLauncher").click();
await page.locator("#dialogInput").fill("请用一句话说明当前版本最需要保留的设计原则。");
await page.locator("#sendDialog").click();
const progress = page.locator("#progressPanel:not([hidden])");
await progress.waitFor();
await page.waitForFunction(() => document.querySelector("#progressPanel")?.dataset.status === "running");

const layout = await page.evaluate(() => {
  const box = selector => {
    const rect = document.querySelector(selector).getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
  };
  return { progress: box("#progressPanel"), action: box("#actionPanel"), workspace: box(".workspace") };
});
if (layout.action.width !== 450) throw new Error(`action panel changed width: ${layout.action.width}`);
if (layout.progress.right > layout.action.left || Math.abs(layout.progress.bottom - layout.action.bottom) > 1) {
  throw new Error("progress panel is not independently left/bottom aligned with the action panel");
}
if (layout.progress.left < layout.workspace.left || layout.action.right > layout.workspace.right) {
  throw new Error("bottom panels escaped the middle workspace");
}

await page.screenshot({ path: path.join(root, "test-results", "live-flow", "waiting-feedback.png") });
await page.locator("#sendDialog").waitFor({ state: "detached", timeout: 120_000 });
await page.waitForFunction(() => document.querySelector("#progressPanel")?.dataset.status === "success");
const finishedElapsed = await page.locator("#progressElapsed").innerText();
await page.waitForTimeout(1200);
if (await page.locator("#progressElapsed").innerText() !== finishedElapsed) throw new Error("finished timer kept running");

console.log(JSON.stringify({
  phase: await page.locator("#progressPhase").innerText(),
  elapsed: finishedElapsed,
  activity: await page.locator("#progressActivity").innerText(),
  actionWidth: layout.action.width,
  progressWidth: layout.progress.width,
  aligned: true,
  timerStopped: true,
}, null, 2));
await app.close();
