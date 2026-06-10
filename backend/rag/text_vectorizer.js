/**
 * 简化版文本向量化模块 - 使用简单的哈希向量化
 * 用于测试和开发环境，不依赖外部模型
 */

class TextVectorizer {
  constructor(options = {}) {
    this.vectorDimension = options.vectorDimension || 384;
    this.initialized = true;
    this.modelName = 'simple-hash';
    
    // 预定义的常用词向量（用于更好的相似度计算）
    this.wordVectors = {};
    this._initializeWordVectors();
  }

  _initializeWordVectors() {
    const commonWords = [
      '人工智能', '机器学习', '深度学习', '神经网络', '数据', '模型',
      '算法', '训练', '预测', '分类', '回归', '聚类',
      '自然语言', '处理', '文本', '图像', '语音', '视频',
      '推荐', '搜索', '分析', '知识', '问答', '系统'
    ];
    
    commonWords.forEach((word, index) => {
      const vector = new Array(this.vectorDimension).fill(0);
      // 使用简单的哈希算法生成向量
      for (let i = 0; i < this.vectorDimension; i++) {
        vector[i] = (hash(word + i) % 200 - 100) / 100;
      }
      this.wordVectors[word] = vector;
    });
  }

  async initialize() {
    // 已经初始化
    return;
  }

  async embed(texts) {
    if (!Array.isArray(texts)) {
      texts = [texts];
    }

    const vectors = texts.map(text => {
      return this._textToVector(text);
    });

    return vectors;
  }

  _textToVector(text) {
    const vector = new Array(this.vectorDimension).fill(0);
    const words = this._tokenize(text);
    
    words.forEach((word, index) => {
      let wordVector;
      
      if (this.wordVectors[word]) {
        wordVector = this.wordVectors[word];
      } else {
        // 为未知词生成随机向量
        wordVector = new Array(this.vectorDimension).fill(0);
        for (let i = 0; i < this.vectorDimension; i++) {
          wordVector[i] = (hash(word + i) % 200 - 100) / 100;
        }
      }
      
      // 将词向量添加到文档向量中
      const weight = 1 / (index + 1); // 前面的词权重更高
      for (let i = 0; i < this.vectorDimension; i++) {
        vector[i] += wordVector[i] * weight;
      }
    });

    // 归一化向量
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < this.vectorDimension; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  _tokenize(text) {
    // 简单的中文分词
    const cleaned = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ');
    const words = cleaned.split(/\s+/).filter(word => word.length > 0);
    return words;
  }

  async embedChunk(chunk) {
    const vector = await this.embed(chunk.text);
    return {
      ...chunk,
      vector: vector[0]
    };
  }

  async embedChunks(chunks) {
    const texts = chunks.map(chunk => chunk.text);
    const vectors = await this.embed(texts);

    return chunks.map((chunk, index) => ({
      ...chunk,
      vector: vectors[index]
    }));
  }

  getVectorDimension() {
    return this.vectorDimension;
  }
}

// 简单的哈希函数
function hash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  return hash;
}

module.exports = TextVectorizer;
