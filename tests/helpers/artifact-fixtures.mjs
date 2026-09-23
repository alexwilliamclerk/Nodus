import { writeFile } from 'node:fs/promises';
import path from 'node:path';
export function interviewFixture(){return {schemaVersion:2,hypothesis:'初步判断：信息层次可能需要调整',preserve:'事实与来源保持',questions:Array.from({length:8},(_,i)=>({id:`q${i+1}`,question:`第 ${i+1} 项如何调整？`,options:['a','b','c','d'].map(id=>({id,title:`方向 ${id}`,description:`调整第 ${i+1} 项的 ${id} 部分`,effect:'更清晰',tradeoff:'需要取舍',condition:'适合当前需求'}))}))};}
export async function fixture(type,dir,label='V1') {
  const write=(name,value)=>writeFile(path.join(dir,name),value);
  if(type==='website') { await write('index.html',`<!doctype html><html><head><link href="styles.css" rel="stylesheet"></head><body>${label}<script src="app.js"></script></body></html>`); await write('styles.css','body {color: black}');await write('app.js','document.body.dataset.ready="true"'); }
  if(type==='report') { await write('report.md',`# AI 行业调研 ${label}\n## 摘要\n讨论产业结构\n## 事实与来源\n用户材料尚未提供；以下为待验证信息\n## 假设\n需求继续增长\n## 待验证\n市场规模和引用未核实\n## 结论\n需要进一步收集数据`);await write('sources.json',JSON.stringify([{claim:'市场增长假设',source:'待用户提供',status:'unverified'}])); }
  if(type==='presentation') await write('slides.json',JSON.stringify({title:`季度复盘 ${label}`,slides:[{title:`季度总结 ${label}`,bullets:['成果待补充','问题与下一步'],notes:'需要实际季度数据'},{title:'行动计划',bullets:['确认负责人','确定时间表']}]}));
  if(type==='python'||type==='analysis') {await write('main.py',`# ${label}\nimport csv\ndef clean(rows):\n    return [row for row in rows if any(row.values())]\n`);await write('requirements.txt','');await write('README.md',`# 工程 ${label}\n## 运行\npython main.py；分析复现运行 python reproduce.py\n## 依赖\nPython 3 标准库\n## 限制\n未执行模型代码；未安装依赖`);}
  if(type==='analysis')await write('analysis.md',`# 分析 ${label}\n## 输入\n用户材料\n## 方法\n描述统计\n## 结果\n参见可信结果\n## 限制\n不支持因果推断`);
}
