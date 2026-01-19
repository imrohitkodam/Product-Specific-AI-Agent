
import JSZip from "jszip";
import { Document } from "../types";

const pdfjsLib = window['pdfjs-dist/build/pdf'];
if (pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export async function processFile(file: File | Blob, fileNameOverride?: string): Promise<Partial<Document> | Partial<Document>[]> {
  const fileName = fileNameOverride || (file instanceof File ? file.name : 'unknown_file');
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension === 'zip') {
    return processZip(file);
  }

  if (extension === 'pdf') {
    return processPDF(file);
  }

  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension || '')) {
    return processImage(file, fileName);
  }

  // Handle source files and config
  const textExtensions = ['php', 'xml', 'ini', 'json', 'txt', 'md', 'js', 'css'];
  if (extension && textExtensions.includes(extension)) {
    return await processText(file, fileName);
  }

  // Generic fallback
  try {
    return await processText(file, fileName);
  } catch (err) {
    return { status: 'error' };
  }
}

async function processImage(file: File | Blob, path: string): Promise<Partial<Document>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1];
      resolve({
        content: base64Data, // Store raw base64 for images
        path,
        type: file.type || 'image/png',
        status: 'ready',
        moduleName: 'Visual Feedback'
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processText(file: File | Blob, path: string): Promise<Partial<Document>> {
  const content = await file.text();
  const isJoomlaManifest = path.endsWith('.xml') && (content.includes('<extension') || content.includes('<install'));

  let moduleName = 'General';
  if (isJoomlaManifest) {
    const nameMatch = content.match(/<name>(.*?)<\/name>/);
    if (nameMatch) moduleName = nameMatch[1];
  }

  // Determine category based on extension
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const codeExtensions = ['php', 'js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'json', 'xml', 'ini', 'html', 'vue', 'py'];
  const category: 'code' | 'docs' = codeExtensions.includes(ext) ? 'code' : 'docs';

  return {
    content,
    path,
    type: file.type || 'text/plain',
    isJoomlaManifest,
    moduleName,
    category,
    status: 'ready'
  };
}

async function processPDF(file: File | Blob): Promise<Partial<Document>> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += `[PAGE ${i}] ${pageText}\n\n`;
  }
  return { content: fullText, type: 'application/pdf', status: 'ready' };
}

async function processZip(file: File | Blob): Promise<Partial<Document>[]> {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  const processedDocs: Partial<Document>[] = [];

  for (const [relativePath, zipEntry] of Object.entries(content.files)) {
    if ((zipEntry as any).dir) continue;
    try {
      const blob = await (zipEntry as any).async("blob");
      const result = await processFile(blob, relativePath);
      if (Array.isArray(result)) {
        processedDocs.push(...result);
      } else {
        processedDocs.push({ ...result, name: relativePath, path: relativePath });
      }
    } catch (err) {
      console.warn(`Skipping: ${relativePath}`, err);
    }
  }
  return processedDocs;
}
