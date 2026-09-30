import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export const extractTextFromFile = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  let text: string;

  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else if (extension === 'pdf') {
    text = await extractTextFromPdf(file);
  } else if (extension === 'txt' || extension === 'md') {
    text = await file.text();
  } else {
    throw new Error('Unsupported file format. Upload a PDF, DOCX, TXT or MD file.');
  }

  text = text.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) throw new Error('No text found in this file. If it is a scanned PDF, paste the text instead.');
  return text;
};

const extractTextFromPdf = async (file: File): Promise<string> => {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Rebuild line breaks from the y-position of each text run so bullets survive.
    let lastY: number | null = null;
    let out = '';
    for (const item of content.items as any[]) {
      if (!('str' in item)) continue;
      const y = item.transform?.[5];
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) out += '\n';
      else if (out && !out.endsWith(' ') && item.str && !item.str.startsWith(' ')) out += ' ';
      out += item.str;
      if (item.hasEOL) out += '\n';
      lastY = y ?? lastY;
    }
    pages.push(out);
  }

  return pages.join('\n\n');
};
