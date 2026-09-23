import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

assert.equal(process.platform, 'darwin', 'Run this packaged check on macOS');
const root = process.cwd();
const executablePath = path.join(root, 'dist', 'mac-arm64', 'Nodus.app', 'Contents', 'MacOS', 'Nodus');
const data = await mkdtemp(path.join(os.tmpdir(), 'nodus-packaged-'));
const launch = () => electron.launch({ executablePath, env:{ ...process.env, NODUS_DATA_DIR:data } });

let app = await launch();
try {
  let page = await app.firstWindow();
  await page.locator('#requirementInput').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-platform'), 'darwin');
  assert.match(await page.locator('#accountModelStatus').innerText(), /尚未连接/);
  const appearance = await page.evaluate(() => window.forma.getAppearance());
  assert.equal(appearance.platform, 'darwin');
  const material = await page.locator('#actionPanel').evaluate(element => getComputedStyle(element).backdropFilter);
  assert.match(material, /blur/);
  await page.locator('#requirementInput').fill('打包版 macOS 持久化检查');
  await page.locator('#saveState').filter({ hasText:'已保存' }).waitFor();
  await app.close();

  app = await launch();
  page = await app.firstWindow();
  await page.locator('#requirementInput').waitFor();
  assert.equal(await page.locator('#requirementInput').inputValue(), '打包版 macOS 持久化检查');
  const state = JSON.parse(await readFile(path.join(data, 'state.json'), 'utf8'));
  assert(state.tasks.some(task => task.requirement === '打包版 macOS 持久化检查'));
  console.log(JSON.stringify({ passed:true, executablePath, data }));
} finally {
  await app.close();
}
