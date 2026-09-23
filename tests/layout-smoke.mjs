import { _electron as electron } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
await mkdir(path.join(root, ".forma-data"), { recursive: true });
const dataDir = await mkdtemp(path.join(root, ".forma-data", "layout-compact-"));
const screenshotDir = path.join(root, "test-results", "layout", path.basename(dataDir));
const expectedActionWidth = 450;
const measuredWidths = [];
const measuredLauncherWidths = [];
await mkdir(screenshotDir, { recursive: true });

const task = {
  id: "layout-task",
  title: "精密制造企业介绍页面",
  requirement: "为精密制造企业制作可信、克制的企业介绍页面，面向采购负责人。",
  stage: "options",
  status: "待选择",
  decisionQuestion: "选择页面方向",
  timeline: [{ type: "user", meta: "你 · 初始需求", text: "制作企业介绍页面" }],
  options: [
    { id: "a", title: "工程可信", description: "从企业的加工能力、工艺流程和质量管理出发，说明可以承接的材料、零件类型与交付范围。按采购人员的阅读顺序展示检测设备、生产步骤和联系入口；缺少认证或客户材料时保留待补充说明，不把未经确认的信息写成事实。" },
    { id: "b", title: "采购效率", description: "将采购最关心的能力、起订要求、沟通材料和交付流程集中呈现，让访客快速判断是否适合合作。每个关键段落都提供清晰的下一步提示，并解释询价前需要准备哪些图纸、数量和技术要求，减少反复沟通。" },
    { id: "c", title: "克制视觉", description: "以清晰网格、适当留白和真实材料照片建立专业感，保持标题、说明与操作入口的阅读层级。长内容按主题组织并自然换行，兼顾桌面和手机的访问体验；不会为了视觉效果省略企业能力限制和必要的联系信息。" },
    { id: "d", title: "案例路径", description: "围绕不同应用场景组织页面，解释典型需求如何进入评估、打样、生产与验收流程。案例中的客户名称、项目结果和业绩只使用已提供的资料；没有实际案例时展示明确标注的流程示意，并引导用户补充可公开的材料。" },
  ],
  selectedOptionIds: ["a"],
  optionNotes: {},
  freeform: "",
  versions: [],
  currentVersionId: null,
  previewVersionId: null,
  evaluations: [],
  recommendation: { optionIds: ["a", "b"], reason: "兼顾可信度与采购效率。" },
  ratingsDraft: {},
  operation: {
    phase: "options",
    label: "方案生成完成",
    status: "success",
    startedAt: new Date(Date.now() - 3200).toISOString(),
    endedAt: new Date().toISOString(),
    lastActivity: "四个方案已生成",
    lastActivityAt: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
};

await writeFile(path.join(dataDir, "state.json"), JSON.stringify({
  schemaVersion: 1,
  activeTaskId: task.id,
  tasks: [
    task,
    { ...task, id: 'layout-rating', title: '评分布局测试', stage: 'rating', versions: [{id:'v1',label:'V1 · 布局测试作品'}], currentVersionId:'v1', previewVersionId:'v1' },
    { ...task, id: 'layout-input', title: '初始输入布局测试', stage: 'input', requirement: '', selectedOptionIds: [], status: '待输入' },
  ],
  settings: { provider: "kimi-coding", modelId: "" },
}, null, 2), "utf8");
await mkdir(path.join(dataDir, 'artifacts', 'layout-rating', 'v1'), {recursive:true});
await writeFile(path.join(dataDir, 'artifacts', 'layout-rating', 'v1', 'index.html'), '<!doctype html><html><body><h1>布局测试作品</h1><p>用于验证预览尺寸与评分布局。</p></body></html>');

const app = await electron.launch({
  executablePath: path.join(root, "node_modules", "electron", "dist", "electron.exe"),
  args: ["."],
  cwd: root,
  env: { ...process.env, NODUS_DATA_DIR: dataDir, FORMA_DATA_DIR: dataDir },
});

const page = await app.firstWindow();
await page.waitForLoadState("domcontentloaded");
await page.locator("#submitDecision").waitFor();

async function resize(width, height) {
  await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(size.width, size.height), { width, height });
  await page.waitForTimeout(250);
}

