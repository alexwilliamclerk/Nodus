import { _electron as electron } from "playwright";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const executablePath = path.join(root, "node_modules", "electron", "dist", "electron.exe");
const testData = path.join(root, ".forma-data", "live-flow-check");
const screenshotDir = path.join(root, "test-results", "live-flow");
const result = { steps: [], blocker: null };

function launch(dataDir) {
  return electron.launch({ executablePath, args: ["."], cwd: root, env: { ...process.env, ...(dataDir ? { FORMA_DATA_DIR: dataDir } : {}) } });
}

async function loadedPage(app) {
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.locator("#actionPanel").waitFor();
  return page;
}

async function waitForOne(page, entries, timeout = 120_000) {
  return Promise.race(entries.map(({ name, selector }) => page.locator(selector).waitFor({ state: "visible", timeout }).then(() => name)));
}

await rm(testData, { recursive: true, force: true });
await rm(screenshotDir, { recursive: true, force: true });
await mkdir(testData, { recursive: true });
await mkdir(screenshotDir, { recursive: true });

let probe = await launch();
let page = await loadedPage(probe);
const modelStatus = (await page.locator("#accountModelStatus").innerText()).trim();
const userData = await probe.evaluate(({ app }) => app.getPath("userData"));
const configured = modelStatus !== "模型未配置";
result.steps.push({ step: "桌面启动", ok: true, detail: "Electron preload 与本地后端已连接" });
result.steps.push({ step: "模型恢复", ok: configured, detail: modelStatus });
await probe.close();

if (configured) {
  await cp(path.join(userData, "forma-data", "credentials.json"), path.join(testData, "credentials.json"));
}

const app = await launch(testData);
page = await loadedPage(app);
await page.locator("#requirementInput").fill("为一家精密设备企业制作中文介绍页面，面向采购负责人；突出研发、质量和交付流程，不虚构客户、资质、业绩或联系方式。");
await page.locator("#submitRequirement").click();

if (!configured) {
  await page.locator("#settingsModal:not([hidden])").waitFor();
  result.steps.push({ step: "提交初始需求", ok: true, detail: "需求已保存，正确进入模型配置" });
  result.blocker = {
    step: "生成四个方案",
    reason: "本机当前没有已验证的模型凭据",
    needs: "在桌面应用设置中配置 Kimi Coding Plan、智谱 Coding Plan 或 DeepSeek API 之一；不要在聊天中粘贴密钥",
  };
  await page.screenshot({ path: path.join(screenshotDir, "blocked-model-configuration.png") });
  await app.close();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

let outcome = await waitForOne(page, [
  { name: "options", selector: "#submitDecision" },
  { name: "error", selector: ".error-panel" },
]);
if (outcome === "error") {
  result.blocker = { step: "生成四个方案", reason: await page.locator(".error-panel").innerText() };
} else {
  result.steps.push({ step: "生成四个方案", ok: true, detail: `${await page.locator("[data-option]").count()} 个真实模型方案` });
  await page.locator("#dialogLauncher").click();
  await page.locator("#dialogInput").fill("这组方案怎样避免虚构企业事实？");
  await page.locator("#sendDialog").click();
  try {
    await page.locator("#sendDialog").waitFor({ state: "detached", timeout: 90_000 });
    result.steps.push({ step: "临时对话", ok: true, detail: "完整回复后返回方案选择" });
  } catch {
    result.steps.push({ step: "临时对话", ok: false, detail: "90 秒内未返回完整回复" });
    await page.locator("#cancelDialog").click();
  }
  await page.locator("[data-option]").first().click();
  await page.locator("#submitDecision").click();
  outcome = await waitForOne(page, [
    { name: "rating", selector: "#submitRating" },
    { name: "error", selector: ".error-panel" },
  ], 240_000);
  if (outcome === "error") {
    result.blocker = { step: "Pi 生成 V1", reason: await page.locator(".error-panel").innerText() };
  } else {
    const previewUrl = await page.locator("#sitePreview").getAttribute("src");
    result.steps.push({ step: "Pi 生成 V1 与预览", ok: Boolean(previewUrl), detail: previewUrl });
    for (const group of await page.locator("[data-rating]").all()) await group.locator('[data-score="4"]').click();
    await page.locator("#ratingComment").fill("请增强首屏行动路径，同时保持事实边界和现有信息结构。");
    await page.locator("#submitRating").click();
    outcome = await waitForOne(page, [
      { name: "revision", selector: "#confirmRevision" },
      { name: "error", selector: ".error-panel" },
    ]);
    if (outcome === "error") {
      result.blocker = { step: "评分分析", reason: await page.locator(".error-panel").innerText() };
    } else {
      result.steps.push({ step: "评分与修改建议", ok: true, detail: "评价绑定 V1，修改前等待确认" });
      await page.locator("#confirmRevision").click();
      outcome = await Promise.race([
        page.locator('#versionSelect option[value="v2"]').waitFor({ state: "attached", timeout: 240_000 }).then(() => "v2"),
        page.locator(".error-panel").waitFor({ state: "visible", timeout: 240_000 }).then(() => "error"),
      ]);
      if (outcome === "error") {
        result.blocker = { step: "Pi 生成 V2", reason: await page.locator(".error-panel").innerText() };
      } else {
        result.steps.push({ step: "确认修改并生成 V2", ok: true, detail: "版本选择器出现 V2" });
        await page.locator("#versionSelect").selectOption("v1");
        await page.locator("#restoreVersion").click();
        await page.locator('#versionSelect option[value="v3"]').waitFor({ state: "attached" });
        result.steps.push({ step: "查看并恢复 V1", ok: true, detail: "从 V1 创建 V3，V2 历史保留" });
      }
    }
  }
}

await page.screenshot({ path: path.join(screenshotDir, result.blocker ? "blocked-later-step.png" : "full-flow-complete.png") });
await app.close();
console.log(JSON.stringify(result, null, 2));
