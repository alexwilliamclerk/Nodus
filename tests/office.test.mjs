import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import {finalizeArtifact} from '../backend/artifacts.mjs';
import {normalizeRecognizedType} from '../frontend/artifact-types.js';

test('Word output contains readable DOCX content and detects modified files on restore',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-docx-'));
  await writeFile(path.join(dir,'document.json'),JSON.stringify({title:'客户方案',blocks:[{type:'heading',level:1,text:'目标'},{type:'paragraph',text:'保留中文与 <XML> 字符'},{type:'table',rows:[['项目','值'],['人数',12]]}]}));
  const artifact=await finalizeArtifact({artifactType:'word'},dir);
  assert.equal(artifact.entry,'document.docx');
  const extracted=(await mammoth.extractRawText({path:path.join(dir,'document.docx')})).value;
  assert.match(extracted,/保留中文与 <XML> 字符/);
  assert.match(extracted,/人数/);
  await finalizeArtifact({artifactType:'word'},dir,{restore:true});
  const zip=await JSZip.loadAsync(await readFile(path.join(dir,'document.docx')));
  zip.file('word/document.xml',(await zip.file('word/document.xml').async('string')).replace('客户方案','错误标题'));
  await writeFile(path.join(dir,'document.docx'),await zip.generateAsync({type:'nodebuffer'}));
  await assert.rejects(finalizeArtifact({artifactType:'word'},dir,{restore:true}),/不一致/);
});

test('Excel output preserves numeric, Boolean and formula-like text cells',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-xlsx-'));
  await writeFile(path.join(dir,'workbook.json'),JSON.stringify({sheets:[{name:'销售',columns:['项目','数量','备注'],rows:[['A',12,'=SUM(1,2)'],['B',3.5,true]]}]}));
  const artifact=await finalizeArtifact({artifactType:'excel'},dir);
  assert.equal(artifact.entry,'workbook.xlsx');
  const zip=await JSZip.loadAsync(await readFile(path.join(dir,'workbook.xlsx')));
  const sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(sheet,/<c r="B2"><v>12<\/v><\/c>/);
  assert.match(sheet,/<c r="C2" t="inlineStr"><is><t xml:space="preserve">=SUM\(1,2\)<\/t>/);
  assert.doesNotMatch(sheet,/<f>/);
  await finalizeArtifact({artifactType:'excel'},dir,{restore:true});
  zip.file('xl/worksheets/sheet1.xml',sheet.replace('<v>12</v>','<v>99</v>'));
  await writeFile(path.join(dir,'workbook.xlsx'),await zip.generateAsync({type:'nodebuffer'}));
  await assert.rejects(finalizeArtifact({artifactType:'excel'},dir,{restore:true}),/不一致/);
});

test('common unsupported formats are recognized without becoming a website',()=>{
  for(const [input,expected] of [['docx','word'],['xlsx','excel'],['PDF','pdf'],['3D','threeD'],['video','video'],['mobile','mobile'],['unknown','other']])assert.equal(normalizeRecognizedType(input),expected);
});
