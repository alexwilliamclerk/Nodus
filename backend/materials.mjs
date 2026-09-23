import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';

const imageTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const textLimit = 128 * 1024;

// Parsing stays local. A successful text extraction does not imply document layout or images were read.
export async function readMaterial(file) {
  try {
    if ((await stat(file)).size > 20 * 1024 * 1024) return { name:path.basename(file), status:'unsupported', message:'文件超过 20 MB，请选取相关部分后添加。' };
    return readMaterialBytes(path.basename(file), await readFile(file));
  } catch (error) { return { name:path.basename(file), status:'unsupported', message:`读取失败：${error.message}` }; }
}

export async function readMaterialBytes(file, bytes) {
  const name = path.basename(file), ext = path.extname(file).toLowerCase();
  try {
    const buffer = Buffer.from(bytes);
    const size = buffer.length;
    if (size > 20 * 1024 * 1024) return { name, status: 'unsupported', message: '文件超过 20 MB，请选取相关部分后添加。' };
    if (imageTypes[ext]) return { name, status: 'image', mimeType: imageTypes[ext], data: buffer.toString('base64'), message: '图片已保存；仅支持视觉的模型能读取。' };
    let text, message = '已读取文字；点击移除';
    if (/^\.(txt|md|markdown|csv|json|html|css|js|ts|xml|ya?ml)$/.test(ext)) text = buffer.toString('utf8');
    else if (ext === '.docx') {
      text = (await mammoth.extractRawText({ buffer })).value;
      message = '已提取 Word 文字；未读取内嵌图片或保留版式。点击移除';
    } else if (ext === '.pdf') {
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const loading = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
      try {
        const pdf = await loading.promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join(''));
        }
        text = pages.join('\n\n');
      } finally { await loading.destroy(); }
      message = '已提取 PDF 文字；未读取扫描页、内嵌图片或保留版式。点击移除';
    } else return { name, status: 'unsupported', message: '此格式尚不支持；请转换为文本、PDF、DOCX 或 PNG/JPEG/WebP。' };
    if (!text.trim()) return { name, status: 'unsupported', message: '没有提取到文字；空文档或扫描件请转为文字，或添加图片并选择视觉模型。' };
    if (Buffer.byteLength(text, 'utf8') > textLimit) return { name, status: 'unsupported', message: '提取文字超过 128 KB，请选取相关部分后添加；未发送截断内容。' };
    return { name, status: 'read', text, message };
  } catch (error) {
    return { name, status: 'unsupported', message: error.name === 'PasswordException' ? 'PDF 已加密，请解锁后重新添加。' : `读取失败：${error.message}` };
  }
}

export function taskImages(task, model) {
  const files = (task.attachments || []).filter(item => item.status === 'image');
  if (files.length && !model?.input?.includes('image')) throw new Error('当前模型不支持图片理解。请连接支持视觉的模型，或移除图片后继续；图片尚未发送。');
  return files.map(({ data, mimeType }) => ({ type: 'image', data, mimeType }));
}
