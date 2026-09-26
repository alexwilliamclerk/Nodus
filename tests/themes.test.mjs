import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scenicThemes,isTheme,normalizeTheme,nativeThemeFor} from '../frontend/themes.js';
import {existsSync} from 'node:fs';
test('theme ids map to supported native appearance and bundled images',()=>{
  assert.equal(new Set(scenicThemes.map(t=>t.id)).size,4);
  for(const theme of scenicThemes){
    assert.ok(isTheme(theme.id));assert.ok(['light','dark'].includes(nativeThemeFor(theme.id)));
    assert.ok(existsSync(new URL('../frontend/theme-assets/'+theme.id+'.png',import.meta.url)));
  }
  assert.equal(nativeThemeFor('moonlit-peaks'),'dark');
  assert.equal(nativeThemeFor('system'),'system');
  assert.equal(normalizeTheme('invalid'),'light');assert.equal(isTheme('__proto__'),false);
});
