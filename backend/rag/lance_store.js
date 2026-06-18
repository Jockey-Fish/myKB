/**
 * LanceDB向量存储工具类
 * 采用嵌入式单机模式，无需独立服务部署，数据持久化到本地文件系统
 * 替代原ChromaDB和自研JSON向量库方案
 */

const lancedb = require("@lancedb/lancedb");
const path = require("path");
const logger = require("../logger");

class LanceVectorStore {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.collectionName - 集合名称，默认为document_chunks
   * @param {string} options.persistPath - 持久化存储目录，默认为./lance_db
   */
  constructor(options = {}) {
    this.db = null;
    this.collection = null;
    // 集合名称：固定为document_chunks，存储文档切片向量
    this.collectionName = options.collectionName || "document_chunks";
    // 持久化路径：项目根目录下的lance_db文件夹
    this.persistPath =
      options.persistPath || path.join(__dirname, "../lance_db");
    this.initialized = false;
  }

  /**
   * 初始化LanceDB集合
   * 不存在则自动创建，存在直接加载
   * 采用单例初始化模式，防止重复创建连接
   * @returns {Promise<void>}
   * @throws {Error} - 初始化失败时抛出异常
   */
  async initStore() {
    if (this.initialized) return;

    try {
      logger.info("正在初始化LanceDB向量存储...");

      // 创建或打开本地数据库
      // 使用嵌入式模式，数据存储在本地文件系统，无需远程服务
      this.db = await lancedb.connect(this.persistPath);

      // 检查集合是否存在
      const collections = await this.db.listCollections();
      const exists = collections.some(
        (col) => col.name === this.collectionName,
      );

      if (exists) {
        // 加载已存在的集合
        this.collection = await this.db.openCollection(this.collectionName);
        logger.info(`LanceDB集合已加载: ${this.collectionName}`);
      } else {
        // 创建新集合，定义表结构
        // 字段设计：
        // - vector: 向量数据，Embedding模型生成的384维向量
        // - text: 切片文本内容
        // - user_id: 用户ID（字符串），用于多用户知识库隔离
        // - document_id: 文档ID（字符串），用于关联原始文档
        // - filename: 文件名，便于溯源
        // - chunk_index: 切片索引（字符串），表示文档内的顺序位置
        // - start_position: 文本起始位置（字符串），用于定位原文
        // - end_position: 文本结束位置（字符串），用于定位原文
        const schema = [
          { name: "vector", type: "fixed_size_list<f32>[384]" },
          { name: "text", type: "string" },
          { name: "user_id", type: "string" },
          { name: "document_id", type: "string" },
          { name: "filename", type: "string" },
          { name: "chunk_index", type: "string" },
          { name: "start_position", type: "string" },
          { name: "end_position", type: "string" },
        ];

        this.collection = await this.db.createCollection(this.collectionName, {
          schema,
        });

        // 创建索引：加速相似度检索和条件过滤
        // 使用余弦相似度，适用于Embedding向量检索场景
        // 余弦相似度取值范围[-1, 1]，值越大表示越相似
        await this.collection.createIndex("vector", {
          type: "vector",
          metric: "cosine",
          num_partitions: 1,
        });

        logger.info(`LanceDB集合已创建: ${this.collectionName}`);
      }

      this.initialized = true;
      logger.info("LanceDB向量存储初始化完成");
    } catch (error) {
      logger.error("LanceDB初始化失败:", error);
      throw new Error(`LanceDB初始化失败: ${error.message}`);
    }
  }

  /**
   * 批量插入文档切片向量
   * @param {Array} chunks - 文档切片数组
   * @param {Object} chunks[].vector - 向量数据（384维数组）
   * @param {string} chunks[].text - 切片文本内容
   * @param {string} chunks[].user_id - 用户ID（统一字符串格式）
   * @param {string} chunks[].document_id - 文档ID（统一字符串格式）
   * @param {string} chunks[].filename - 文件名
   * @param {number} chunks[].chunk_index - 切片索引
   * @param {number} chunks[].start_position - 文本起始位置
   * @param {number} chunks[].end_position - 文本结束位置
   * @returns {Promise<Object>} - 插入结果，包含成功数量和ID列表
   * @throws {Error} - 插入失败时抛出异常
   */
  async addDocumentChunks(chunks) {
    if (!this.initialized) {
      await this.initStore();
    }

    if (!Array.isArray(chunks) || chunks.length === 0) {
      throw new Error("文档切片数组不能为空");
    }

    try {
      // 将数据转换为LanceDB格式
      // 所有ID统一转换为字符串，避免过滤匹配BUG
      const data = chunks.map((chunk) => ({
        vector: chunk.vector,
        text: chunk.text || "",
        user_id: String(chunk.user_id), // 统一字符串格式
        document_id: String(chunk.document_id), // 统一字符串格式
        filename: chunk.filename || "",
        chunk_index: String(chunk.chunk_index || 0), // 统一字符串格式
        start_position: String(chunk.start_position || 0), // 统一字符串格式
        end_position: String(chunk.end_position || 0), // 统一字符串格式
      }));

      // 批量写入向量数据
      await this.collection.add(data);

      logger.info(`成功添加 ${chunks.length} 个文档切片到LanceDB`);

      return {
        success: true,
        count: chunks.length,
      };
    } catch (error) {
      logger.error("添加文档切片到LanceDB失败:", error);
      throw new Error(`添加文档切片失败: ${error.message}`);
    }
  }

