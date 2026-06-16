const fs = require('fs');
const path = require('path');

class TextSplitter {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 500;
    this.chunkOverlap = options.chunkOverlap || 50;
    this.separators = options.separators || [
      '\n\n',
      '\n',
      '。',
      '！',
      '？',
      '；',
      '：',
      '，',
      '、',
      ' ',
      ''
    ];
  }

  splitText(text) {
    const chunks = [];
    let currentPosition = 0;
    let chunkId = 0;
    let maxIterations = Math.ceil(text.length / (this.chunkSize - this.chunkOverlap)) + 100;
    let iterations = 0;

    text = this._cleanText(text);

    while (currentPosition < text.length && iterations < maxIterations) {
      iterations++;
      let endPosition = Math.min(currentPosition + this.chunkSize, text.length);
      let chunk = text.substring(currentPosition, endPosition);

      if (endPosition < text.length) {
        const nextChunk = text.substring(endPosition, endPosition + this.chunkSize);
        const bestSplitPoint = this._findBestSplitPoint(chunk, nextChunk);
        endPosition = currentPosition + bestSplitPoint;
        chunk = text.substring(currentPosition, endPosition);
      }

      if (chunk.trim()) {
        chunks.push({
          id: `chunk_${chunkId++}`,
          text: chunk.trim(),
          startPosition: currentPosition,
          endPosition: endPosition,
          length: chunk.length
        });
      }

      // 确保至少前进一定距离，防止无限循环
      const nextPosition = endPosition - this.chunkOverlap;
      currentPosition = Math.max(nextPosition, currentPosition + 1);
      if (currentPosition < 0) currentPosition = 0;
    }

    return chunks;
  }

  _cleanText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _findBestSplitPoint(chunk, nextChunk) {
    const fullText = chunk + nextChunk;

    for (const separator of this.separators) {
      const index = fullText.lastIndexOf(separator, this.chunkSize);
      if (index > this.chunkSize - 100 && index > 0) {
        return index + separator.length;
      }
    }

    return this.chunkSize;
  }

  splitTextByParagraphs(text) {
    const chunks = [];
    let chunkId = 0;
    let currentPosition = 0;

    text = this._cleanText(text);
    const paragraphs = text.split(/[\n\n]+/);

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) continue;

      if (trimmedParagraph.length <= this.chunkSize) {
        chunks.push({
          id: `chunk_${chunkId++}`,
          text: trimmedParagraph,
          startPosition: currentPosition,
          endPosition: currentPosition + trimmedParagraph.length,
          length: trimmedParagraph.length
        });
      } else {
        const subChunks = this.splitText(trimmedParagraph);
        for (const subChunk of subChunks) {
          chunks.push({
            ...subChunk,
            id: `chunk_${chunkId++}`,
            startPosition: currentPosition + subChunk.startPosition,
            endPosition: currentPosition + subChunk.endPosition
          });
        }
      }

      currentPosition += trimmedParagraph.length + 2;
    }

    return chunks;
  }

  async splitFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.splitTextByParagraphs(content);
  }
}

module.exports = TextSplitter;
