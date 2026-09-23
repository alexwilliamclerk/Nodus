import test from 'node:test';
import assert from 'node:assert/strict';
import { readMaterial, readMaterialBytes, taskImages } from '../backend/materials.mjs';
import { readFile } from 'node:fs/promises';
import { PiService } from '../backend/pi-service.mjs';
import path from 'node:path';
const fixture = name => path.join(import.meta.dirname, 'fixtures', 'materials', name);
test('transferred files use the same parser as selected files without a filesystem path', async () => {
  for (const name of ['brief.docx','brief.pdf','plain.txt','broken.docx']) {
    assert.deepEqual(await readMaterialBytes(name,new Uint8Array(await readFile(fixture(name)))),await readMaterial(fixture(name)));
  }
  const csv=await readMaterialBytes('data.csv',Buffer.from('name,value\nA,12'));
  assert.equal(csv.status,'read');assert.match(csv.text,/A,12/);
  assert.equal((await readMaterialBytes('large.txt',Buffer.alloc(20*1024*1024+1))).status,'unsupported');
});
test('local PDF and Word extraction retains known material content and distinguishes unreadable files', async () => {
  const doc = await readMaterial(fixture('brief.docx'));
  assert.equal(doc.status, 'read');assert.match(doc.text, /梅杉精密/);
  const pdf = await readMaterial(fixture('brief.pdf'));
  assert.equal(pdf.status, 'read', pdf.message);assert.match(pdf.text, /PEACH-472/);
  assert.equal((await readMaterial(fixture('empty.pdf'))).status, 'unsupported');
  assert.equal((await readMaterial(fixture('broken.docx'))).status, 'unsupported');
  assert.equal((await readMaterial(fixture('plain.txt'))).text, '本地材料测试');
});
test('image payloads reach Pi request and text-only models cannot silently ignore them', async () => {
  const material = await readMaterial(path.join(import.meta.dirname, '..', 'docs', 'design', 'nodus-peach-approved.png'));
  assert.equal(material.status, 'image');
  const task = { id: 'material-test', requirement: '查看参考图', attachments: [material] };
  assert.throws(() => taskImages(task, { input: ['text'] }), /不支持图片/);
  const service = new PiService({ piDir: '.', emit() {} });
  service.model = { input: ['text','image'] };
  let request;
  service.runText = async args => { request = args; return 'reply'; };
  await service.oneShotChat(task, '说明图片');
  assert.equal(request.images[0].mimeType, 'image/png');assert.equal(request.images[0].data, material.data);
});
