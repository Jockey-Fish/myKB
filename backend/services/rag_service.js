/**
 * RAG问答服务 - 整合向量检索和大模型生成
 */

const TextSplitter = require('../rag/text_splitter');
const TextVectorizer = require('../rag/text_vectorizer');
const ChromaVectorStore = require('../rag/vector_store');
const LLMService = require('./llm_service');

class RAGService {
  constructor(options = {}) {
    // 文本切片器
    this.textSplitter = new TextSplitter({
      chunkSize: options.chunkSize || 500,
      chunkOverlap: options.chunkOverlap || 50
    });

    // 文本向量化器
    this.vectorizer = new TextVectorizer({
      modelName: options.embeddingModel || 'Xenova/all-MiniLM-L6-v2'
    });

    // 向量存储
    this.vectorStore = new ChromaVectorStore({
      collectionName: options.collectionName || 'knowledge_base',
      persistPath: options.persistPath || './chroma_db'
    });

    // 大语言模型服务
    this.llmService = new LLMService({
      provider: options.llmProvider,
      model: options.llmModel,
      baseUrl: options.llmBaseUrl,
      apiKey: options.llmApiKey
    });

    // RAG配置
    this.topK = options.topK || 5;
    this.similarityThreshold = options.similarityThreshold || 0.3;
    this.maxContextLength = options.maxContextLength || 3000;

    this.initialized = false;
  }

  /**
   * 初始化RAG服务
   */
  async initialize() {
    if (this.initialized) return;

    try {
      console.log('正在初始化RAG服务...');
      
      // 初始化向量化器
      await this.vectorizer.initialize();
      
      // 初始化向量存储
      await this.vectorStore.initialize();
      
      // 初始化LLM服务
      await this.llmService.initialize();
      
      this.initialized = true;
      console.log('RAG服务初始化完成');
    } catch (error) {
      console.error('RAG服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行RAG问答（非流式）
   */
  async query(question, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const topK = options.topK || this.topK;

    try {
      // 1. 向量化查询问题
      const queryStartTime = Date.now();
      const [queryVector] = await this.vectorizer.embed(question);
      const queryTime = Date.now() - queryStartTime;

      // 2. 检索相关文档
      const retrieveStartTime = Date.now();
      const results = await this.vectorStore.query(queryVector, { k: topK });
      const retrieveTime = Date.now() - retrieveStartTime;

      // 3. 过滤低相关性结果
      const relevantDocs = results.filter(
        doc => doc.distance < this.similarityThreshold
      );

      // 4. 构建上下文
      const context = this._buildContext(relevantDocs);

      // 5. 构建提示词
      const prompt = this._buildPrompt(question, context);

      // 6. 调用LLM生成回答
      const generateStartTime = Date.now();
      const answer = await this.llmService.generate(prompt, options);
      const generateTime = Date.now() - generateStartTime;

      const totalTime = Date.now() - startTime;

      return {
        question,
        answer: answer.content,
        sources: relevantDocs.map(doc => ({
          id: doc.id,
          text: doc.text.substring(0, 200) + (doc.text.length > 200 ? '...' : ''),
          distance: doc.distance,
          documentId: doc.metadata?.documentId
        })),
        metadata: {
          queryTime,
          retrieveTime,
          generateTime,
          totalTime,
          relevantDocsCount: relevantDocs.length,
          model: answer.model,
          provider: answer.provider
        }
      };
    } catch (error) {
      console.error('RAG查询失败:', error);
      throw new Error(`问答失败: ${error.message}`);
    }
  }

  /**
   * 执行RAG问答（流式）
   */
  async *queryStream(question, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const topK = options.topK || this.topK;

    try {
      // 1. 向量化查询问题
      const [queryVector] = await this.vectorizer.embed(question);

      // 2. 检索相关文档
      const results = await this.vectorStore.query(queryVector, { k: topK });

      // 3. 过滤低相关性结果
      const relevantDocs = results.filter(
        doc => doc.distance < this.similarityThreshold
      );

      // 4. 构建上下文和提示词
      const context = this._buildContext(relevantDocs);
      const prompt = this._buildPrompt(question, context);

      // 5. 先返回检索结果
      yield {
        type: 'sources',
        data: relevantDocs.map(doc => ({
          id: doc.id,
          text: doc.text.substring(0, 200) + (doc.text.length > 200 ? '...' : ''),
          distance: doc.distance,
          documentId: doc.metadata?.documentId
        }))
      };

      // 6. 流式生成回答
      let fullContent = '';
      for await (const chunk of this.llmService.generateStream(prompt, options)) {
        if (chunk.content) {
          fullContent += chunk.content;
          yield {
            type: 'content',
            data: chunk.content,
            done: chunk.done
          };
        }
      }

      // 7. 返回完成信息
      const totalTime = Date.now() - startTime;
      yield {
        type: 'done',
        data: {
          totalTime,
          relevantDocsCount: relevantDocs.length
        }
      };

    } catch (error) {
      console.error('RAG流式查询失败:', error);
      yield {
        type: 'error',
        data: error.message
      };
    }
  }

  /**
   * 构建上下文
   */
  _buildContext(documents) {
    if (!documents || documents.length === 0) {
      return '';
    }

    let context = '';
    let totalLength = 0;

    for (const doc of documents) {
      const text = doc.text;
      if (totalLength + text.length > this.maxContextLength) {
        break;
      }
      context += text + '\n\n';
      totalLength += text.length;
    }

    return context.trim();
  }

  /**
   * 构建提示词
   */
  _buildPrompt(question, context) {
    if (context) {
      return `你是一个专业的AI助手。请根据以下参考知识回答用户的问题。如果参考知识中没有相关信息，请根据你的知识如实回答，但要说明这不是来自知识库。

参考知识：
${context}

用户问题：${question}

请提供准确、详细的回答：`;
    } else {
      return `你是一个专业的AI助手。请回答用户的问题。

用户问题：${question}

请提供准确、详细的回答：`;
    }
  }

  /**
   * 添加文档到知识库
   */
  async addDocument(text, documentId, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // 1. 文本切片
      const chunks = this.textSplitter.splitTextByParagraphs(text);
      
      // 2. 添加文档ID
      const chunksWithMeta = chunks.map((chunk, index) => ({
        ...chunk,
        documentId: documentId || `doc_${Date.now()}`,
        chunkIndex: index
      }));

      // 3. 向量化
      const embeddedChunks = await this.vectorizer.embedChunks(chunksWithMeta);

      // 4. 存储到向量库
      const result = await this.vectorStore.addDocuments(embeddedChunks);

      return {
        documentId: chunksWithMeta[0]?.documentId,
        chunksCount: chunks.length,
        storedCount: result.count
      };
    } catch (error) {
      console.error('添加文档失败:', error);
      throw new Error(`添加文档失败: ${error.message}`);
    }
  }

  /**
   * 获取服务状态
   */
  async getStatus() {
    const status = {
      initialized: this.initialized,
      vectorStore: {
        initialized: this.vectorStore.initialized
      },
      llm: await this.llmService.getStatus()
    };

    if (this.vectorStore.initialized) {
      try {
        status.vectorStore.documentCount = await this.vectorStore.getDocumentCount();
      } catch (error) {
        status.vectorStore.error = error.message;
      }
    }

    return status;
  }
}

module.exports = RAGService;
