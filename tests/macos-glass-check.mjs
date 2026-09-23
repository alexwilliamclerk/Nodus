import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

assert.equal(process.platform, 'darwin', 'Run this desktop check on macOS');
const temp = await mkdtemp(path.join(os.tmpdir(), 'nodus-glass-'));
const evidence = path.resolve('test-results/macos-glass');
await mkdir(evidence, { recursive:true });
const app = await electron.launch({
  args:['.', `--user-data-dir=${path.join(temp, 'profile')}`],
  env:{ ...process.env, NODUS_DATA_DIR:path.join(temp, 'data') },
});
const errors = [];
try {
  let page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#newTaskButton').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-platform'), 'darwin');
  await page.locator('#newTaskButton').click();
  await page.locator('#requirementInput').fill('验证 macOS 玻璃分层与草稿保留');
  async function geometry() {
    const result = await page.evaluate(() => {
      const rect = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width };
      };
      return { action:rect('#actionPanel'), workspace:rect('.workspace'),
        overflow:document.documentElement.scrollWidth > innerWidth,
        title:rect('#taskTitle'), filter:getComputedStyle(document.querySelector('#actionPanel')).backdropFilter };
    });
    assert(!result.overflow);
    assert(result.action.width <= 701);
    assert(result.action.x >= result.workspace.x);
    assert(result.action.right <= result.workspace.right);
    return result;
  }
  await geometry();
  await page.screenshot({ path:path.join(evidence, 'default.png') });
  await page.locator('#togglePreview').click();
  await geometry();
  await page.screenshot({ path:path.join(evidence, 'preview.png') });
  await page.locator('#collapseRail').click();
  const collapsed = await geometry();
  assert(collapsed.title.x > 100, 'Title clears native traffic lights');
  await page.locator('#modelButton').click();
  await page.locator('#manageConnections').click();
  await page.locator('#settingsModal').waitFor();
  await page.screenshot({ path:path.join(evidence, 'settings.png') });
  await page.locator('#closeSettings').click();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 720));
  await geometry();
  await page.locator('#restoreRail').click();
  await geometry();
  await page.screenshot({ path:path.join(evidence, 'compact.png') });
  // Exercise the same native appearance message used by preference changes.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('forma:appearance', {
    platform:'darwin', reducedTransparency:true, increasedContrast:true, focused:true,
  }));
  await page.waitForFunction(() => document.documentElement.classList.contains('reduce-transparency'));
  assert.equal((await geometry()).filter, 'none');
  const previewTabsFit = await page.locator('.preview-header .text-button').evaluateAll(tabs =>
    tabs.every(tab => tab.scrollWidth <= tab.clientWidth + 1));
  assert(previewTabsFit, 'Preview tabs remain readable with increased contrast');
  await page.screenshot({ path:path.join(evidence, 'reduced-transparency.png') });
  await page.locator('#saveState').filter({ hasText:'已保存' }).waitFor();
  const bootstrap = await page.evaluate(() => window.forma.bootstrap());
  const response = await fetch(bootstrap.previewOrigin);
  assert.equal(response.status, 404, 'Preview server is available');
  assert.deepEqual(errors, []);
  console.log(`macOS glass checks passed: ${evidence}`);
} finally {
  await app.close();
}