async function assertLayout(label, submitSelector, { launcherEnabled = true } = {}) {
  const result = await page.evaluate(selector => {
    const rect = element => {
      const value = document.querySelector(element).getBoundingClientRect();
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
    };
    const action = rect("#actionPanel");
    const progress = document.querySelector("#progressPanel").hidden ? null : rect("#progressPanel");
    const workspace = rect(".workspace");
    const preview = rect("#previewColumn");
    const submit = rect(selector);
    const launcher = rect("#dialogLauncher");
    const footer = rect(".action-footer");
    const bottomWorkspace = rect(".bottom-workspace");
    const record = rect("#recordPanel");
    const actionElement = document.querySelector("#actionPanel");
    const progressElement = document.querySelector("#progressPanel");
    const optionCards = [...document.querySelectorAll(".option-card")].map(element => element.getBoundingClientRect());
    const overlaps = !(submit.right <= launcher.left || launcher.right <= submit.left || submit.bottom <= launcher.top || launcher.bottom <= submit.top);
    return {
      action, progress, workspace, preview, submit, launcher, footer, bottomWorkspace, record, overlaps,
      launcherCount: document.querySelectorAll("#dialogLauncher").length,
      launcherInsideAction: actionElement.contains(document.querySelector("#dialogLauncher")),
      launcherInsideFooter: document.querySelector(".action-footer").contains(document.querySelector("#dialogLauncher")),
      launcherInsidePreview: document.querySelector("#previewColumn").contains(document.querySelector("#dialogLauncher")),
      launcherDisabled: document.querySelector("#dialogLauncher").disabled,
      launcherText: document.querySelector("#dialogLauncher").textContent.trim().replace(/\s+/g, " "),
      hasPreviewDock: Boolean(document.querySelector(".preview-dock")),
      progressBackground: progressElement.hidden ? null : getComputedStyle(progressElement).backgroundColor,
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      actionScrollWidth: actionElement.scrollWidth,
      actionClientWidth: actionElement.clientWidth,
      optionsSingleColumn: optionCards.length < 2 || optionCards.every((card, index) => index === 0 || card.top > optionCards[index - 1].top),
    };
  }, submitSelector);
  const epsilon = 1;
  measuredWidths.push({ label, width: result.action.width, action: result.action, progress: result.progress, record: result.record });
  measuredLauncherWidths.push(result.launcher.width);
  if (Math.abs(result.action.width - expectedActionWidth) > 0.05) throw new Error(`${label}: action width ${result.action.width}px, expected ${expectedActionWidth}px`);
  if (result.action.height > 280.05) throw new Error(`${label}: action height ${result.action.height}px exceeds the 280px total cap`);
  if (Math.abs(result.bottomWorkspace.height - result.action.height) > epsilon || Math.abs(result.record.bottom - result.action.top) > epsilon || Math.abs(result.action.bottom - result.workspace.bottom) > epsilon) throw new Error(`${label}: parent grid leaves unused space or stretches the bottom row`);
  if (result.footer.top < result.action.top || result.footer.bottom > result.action.bottom || result.submit.top < result.footer.top || result.submit.bottom > result.footer.bottom) throw new Error(`${label}: footer controls are clipped`);
  if (result.action.left < result.workspace.left - epsilon || result.action.right > result.workspace.right + epsilon) throw new Error(`${label}: action panel escaped workspace`);
  if (result.progress && (result.progress.left < result.workspace.left - epsilon || result.progress.right > result.action.left + epsilon || Math.abs(result.progress.top - result.action.top) > epsilon || Math.abs(result.progress.bottom - result.action.bottom) > epsilon || Math.abs(result.progress.height - result.action.height) > epsilon)) throw new Error(`${label}: progress panel alignment or containment failed`);
  if (result.progress && result.progressBackground !== "rgba(255, 254, 249, 0.6)") throw new Error(`${label}: progress background is ${result.progressBackground}`);
  if (result.workspace.right > result.preview.left + epsilon) throw new Error(`${label}: workspace crossed preview boundary`);
  if (result.submit.left < result.action.left - epsilon || result.submit.right > result.action.right + epsilon) throw new Error(`${label}: submit button escaped action panel`);
  if (result.launcher.left < result.action.left - epsilon || result.launcher.right > result.action.right + epsilon || result.launcher.top < result.footer.top - epsilon || result.launcher.bottom > result.footer.bottom + epsilon) throw new Error(`${label}: temporary chat launcher escaped action footer`);
  if (result.launcherCount !== 1 || !result.launcherInsideAction || !result.launcherInsideFooter || result.launcherInsidePreview || result.hasPreviewDock) throw new Error(`${label}: temporary chat launcher ownership is incorrect`);
  if (result.launcherText !== "? 临时问一句") throw new Error(`${label}: temporary chat launcher text changed: ${result.launcherText}`);
  if (result.launcherDisabled === launcherEnabled) throw new Error(`${label}: temporary chat launcher enabled state is incorrect`);
  if (result.overlaps) throw new Error(`${label}: submit and temporary chat buttons overlap`);
  if (result.scrollWidth > result.viewportWidth + epsilon) throw new Error(`${label}: horizontal overflow ${result.scrollWidth}/${result.viewportWidth}`);
  if (result.actionScrollWidth > result.actionClientWidth + epsilon) throw new Error(`${label}: action content has horizontal overflow`);
  if (!result.optionsSingleColumn) throw new Error(`${label}: option cards are not a single column`);
  if (await page.locator('.option-card').count()) {
    const noHorizontalOverflow = await page.locator('.option-card').evaluateAll(cards => cards.every(card => card.scrollWidth <= card.clientWidth + 1));
    if (!noHorizontalOverflow) throw new Error(`${label}: option text overflows horizontally`);
  }
  await page.locator(submitSelector).click({ trial: true });
  if (launcherEnabled) await page.locator("#dialogLauncher").click({ trial: true });
  return result;
}

