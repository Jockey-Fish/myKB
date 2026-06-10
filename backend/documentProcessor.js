const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { marked } = require('marked');

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  try {
    switch (ext) {
      case '.pdf': {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        return pdfData.text;
      }
      case '.txt': {
        return fs.readFileSync(filePath, 'utf-8');
      }
      case '.md': {
        const content = fs.readFileSync(filePath, 'utf-8');
        const html = marked(content);
        return html.replace(/<[^>]*>/g, ' ').trim();
      }
      default: {
        return fs.readFileSync(filePath, 'utf-8');
      }
    }
  } catch (error) {
    console.error('Error extracting text:', error);
    throw new Error('无法提取文件内容');
  }
}

function splitIntoChunks(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.substring(start, end);
    
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const splitPoint = Math.max(lastPeriod, lastNewline);
      
      if (splitPoint > chunkSize / 2) {
        chunk = text.substring(start, start + splitPoint + 1);
        start = start + splitPoint + 1 - overlap;
      } else {
        start = end - overlap;
      }
    } else {
      start = end;
    }
    
    chunk = chunk.trim();
    if (chunk.length > 50) {
      chunks.push({
        content: chunk,
        start: start,
        end: start + chunk.length
      });
    }
  }
  
  return chunks;
}

module.exports = {
  extractTextFromFile,
  splitIntoChunks,
  CHUNK_SIZE,
  CHUNK_OVERLAP
};