  /**
   * 根据document_id条件批量删除该文档下所有向量切片
   * 文档删除时需要同步清理向量，保证数据一致性
   * @param {string|number} documentId - 文档ID
   * @returns {Promise<Object>} - 删除结果，包含删除数量
   * @throws {Error} - 删除失败时抛出异常
   */
  async deleteByDocumentId(documentId) {
    if (!this.initialized) {
      await this.initStore();
    }

    if (!documentId) {
      throw new Error("document_id不能为空");
    }

    try {
      // 将document_id转换为字符串，确保匹配
      const docIdStr = String(documentId);

      // 查询该文档下的所有切片
      const result = await this.collection
        .where("document_id = ?", docIdStr)
        .select(["id"])
        .execute();

      const idsToDelete = result.map((row) => row.id);

      if (idsToDelete.length > 0) {
        // 批量删除
        await this.collection.delete(idsToDelete);
        logger.info(
          `成功删除文档 ${docIdStr} 的 ${idsToDelete.length} 个向量切片`,
        );
      }

      return {
        success: true,
        deletedCount: idsToDelete.length,
      };
    } catch (error) {
      logger.error("删除文档向量切片失败:", error);
      throw new Error(`删除文档向量失败: ${error.message}`);
    }
  }

  /**
   * 相似度检索方法
   * 强制携带where条件过滤当前登录用户user_id，实现多用户知识库隔离
   * @param {Array} queryVector - 查询向量（384维数组）
   * @param {Object} options - 查询选项
   * @param {string} options.user_id - 当前登录用户ID（必须），用于权限过滤
   * @param {number} options.topK - 返回结果条数，默认为5
   * @param {string} [options.document_id] - 可选，限制检索特定文档
   * @returns {Promise<Array>} - 检索结果数组，包含文本、相似度等信息
   * @throws {Error} - 检索失败时抛出异常
   */
  async searchSimilarChunks(queryVector, options = {}) {
    if (!this.initialized) {
      await this.initStore();
    }

    if (!queryVector || !Array.isArray(queryVector)) {
      throw new Error("查询向量不能为空");
    }

    if (!options.user_id) {
      throw new Error("user_id不能为空，必须进行用户隔离");
    }

    try {
      const topK = options.topK || 5;
      const userIdStr = String(options.user_id);

      // 构建查询条件：强制过滤当前用户
      // 用户隔离过滤的安全作用：防止越权访问他人知识库
      let query = this.collection
        .where("user_id = ?", userIdStr)
        .select([
          "text",
          "document_id",
          "filename",
          "chunk_index",
          "start_position",
          "end_position",
        ]);

      // 可选：限制检索特定文档
      if (options.document_id) {
        query = query.where("document_id = ?", String(options.document_id));
      }

      // 执行相似度检索
      // LanceDB的search方法返回按相似度排序的结果
      const results = await query.search(queryVector).limit(topK).execute();

      // 处理返回结果，计算余弦相似度得分
      // LanceDB返回的score是距离值，需要转换为相似度
      // 余弦相似度 = 1 - 余弦距离
      const formattedResults = results.map((row) => ({
        text: row.text || "",
        document_id: row.document_id || "",
        filename: row.filename || "",
        chunk_index: row.chunk_index || "0",
        start_position: row.start_position || "0",
        end_position: row.end_position || "0",
        distance: row._distance || 0, // 原始距离值
        similarity: Math.max(0, 1 - (row._distance || 0)), // 转换为相似度
      }));

      logger.info(
        `用户 ${userIdStr} 相似度检索完成，返回 ${formattedResults.length} 条结果`,
      );

      return {
        success: true,
        results: formattedResults,
      };
    } catch (error) {
      logger.error("相似度检索失败:", error);
      throw new Error(`检索失败: ${error.message}`);
    }
  }

  /**
   * 统计当前用户下所有向量切片总数
   * 用于后台统计展示
   * @param {string|number} userId - 用户ID
   * @returns {Promise<Object>} - 统计结果，包含向量总数
   * @throws {Error} - 统计失败时抛出异常
   */
  async getVectorCount(userId) {
    if (!this.initialized) {
      await this.initStore();
    }

    if (!userId) {
      throw new Error("user_id不能为空");
    }

    try {
      const userIdStr = String(userId);

      // 查询当前用户的向量总数
      const count = await this.collection
        .where("user_id = ?", userIdStr)
        .count();

      return {
        success: true,
        count: count,
      };
    } catch (error) {
      logger.error("统计向量数量失败:", error);
      throw new Error(`统计失败: ${error.message}`);
    }
  }
}

module.exports = LanceVectorStore;
