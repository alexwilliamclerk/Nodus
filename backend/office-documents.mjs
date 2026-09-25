import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import {XMLValidator} from 'fast-xml-parser';

const xml=value=>String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const stringify=value=>JSON.stringify(value);
const text=value=>typeof value==='string'&&value.trim()&&value.length<=10000;
const archive=()=>new JSZip();
const add=(zip,name,content)=>zip.file(name,content,{date:new Date('1980-01-01T00:00:00Z')});
const rels=items=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id,type,target])=>`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${xml(target)}"/>`).join('')}</Relationships>`;

export function validateDocumentSource(source){
  if(!source||typeof source!=='object'||!text(source.title)||!Array.isArray(source.blocks)||!source.blocks.length||source.blocks.length>300)throw new Error('Word 文档需要标题及 1–300 个正文块');
  for(const block of source.blocks){
    if(block?.type==='heading'){if(!text(block.text)||![1,2,3].includes(block.level))throw new Error('Word 标题无效');}
    else if(block?.type==='paragraph'){if(!text(block.text))throw new Error('Word 段落为空或过长');}
    else if(block?.type==='table'){
      if(!Array.isArray(block.rows)||!block.rows.length||block.rows.length>100||!Array.isArray(block.rows[0])||!block.rows[0].length||block.rows[0].length>20)throw new Error('Word 表格尺寸无效');
      const width=block.rows[0].length;
      if(block.rows.some(row=>!Array.isArray(row)||row.length!==width||row.some(cell=>typeof cell!=='string'&&typeof cell!=='number'||String(cell).length>2000)))throw new Error('Word 表格单元格无效');
    }else throw new Error('Word 正文块类型不支持');
  }
  if(Buffer.byteLength(stringify(source))>1024*1024)throw new Error('Word 文档内容过大');
  return source;
}
const wordText=value=>`<w:r><w:t xml:space="preserve">${xml(value)}</w:t></w:r>`;
const paragraph=(value,style)=>`<w:p>${style?`<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`:''}${wordText(value)}</w:p>`;
export function documentXml(source){
  validateDocumentSource(source);
  const blocks=[paragraph(source.title,'Title'),...source.blocks.map(block=>{
    if(block.type==='heading')return paragraph(block.text,`Heading${block.level}`);
    if(block.type==='paragraph')return paragraph(block.text);
    return `<w:tbl>${block.rows.map(row=>`<w:tr>${row.map(cell=>`<w:tc>${paragraph(String(cell))}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
  })].join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${blocks}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
}
const wordStyles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>${[1,2,3].map((level)=>`<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:rPr><w:b/><w:sz w:val="${36-level*4}"/></w:rPr></w:style>`).join('')}</w:styles>`;
function docxZip(source){
  const zip=archive();
  add(zip,'[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  add(zip,'_rels/.rels',rels([['rId1','officeDocument','word/document.xml']]));
  add(zip,'word/document.xml',documentXml(source));
  add(zip,'word/styles.xml',wordStyles);
  add(zip,'word/_rels/document.xml.rels',rels([['rId1','styles','styles.xml']]));
  return zip;
}

const sheetName=name=>typeof name==='string'&&name.trim()&&name.length<=31&&!/[:\\/?*\[\]]/.test(name);
const cellValue=value=>value===null||value===undefined||typeof value==='string'&&value.length<=10000||typeof value==='number'&&Number.isFinite(value)||typeof value==='boolean';
export function validateWorkbookSource(source){
  if(!source||typeof source!=='object'||!Array.isArray(source.sheets)||!source.sheets.length||source.sheets.length>20)throw new Error('Excel 工作簿需要 1–20 张工作表');
  const names=new Set();
  for(const sheet of source.sheets){
    if(!sheetName(sheet?.name)||names.has(sheet.name.toLowerCase()))throw new Error('Excel 工作表名称无效或重复');names.add(sheet.name.toLowerCase());
    if(!Array.isArray(sheet.rows)||!sheet.rows.length||sheet.rows.length>10000||sheet.rows.some(row=>!Array.isArray(row)||row.length>100||row.some(value=>!cellValue(value))))throw new Error('Excel 行或单元格无效');
    if(sheet.columns!==undefined&&(!Array.isArray(sheet.columns)||sheet.columns.length>100||sheet.columns.some(value=>!text(value))))throw new Error('Excel 列标题无效');
  }
  if(Buffer.byteLength(stringify(source))>4*1024*1024)throw new Error('Excel 工作簿内容过大');
  return source;
}
const column=index=>{let result='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;};
function cell(value,reference){
  if(value===null||value===undefined)return '';
  if(typeof value==='number')return `<c r="${reference}"><v>${value}</v></c>`;
  if(typeof value==='boolean')return `<c r="${reference}" t="b"><v>${value?1:0}</v></c>`;
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}
export function worksheetXml(sheet){
  const rows=[...(sheet.columns?.length?[sheet.columns]:[]),...sheet.rows];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row,index)=>`<row r="${index+1}">${row.map((value,col)=>cell(value,`${column(col)}${index+1}`)).join('')}</row>`).join('')}</sheetData></worksheet>`;
}
function xlsxZip(source){
  validateWorkbookSource(source);const zip=archive();
  add(zip,'[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${source.sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  add(zip,'_rels/.rels',rels([['rId1','officeDocument','xl/workbook.xml']]));
  add(zip,'xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${source.sheets.map((sheet,i)=>`<sheet name="${xml(sheet.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);
  add(zip,'xl/_rels/workbook.xml.rels',rels(source.sheets.map((_,i)=>[`rId${i+1}`,'worksheet',`worksheets/sheet${i+1}.xml`])));
  source.sheets.forEach((sheet,i)=>add(zip,`xl/worksheets/sheet${i+1}.xml`,worksheetXml(sheet)));
  return zip;
}
async function checkZip(file,expected){
  const zip=await JSZip.loadAsync(await readFile(file));
  for(const [name,content] of Object.entries(expected)){
    const part=zip.file(name);if(!part)throw new Error(`Office 文件缺少 ${name}`);
    const actual=await part.async('string');
    if(XMLValidator.validate(actual)!==true||actual!==content)throw new Error(`Office 文件内容与源数据不一致：${name}`);
  }
}
export async function finalizeDocx(dir,{restore=false}={}){
  const source=validateDocumentSource(JSON.parse(await readFile(path.join(dir,'document.json'),'utf8')));
  const file=path.join(dir,'document.docx');
  if(!restore)await writeFile(file,await docxZip(source).generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
  await checkZip(file,{'word/document.xml':documentXml(source),'word/styles.xml':wordStyles});
  return {source,checks:{docx:'parsed',blocks:source.blocks.length,contents:'与 document.json 对应',office:'未通过 Word 实机打开验证'}};
}
export async function finalizeXlsx(dir,{restore=false}={}){
  const source=validateWorkbookSource(JSON.parse(await readFile(path.join(dir,'workbook.json'),'utf8')));
  const file=path.join(dir,'workbook.xlsx');
  if(!restore)await writeFile(file,await xlsxZip(source).generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
  await checkZip(file,Object.fromEntries(source.sheets.map((sheet,i)=>[`xl/worksheets/sheet${i+1}.xml`,worksheetXml(sheet)])));
  return {source,checks:{xlsx:'parsed',sheets:source.sheets.length,contents:'与 workbook.json 对应',office:'未通过 Excel 实机打开验证'}};
}
