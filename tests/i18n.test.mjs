import test from 'node:test';
import assert from 'node:assert/strict';
import {translateUiText} from '../frontend/i18n.js';
import {applicationMenu} from '../electron/application-menu.mjs';

test('interface labels translate without changing arbitrary task content',()=>{
  assert.equal(translateUiText('新对话','en-US'),'New chat');
  assert.equal(translateUiText('评价 V2 · 这版符合你的期待吗？','en-US'),'Review V2 · Does this version meet your expectations?');
  assert.equal(translateUiText('用户写的中文内容','en-US'),'用户写的中文内容');
  assert.equal(translateUiText('新对话','zh-CN'),'新对话');
});

test('native menu uses the selected language while preserving command ids',()=>{
  const zh=applicationMenu('win32',()=>{});
  const en=applicationMenu('win32',()=>{},'en-US');
  assert.equal(zh.find(item=>item.label==='文件').submenu[0].id,'new-task');
  assert.equal(en.find(item=>item.label==='File').submenu[0].label,'New chat');
  assert.equal(en.find(item=>item.label==='File').submenu[0].id,'new-task');
});
