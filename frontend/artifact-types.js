// Shared protocol catalogue: projectId groups tasks; artifactType selects a delivery contract.
export const artifactTypes = Object.freeze({
  website: { label:'网站／网页', entry:'index.html', preview:'website', dimensions:['需求符合度','视觉表现','信息清晰度','交互可用性'], protocol:'生成可独立运行的 index.html 及其本地 CSS/JS/图片资源。禁止依赖远程 CDN 或构建步骤；所有本地引用必须存在。' },
  report: { label:'调研报告', entry:'report.md', preview:'document', dimensions:['需求符合度','论证清晰度','来源透明度','结论实用性'], protocol:'生成 report.md（Markdown，必须有 # 标题和 ## 摘要、## 事实与来源、## 假设、## 待验证、## 结论）及 sources.json（数组，每项 {claim,source,status:"unverified"}）。本应用没有联网核实工具，所有外部来源必须标为未核实，不得称已核实；区分用户提供材料与推测。不可虚构引用。' },
  presentation: { label:'PPT／演示文稿', entry:'presentation.pptx', preview:'slides', dimensions:['需求符合度','叙事结构','页面可读性','内容准确性'], protocol:'写 slides.json，格式 {title:"标题",slides:[{title:"页标题",bullets:["要点"],notes:"演讲备注"}]}，1 至 80 页，每页 1 至 8 个要点，每个要点不超过 160 字。应用会用可信 PPTX 编译器生成真正的 presentation.pptx 和同源幻灯片预览。不要写生成器代码，不要用 HTML 冒充 PPTX。当前支持标题、文字要点与备注；不支持用户自定义布局或媒体。' },
  python: { label:'Python 脚本／工程', entry:'README.md', preview:'code', dimensions:['需求符合度','代码清晰度','运行说明','可维护性'], protocol:'写实际 .py 源文件、requirements.txt（无依赖可为空）及 README.md（含 ## 运行、## 依赖、## 限制）。应用只在可用本机 Python 中执行固定的 ast.parse 语法检查，不安装依赖、不执行你生成的代码。禁止声称运行或测试通过。' },
  analysis: { label:'数据分析', entry:'analysis.md', preview:'analysis', dimensions:['需求符合度','数据可追溯性','方法透明度','结果可读性'], protocol:'目前仅支持用户上传 CSV 或 JSON 记录数组的描述统计。inputs/ 为用户输入，results.json 是应用可信统计器计算的行数、数值列 count/min/max/mean，不得修改或编造。生成分析思路的 .py 文件、requirements.txt 和 README.md（## 运行、## 依赖、## 限制），以及 analysis.md（## 输入、## 方法、## 结果、## 限制）。分析代码不执行；最终数值结果和对应关系由应用生成。需要回归、预测、联网或其他分析方法时先澄清当前能力范围。' },
});
export function typeInfo(type) { return Object.hasOwn(artifactTypes,type) ? artifactTypes[type] : null; }
// Machine-readable output contracts consumed by finalizers and manifest readers.
export const artifactRequirements = Object.freeze({
  website: { files:['index.html'], sections:{} },
  report: { files:['report.md','sources.json'], sections:{'report.md':['摘要','事实与来源','假设','待验证','结论']} },
  presentation: { files:['slides.json','presentation.pptx'], sections:{} },
  python: { files:['README.md','requirements.txt'], sections:{'README.md':['运行','依赖','限制']} },
  analysis: { files:['analysis.md','results.json','reproduce.py','README.md','requirements.txt'], sections:{'analysis.md':['输入','方法','结果','限制'],'README.md':['运行','依赖','限制']} },
});
export function legacyArtifact() { return { schemaVersion:1, type:'website', entry:'index.html', files:[], preview:{kind:'website',entry:'index.html'}, verification:{status:'historical',note:'历史版本，尚未按新版协议重新验证'} }; }
