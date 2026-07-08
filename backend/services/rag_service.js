/**
 * RAG问答服务 - 整合向量检索和大模型生成
 */

const TextSplitter = require("../rag/text_splitter");
const OllamaEmbeddingService = require("./ollama_embedding_service");
const LanceVectorStore = require("../rag/lance_store");
const OllamaLLMService = require("./ollama_llm_service");

class RAGService {
  constructor(options = {}) {
    // 文本切片器
    this.textSplitter = new TextSplitter({
      chunkSize: options.chunkSize || 500,
      chunkOverlap: options.chunkOverlap || 50,
    });

    // Ollama Embedding服务
    this.vectorizer = new OllamaEmbeddingService({
      baseUrl:
        options.ollamaBaseUrl ||
        process.env.OLLAMA_BASE_URL ||
        "http://127.0.0.1:11434",
      model:
        options.embeddingModel ||
        process.env.OLLAMA_EMBEDDING_MODEL ||
        "nomic-embed-text",
    });

    // 向量存储 - LanceDB实现
    this.vectorStore = new LanceVectorStore({
      collectionName: options.collectionName || "document_chunks",
      persistPath: options.persistPath || "./lance_db",
    });

    // Ollama LLM服务
    this.llmService = new OllamaLLMService({
      baseUrl:
        options.ollamaBaseUrl ||
        process.env.OLLAMA_BASE_URL ||
        "http://127.0.0.1:11434",
      model: options.llmModel || process.env.OLLAMA_MODEL || "qwen2.5:7b",
    });

    // RAG配置
    this.topK = options.topK || parseInt(process.env.TOP_K) || 5;
    this.similarityThreshold = options.similarityThreshold || 0.05;
    this.maxContextLength = options.maxContextLength || 3000;

    this.initialized = false;
  }

