const fs = require("fs");
const path = require("path");

class TextSplitter {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 500;
    this.chunkOverlap = options.chunkOverlap || 50;
    this.minChunkSize = options.minChunkSize || 100;
    this.maxChunkSize = options.maxChunkSize || 1500;
    this.separators = options.separators || [
      "\n\n",
      "\n",
      "。",
      "！",
      "？",
      "；",
      "：",
      "，",
      "、",
      " ",
      "",
    ];
  }

  splitText(text) {
    const chunks = [];
    let currentPosition = 0;
    let chunkId = 0;
    let maxIterations =
      Math.ceil(text.length / (this.chunkSize - this.chunkOverlap)) + 100;
    let iterations = 0;

    text = this._cleanText(text);

    while (currentPosition < text.length && iterations < maxIterations) {
      iterations++;
      let endPosition = Math.min(currentPosition + this.chunkSize, text.length);
      let chunk = text.substring(currentPosition, endPosition);

      if (endPosition < text.length) {
        const nextChunk = text.substring(
          endPosition,
          endPosition + this.chunkSize,
        );
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
          length: chunk.length,
        });
      }

      const nextPosition = endPosition - this.chunkOverlap;
      currentPosition = Math.max(nextPosition, currentPosition + 1);
      if (currentPosition < 0) currentPosition = 0;
    }

    // 如果最后一个chunk太短，合并到前一个chunk
    if (chunks.length >= 2) {
      const lastChunk = chunks[chunks.length - 1];
      if (lastChunk.length < this.minChunkSize) {
        const prevChunk = chunks[chunks.length - 2];
        prevChunk.text = prevChunk.text + " " + lastChunk.text;
        prevChunk.endPosition = lastChunk.endPosition;
        prevChunk.length = prevChunk.text.length;
        chunks.pop();
      }
    }

    return chunks;
  }

  _cleanText(text) {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\s+/g, " ")
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

    let currentChunk = "";
    let currentChunkStart = 0;

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) continue;

      if (trimmedParagraph.length > this.maxChunkSize) {
        const subChunks = this._splitLongParagraph(
          trimmedParagraph,
          currentPosition,
        );
        for (const subChunk of subChunks) {
          if (
            currentChunk &&
            currentChunk.length + subChunk.text.length + 2 <= this.chunkSize
          ) {
            currentChunk += "\n\n" + subChunk.text;
          } else {
            if (currentChunk) {
              chunks.push({
                id: `chunk_${chunkId++}`,
                text: currentChunk.trim(),
                startPosition: currentChunkStart,
                endPosition: currentChunkStart + currentChunk.length,
                length: currentChunk.length,
              });
            }
            currentChunk = subChunk.text;
            currentChunkStart = subChunk.startPosition;
          }
        }
      } else {
        if (
          currentChunk &&
          currentChunk.length + trimmedParagraph.length + 2 <= this.chunkSize
        ) {
          currentChunk += "\n\n" + trimmedParagraph;
        } else {
          if (currentChunk) {
            chunks.push({
              id: `chunk_${chunkId++}`,
              text: currentChunk.trim(),
              startPosition: currentChunkStart,
              endPosition: currentChunkStart + currentChunk.length,
              length: currentChunk.length,
            });
          }
          currentChunk = trimmedParagraph;
          currentChunkStart = currentPosition;
        }
      }

      currentPosition += trimmedParagraph.length + 2;
    }

    if (currentChunk) {
      chunks.push({
        id: `chunk_${chunkId++}`,
        text: currentChunk.trim(),
        startPosition: currentChunkStart,
        endPosition: currentChunkStart + currentChunk.length,
        length: currentChunk.length,
      });
    }

    if (chunks.length >= 2) {
      const lastChunk = chunks[chunks.length - 1];
      if (lastChunk.length < this.minChunkSize) {
        const prevChunk = chunks[chunks.length - 2];
        prevChunk.text = prevChunk.text + "\n\n" + lastChunk.text;
        prevChunk.endPosition = lastChunk.endPosition;
        prevChunk.length = prevChunk.text.length;
        chunks.pop();
      }
    }

    return chunks;
  }

  _splitLongParagraph(paragraph, startPosition) {
    const chunks = [];
    let pos = 0;
    const paragraphLength = paragraph.length;

    while (pos < paragraphLength) {
      let endPos = Math.min(pos + this.maxChunkSize, paragraphLength);

      if (endPos < paragraphLength) {
        for (const separator of this.separators) {
          if (separator) {
            const idx = paragraph.lastIndexOf(separator, endPos);
            if (idx > pos + 50) {
              endPos = idx + separator.length;
              break;
            }
          }
        }
      }

      const chunkText = paragraph.substring(pos, endPos).trim();
      if (chunkText) {
        chunks.push({
          text: chunkText,
          startPosition: startPosition + pos,
          endPosition: startPosition + endPos,
        });
      }

      if (endPos >= paragraphLength) {
        break;
      }

      const nextPos = endPos - this.chunkOverlap;
      if (nextPos <= pos) {
        pos = endPos;
      } else {
        pos = nextPos;
      }
    }

    return chunks;
  }

  async splitFile(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    return this.splitTextByParagraphs(content);
  }
}

module.exports = TextSplitter;
