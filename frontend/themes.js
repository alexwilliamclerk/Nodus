export const scenicThemes = [
  {id:'lavender-dawn',name:'紫岚晨光',native:'light'},
  {id:'moonlit-peaks',name:'星河夜阑',native:'dark'},
  {id:'peach-mist',name:'桃源晨雾',native:'light'},
  {id:'bamboo-pavilion',name:'竹影云亭',native:'light'},
];
export const isTheme = value => ['light','dark','system',...scenicThemes.map(t=>t.id)].includes(value);
export const normalizeTheme = value => isTheme(value) ? value : 'light';
export const nativeThemeFor = value => scenicThemes.find(t=>t.id===value)?.native || normalizeTheme(value);
