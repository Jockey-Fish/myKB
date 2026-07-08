/**
 * Ollama Embedding服务 - 基于本地Ollama的文本向量化
 * 使用nomic-embed-text模型
 */

const axios = require("axios");
const logger = require("../logger");

class OllamaEmbeddingService {
  constructor(options = {}) {
    this.baseUrl =
      options.baseUrl ||
      process.env.OLLAMA_BASE_URL ||
      "http://127.0.0.1:11434";
    this.model =
      options.model || process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
    this.timeout = options.timeout || 30000; // 30秒超时
    this.initialized = false;

    // 创建axios实例 - 强制使用IPv4
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
      },
      transformRequest: [(data) => JSON.stringify(data)],
    });
  }

  /**
   * 初始化Ollama Embedding服务
   */
  async initialize() {
    if (this.initialized) return;

    try {
      logger.info("正在初始化Ollama Embedding服务...");

      // 检查Ollama服务是否可用
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];

      // 检查模型是否存在
      const modelExists = models.some(
        (m) => m.name === this.model || m.name.startsWith(this.model),
      );

      if (!modelExists) {
        logger.warn(
          `Embedding模型 ${this.model} 未在Ollama中找到，请先运行: ollama pull ${this.model}`,
        );
      } else {
        logger.info(`Ollama Embedding模型已加载: ${this.model}`);
      }

      this.initialized = true;
      logger.info("Ollama Embedding服务初始化完成");
    } catch (error) {
      logger.error("Ollama Embedding服务初始化失败:", error);
      throw new Error(`Ollama Embedding初始化失败: ${error.message}`);
    }
  }

  /**
   * 向量化单个文本
   */
  async embed(text) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const payload = {
        model: this.model,
        prompt: text,
      };

      logger.debug("发送Ollama Embedding请求", {
        model: this.model,
        textLength: text.length,
      });

      const response = await this.client.post("/api/embeddings", payload);
      const result = response.data;

      // #region debug-point embed-result
      logger.debug("Ollama Embedding响应详情", {
        hasEmbedding: !!result.embedding,
        embeddingType: Array.isArray(result.embedding)
          ? "array"
          : typeof result.embedding,
        embeddingLength: result.embedding?.length,
        firstValues: result.embedding?.slice(0, 5),
        lastValues: result.embedding?.slice(-5),
        responseType: typeof result,
        responseKeys: Object.keys(result),
      });
      // #endregion debug-point embed-result

      if (
        !result.embedding ||
        !Array.isArray(result.embedding) ||
        result.embedding.length === 0
      ) {
        logger.error("Ollama Embedding返回空向量", { result });
        throw new Error("Embedding返回空向量");
      }

      logger.debug("Ollama Embedding完成", {
        model: result.model,
        embeddingLength: result.embedding.length,
      });

      return result.embedding;
    } catch (error) {
      logger.error("Ollama Embedding失败:", error);
      throw new Error(`Embedding失败: ${error.message}`);
    }
  }

  /**
   * 批量向量化
   */
  async embedBatch(texts) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.debug("发送Ollama批量Embedding请求", {
        model: this.model,
        count: texts.length,
      });

      const embeddings = [];
      for (const text of texts) {
        const embedding = await this.embed(text);
        embeddings.push(embedding);
      }

      logger.debug("Ollama批量Embedding完成", {
        model: this.model,
        embeddingsCount: embeddings.length,
      });

      return embeddings;
    } catch (error) {
      logger.error("Ollama批量Embedding失败:", error);
      throw new Error(`批量Embedding失败: ${error.message}`);
    }
  }

  /**
   * 向量化chunk
   */
  async embedChunk(chunk) {
    const vector = await this.embed(chunk.text);
    return {
      ...chunk,
      vector: vector,
    };
  }

  /**
   * 批量向量化chunks
   */
  async embedChunks(chunks) {
    const texts = chunks.map((chunk) => chunk.text);
    const vectors = await this.embedBatch(texts);

    // 验证向量长度
    const vectorDimension = this.getVectorDimension();
    const invalidChunks = [];

    for (let i = 0; i < vectors.length; i++) {
      if (!Array.isArray(vectors[i]) || vectors[i].length !== vectorDimension) {
        invalidChunks.push({
          index: i,
          text: chunks[i].text.substring(0, 50),
          actualLength: Array.isArray(vectors[i]) ? vectors[i].length : "N/A",
          expectedLength: vectorDimension,
        });
      }
    }

    if (invalidChunks.length > 0) {
      logger.error("发现向量长度不匹配的chunks:", invalidChunks);
      throw new Error(
        `向量长度不匹配：期望${vectorDimension}维，但发现${invalidChunks.length}个异常向量`,
      );
    }

    // 额外验证：确保所有向量都是Float32Array或普通数组
    const totalVectorLength = vectors.reduce((sum, v) => sum + v.length, 0);
    logger.debug(
      `向量验证通过: ${vectors.length}个chunks, 总长度${totalVectorLength}, 期望${vectors.length * vectorDimension}`,
    );

    return chunks.map((chunk, index) => ({
      ...chunk,
      vector: vectors[index],
    }));
  }

  /**
   * 获取向量维度
   */
  getVectorDimension() {
    return parseInt(process.env.VECTOR_DIMENSION) || 768;
  }

  /**
   * 获取服务状态
   */
  async getStatus() {
    try {
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];
      const modelExists = models.some(
        (m) => m.name === this.model || m.name.startsWith(this.model),
      );

      return {
        provider: "ollama",
        model: this.model,
        baseUrl: this.baseUrl,
        initialized: this.initialized,
        available: true,
        modelExists,
        vectorDimension: this.getVectorDimension(),
        availableModels: models.map((m) => m.name),
        message: modelExists
          ? "Ollama Embedding服务正常"
          : `模型 ${this.model} 未找到`,
      };
    } catch (error) {
      return {
        provider: "ollama",
        model: this.model,
        baseUrl: this.baseUrl,
        initialized: false,
        available: false,
        message: `Ollama Embedding服务不可用: ${error.message}`,
      };
    }
  }
}

module.exports = OllamaEmbeddingService;