await resize(1540, 960);
const normalLayout = await assertLayout("normal/options", "#submitDecision");
const hiddenProgressPosition = await page.evaluate(() => {
  const action = document.querySelector('#actionPanel');
  const progress = document.querySelector('#progressPanel');
  const before = action.getBoundingClientRect();
  progress.hidden = true;
  const hidden = action.getBoundingClientRect();
  progress.hidden = false;
  return { beforeLeft: before.left, hiddenLeft: hidden.left, beforeWidth: before.width, hiddenWidth: hidden.width };
});
if (hiddenProgressPosition.beforeLeft !== hiddenProgressPosition.hiddenLeft || hiddenProgressPosition.beforeWidth !== hiddenProgressPosition.hiddenWidth) throw new Error(`hidden progress shifted action panel: ${JSON.stringify(hiddenProgressPosition)}`);
console.log(`fixed action-panel width: ${normalLayout.action.width}px`);
console.log('Aligned panels:', { progress: normalLayout.progress, action: normalLayout.action });
console.log('Panel dimensions:', await page.evaluate(() => Object.fromEntries(['.task-rail', '.preview-column', '.action-panel'].map(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return [selector, {width:r.width,height:r.height}]; }))));
await page.screenshot({ path: path.join(screenshotDir, "normal-options.png") });
const footerBeforeScroll = await page.locator('.action-footer').boundingBox();
for (const option of task.options) {
  const copy = page.locator(`[data-option="${option.id}"] .option-copy`);
  await copy.scrollIntoViewIfNeeded();
  const accessible = await copy.evaluate((element, description) => {
    const box = element.getBoundingClientRect();
    const viewport = document.querySelector('.action-scroll').getBoundingClientRect();
    return element.textContent.includes(description) && box.top >= viewport.top - 1 && box.bottom <= viewport.bottom + 1;
  }, option.description);
  if (!accessible) throw new Error(`long description ${option.id} cannot be read within the scroll area`);
}
await page.locator('[data-note="a"]').fill('布局测试：保留完整描述，并允许补充具体要求。');
await page.locator('#freeformInput').fill('布局测试：补充自己的页面方向。');
const scrollCheck = await page.locator('.action-scroll').evaluate(element => ({ top: element.scrollTop, height: element.clientHeight, contentHeight: element.scrollHeight }));
if (scrollCheck.top <= 0 || scrollCheck.contentHeight <= scrollCheck.height) throw new Error('long options do not scroll internally');
const footerAfterScroll = await page.locator('.action-footer').boundingBox();
if (footerBeforeScroll.y !== footerAfterScroll.y || footerBeforeScroll.height !== footerAfterScroll.height) throw new Error('footer moved when option content scrolled');
await assertLayout('normal/options-scrolled', '#submitDecision');
await page.screenshot({path:path.join(screenshotDir, 'options-scrolled.png')});
await page.locator('.action-scroll').evaluate(element => { element.scrollTop = 0; });

await resize(1080, 720);
await assertLayout("narrow/options", "#submitDecision");

const railHandle = page.locator("#railResizer");
let box = await railHandle.boundingBox();
await page.mouse.move(box.x + 3, box.y + 200);
await page.mouse.down();
await page.mouse.move(box.x + 65, box.y + 200, { steps: 4 });
await page.mouse.up();
const previewHandle = page.locator("#previewResizer");
box = await previewHandle.boundingBox();
await page.mouse.move(box.x + 3, box.y + 200);
await page.mouse.down();
await page.mouse.move(box.x - 45, box.y + 200, { steps: 4 });
await page.mouse.up();
await assertLayout("narrow/resized", "#submitDecision");

