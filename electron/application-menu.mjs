import {translateUiText} from '../frontend/i18n.js';

export function applicationMenu(platform,send,language='zh-CN'){
  const action=(id,label,accelerator)=>({id,label:translateUiText(label,language),accelerator,click:()=>send(id)});
  const menu=[
    ...(platform==='darwin'?[{label:'Nodus',submenu:[{role:'about',label:'关于 Nodus'},action('settings','设置…','CmdOrCtrl+,'),{type:'separator'},{role:'hide',label:'隐藏 Nodus'},{role:'hideOthers',label:'隐藏其他应用'},{role:'unhide',label:'显示全部'},{type:'separator'},{role:'quit',label:'退出 Nodus'}]}]:[]),
    {label:'文件',submenu:[
      action('new-task','新建对话','CmdOrCtrl+N'),
      action('open-task','打开已有对话…','CmdOrCtrl+Shift+O'),
      action('open-material','打开文件作为材料…','CmdOrCtrl+O'),
      action('export-work','导出当前作品…'),
      action('open-work-directory','打开作品目录'),
      {type:'separator'},action('save-task','保存对话','CmdOrCtrl+S'),
      action('export-backup','备份对话并导出…','CmdOrCtrl+Shift+S'),
      {type:'separator'},{role:'close',label:'关闭窗口'},
      ...(platform==='darwin'?[]:[{role:'quit',label:'退出 Nodus'}]),
    ]},
    {label:'编辑',submenu:[{role:'undo',label:'撤销'},{role:'redo',label:'重做'},{type:'separator'},{role:'cut',label:'剪切'},{role:'copy',label:'复制'},{role:'paste',label:'粘贴'},{role:'selectAll',label:'全选'}]},
    {label:'视图',submenu:[action('preview','显示／隐藏预览'),{role:'resetZoom',label:'实际大小'},{role:'zoomIn',label:'放大'},{role:'zoomOut',label:'缩小'},{role:'togglefullscreen',label:'切换全屏'}]},
    {label:'窗口',submenu:[{role:'minimize',label:'最小化'},{role:'zoom',label:'缩放窗口'},...(platform==='darwin'?[{role:'front',label:'全部置于前面'}]:[])]},
    ...(platform==='darwin'?[]:[{label:'设置',submenu:[action('settings','模型与应用设置…','CmdOrCtrl+,')]}]),
  ];
  const localize=items=>items.map(item=>({...item,...(item.label?{label:translateUiText(item.label,language)}:{}),...(item.submenu?{submenu:localize(item.submenu)}:{})}));
  return localize(menu);
}