  /**
   * 初始化RAG服务
   */
  async initialize() {
    if (this.initialized) return;

    try {
      console.log("正在初始化RAG服务...");

      // 初始化向量化器
      await this.vectorizer.initialize();

      // 初始化向量存储
      await this.vectorStore.initialize();

      // 初始化LLM服务
      await this.llmService.initialize();

      this.initialized = true;
      console.log("RAG服务初始化完成");
    } catch (error) {
      console.error("RAG服务初始化失败:", error);
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
    const userId = options.userId;

    if (!userId) {
      throw new Error("userId不能为空，必须进行用户隔离");
    }

    try {
      // 1. 向量化查询问题
      const queryStartTime = Date.now();
      const queryVector = await this.vectorizer.embed(question);
      const queryTime = Date.now() - queryStartTime;

      // 2. 检索相关文档 - 原ChromaVectorStore.query逻辑替换为LanceDB的searchSimilarChunks
      // 强制过滤当前登录用户的user_id，只能检索当前用户私有知识库
      // 用户隔离过滤安全设计：防止越权访问其他用户向量数据
      const retrieveStartTime = Date.now();
      console.log(
        `[RAG DEBUG] searchSimilarChunks params: user_id=${userId}, document_id=${options.documentId}, topK=${topK}`,
      );
      const searchResult = await this.vectorStore.searchSimilarChunks(
        queryVector,
        {
          user_id: userId,
          topK: topK,
          document_id: options.documentId,
        },
      );
      const results = searchResult.results;
      console.log(
        `[RAG DEBUG] searchSimilarChunks returned: ${results.length} results`,
      );
      if (results.length > 0) {
        console.log(
          `[RAG DEBUG] first result: document_id=${results[0].document_id}, similarity=${results[0].similarity}`,
        );
      }
      const retrieveTime = Date.now() - retrieveStartTime;

      const relevantDocs = results.filter(
        (doc) => doc.similarity > this.similarityThreshold,
      );
      console.log(
        `[RAG DEBUG] similarityThreshold=${this.similarityThreshold}, after filter: ${relevantDocs.length}`,
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
        sources: relevantDocs.map((doc) => ({
          id: doc.document_id,
          text:
            doc.text.substring(0, 200) + (doc.text.length > 200 ? "..." : ""),
          similarity: doc.similarity,
          documentId: doc.document_id,
          filename: doc.filename,
          chunkIndex: parseInt(doc.chunk_index) || 0,
          metadata: {
            chunkIndex: parseInt(doc.chunk_index) || 0,
            startPosition: doc.start_position,
            endPosition: doc.end_position,
          },
        })),
        metadata: {
          queryTime,
          retrieveTime,
          generateTime,
          totalTime,
          relevantDocsCount: relevantDocs.length,
          model: answer.model,
          provider: answer.provider,
        },
      };
    } catch (error) {
      console.error("RAG查询失败:", error);
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
    const userId = options.userId;

    if (!userId) {
      throw new Error("userId不能为空，必须进行用户隔离");
    }

    try {
      // 1. 向量化查询问题
      const queryVector = await this.vectorizer.embed(question);

      // 2. 检索相关文档 - 原ChromaVectorStore.query逻辑替换为LanceDB的searchSimilarChunks
      const retrieveStartTime = Date.now();
      const searchResult = await this.vectorStore.searchSimilarChunks(
        queryVector,
        {
          user_id: userId,
          topK: topK,
          document_id: options.documentId,
        },
      );
      const results = searchResult.results;
      const retrieveTime = Date.now() - retrieveStartTime;

      // 3. 过滤低相关性结果
      const relevantDocs = results.filter(
        (doc) => doc.similarity > this.similarityThreshold,
      );

      // 4. 构建上下文和提示词
      const context = this._buildContext(relevantDocs);
      const prompt = this._buildPrompt(question, context);

      // 5. 先返回检索结果
      yield {
        type: "sources",
        data: relevantDocs.map((doc) => ({
          id: doc.document_id,
          text:
            doc.text.substring(0, 200) + (doc.text.length > 200 ? "..." : ""),
          similarity: doc.similarity,
          documentId: doc.document_id,
          filename: doc.filename,
          chunkIndex: parseInt(doc.chunk_index) || 0,
          metadata: {
            chunkIndex: parseInt(doc.chunk_index) || 0,
            startPosition: doc.start_position,
            endPosition: doc.end_position,
          },
        })),
      };

      // 如果启用debug模式，返回debug信息
      if (options.debug) {
        yield {
          type: "debug",
          data: {
            retrieveTime: retrieveTime,
            prompt: prompt,
            relevantDocsCount: relevantDocs.length,
            topK: topK,
            similarityThreshold: this.similarityThreshold,
          },
        };
      }

      // 6. 流式生成回答
      let fullContent = "";
      let lastChunk = null;
      const generateStartTime = Date.now();
      for await (const chunk of this.llmService.generateStream(
        prompt,
        options,
      )) {
        if (chunk.content) {
          fullContent += chunk.content;
          lastChunk = chunk;
          yield {
            type: "content",
            data: chunk.content,
            done: chunk.done,
          };
        }
      }
      const generateTime = Date.now() - generateStartTime;

      // 7. 返回完成信息
      const totalTime = Date.now() - startTime;
      yield {
        type: "done",
        data: {
          totalTime,
          relevantDocsCount: relevantDocs.length,
        },
      };

      // 如果启用debug模式，返回最终debug信息
      if (options.debug) {
        yield {
          type: "debug",
          data: {
            totalTime: totalTime,
            retrieveTime: retrieveTime,
            generateTime: generateTime,
            model: lastChunk?.model || "unknown",
            provider: lastChunk?.provider || "ollama",
          },
        };
      }
    } catch (error) {
      console.error("RAG流式查询失败:", error);
      yield {
        type: "error",
        data: error.message,
      };
    }
  }

  /**
   * 构建上下文
   */
  _buildContext(documents) {
    if (!documents || documents.length === 0) {
      return "";
    }

    let context = "";
    let totalLength = 0;

    for (const doc of documents) {
      const text = doc.text;
      if (totalLength + text.length > this.maxContextLength) {
        break;
      }
      context += text + "\n\n";
      totalLength += text.length;
    }

    return context.trim();
  }

  /**
   * 构建提示词
   */
  _buildPrompt(question, context) {
    if (context) {
      return `你是一名知识库助手。

请严格依据以下知识内容回答问题。

如果知识库中不存在答案，请明确说明：

"当前知识库中未找到相关内容。"

知识内容：

${context}

用户问题：

${question}`;
    } else {
      return `你是一名知识库助手。

当前知识库中未找到与问题相关的内容。

用户问题：

${question}

请说明当前知识库中未找到相关内容。`;
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
        chunkIndex: index,
      }));

      // 3. 向量化
      const embeddedChunks = await this.vectorizer.embedChunks(chunksWithMeta);

      // 4. 存储到向量库
      const result = await this.vectorStore.addDocuments(embeddedChunks);

      return {
        documentId: chunksWithMeta[0]?.documentId,
        chunksCount: chunks.length,
        storedCount: result.count,
      };
    } catch (error) {
      console.error("添加文档失败:", error);
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
        initialized: this.vectorStore.initialized,
      },
      llm: await this.llmService.getStatus(),
    };

    if (this.vectorStore.initialized) {
      try {
        status.vectorStore.documentCount =
          await this.vectorStore.getDocumentCount();
      } catch (error) {
        status.vectorStore.error = error.message;
      }
    }

    return status;
  }
}

module.exports = RAGService;