await page.locator("#collapseRail").click();
await page.waitForTimeout(300);
await assertLayout("narrow/left-collapsed", "#submitDecision");
await page.locator("#restoreRail").click();
await page.waitForTimeout(300);

await page.locator("#collapsePreview").click();
await page.waitForTimeout(300);
await assertLayout("narrow/right-collapsed", "#submitDecision");
await page.locator("#restorePreview").click();
await page.waitForTimeout(300);
await assertLayout("narrow/restored", "#submitDecision");

await page.locator("#collapseRail").click();
await page.locator("#collapsePreview").click();
await page.waitForTimeout(300);
await assertLayout("narrow/both-collapsed", "#submitDecision");
await page.screenshot({path:path.join(screenshotDir, 'collapsed.png')});
await page.locator("#restoreRail").click();
await page.locator("#restorePreview").click();
await page.waitForTimeout(300);

await page.locator("#dialogLauncher").click();
await page.locator("#sendDialog").waitFor();
const temporaryLayout = await assertLayout("narrow/temporary-dialog", "#sendDialog", { launcherEnabled: false });
if (temporaryLayout.action.height >= 280) throw new Error('short temporary dialog is forced to fill the height cap');
await page.screenshot({ path: path.join(screenshotDir, "narrow-temporary-dialog.png") });
await page.locator("#cancelDialog").click();

await page.locator('[data-task-id="layout-input"]').click();
await page.locator("#submitRequirement").waitFor();
await assertLayout("narrow/initial-input", "#submitRequirement");
await page.screenshot({ path: path.join(screenshotDir, "narrow-initial-input.png") });

await page.locator('[data-task-id="layout-rating"]').click();
await assertLayout('narrow/rating', '#submitRating');
await page.locator('.stars').first().locator('button').last().click();
await assertLayout('narrow/rating-selected', '#submitRating');
await page.screenshot({path:path.join(screenshotDir, 'rating.png')});
await page.locator('[data-device="mobile"]').click();
await assertLayout('narrow/mobile-preview', '#submitRating');
await resize(1540, 960);
await resize(1080, 720);
await assertLayout('resize-after-drag', '#submitRating');

const longProgress = await page.evaluate(() => {
  const action = document.querySelector('#actionPanel');
  const progress = document.querySelector('#progressPanel');
  const before = action.getBoundingClientRect().height;
  document.querySelector('#progressActivity').textContent = '最近真实活动：正在读取并整理页面文件。'.repeat(80);
  const actionBox = action.getBoundingClientRect();
  const progressBox = progress.getBoundingClientRect();
  return {
    actionHeightBefore: before,
    actionHeightAfter: actionBox.height,
    progressHeight: progressBox.height,
    progressScrollHeight: progress.scrollHeight,
    progressClientHeight: progress.clientHeight,
  };
});
if (longProgress.actionHeightBefore !== longProgress.actionHeightAfter || longProgress.progressHeight !== longProgress.actionHeightAfter || longProgress.progressScrollHeight <= longProgress.progressClientHeight) throw new Error(`long progress content did not remain internally scrollable: ${JSON.stringify(longProgress)}`);
console.log('Long progress containment:', longProgress);
await page.screenshot({ path: path.join(screenshotDir, "long-progress-equal.png") });

await app.close();
const uniqueWidths = [...new Set(measuredWidths.map(item => item.width))];
const uniqueLauncherWidths = [...new Set(measuredLauncherWidths)];
console.log(`measured action-panel widths across ${measuredWidths.length} states: ${uniqueWidths.join(", ")}px`);
console.log(`measured temporary-chat launcher widths across ${measuredLauncherWidths.length} states: ${uniqueLauncherWidths.join(", ")}px`);
console.log("aligned action/progress measurements:", measuredWidths.filter(item => item.progress).map(item => ({
  label: item.label,
  action: { top: item.action.top, bottom: item.action.bottom, height: item.action.height },
  progress: { top: item.progress.top, bottom: item.progress.bottom, height: item.progress.height },
})));
console.log("Electron layout smoke passed: expanded, left/right/both collapsed, resized, options, temporary dialog, initial input");
await writeFile(path.join(screenshotDir, 'measurements.json'), JSON.stringify({
  fixture: 'Isolated layout data with four long descriptions; no model request',
  states: measuredWidths, scrollCheck, longProgress,
}, null, 2), 'utf8');
console.log(`Screenshots and measurements: ${screenshotDir}`);
