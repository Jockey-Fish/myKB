/**
 * LanceDB向量存储工具类
 * 采用嵌入式单机模式，无需独立服务部署，数据持久化到本地文件系统
 * 替代原ChromaDB和自研JSON向量库方案
 * 使用 @lancedb/lancedb 0.5.x 版本API
 */

const lancedb = require("@lancedb/lancedb");
const path = require("path");
const logger = require("../logger");

/**
 * SQL注入防护：转义字符串中的特殊字符
 * LanceDB不支持参数化查询，需要手动转义防止SQL注入
 * @param {string} str - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeString(str) {
  if (typeof str !== "string") {
    str = String(str);
  }
  // 转义单引号、反斜杠、换行符等特殊字符
  return str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\0/g, "\\0");
}

class LanceVectorStore {
  constructor(options = {}) {
    this.db = null;
    this.collection = null;
    this.collectionName = options.collectionName || "document_chunks";
    this.persistPath =
      options.persistPath || path.join(__dirname, "../lance_db");
    this.initialized = false;
  }

  /**
   * 初始化LanceDB集合
   * 不存在则自动创建，存在直接加载
   * @returns {Promise<void>}
   */
  async initStore() {
    if (this.initialized) return;

    try {
      logger.info("正在初始化LanceDB向量存储...");

      this.db = await lancedb.connect(this.persistPath);

      const tableNames = await this.db.tableNames();
      const exists = tableNames.includes(this.collectionName);

      if (exists) {
        this.collection = await this.db.openTable(this.collectionName);
        logger.info(`LanceDB集合已加载: ${this.collectionName}`);
      } else {
        const sampleData = [
          {
            vector: new Array(384).fill(0),
            text: "",
            user_id: "",
            document_id: "",
            filename: "",
            chunk_index: "0",
            start_position: "0",
            end_position: "0",
          },
        ];
        this.collection = await this.db.createTable(
          this.collectionName,
          sampleData,
        );
        logger.info(`LanceDB集合已创建: ${this.collectionName}`);
      }

      this.initialized = true;
      logger.info("LanceDB向量存储初始化完成");
    } catch (error) {
      logger.error("LanceDB初始化失败:", error);
      throw new Error(`LanceDB初始化失败: ${error.message}`);
    }
  }

  async initialize() {
    return this.initStore();
  }

  async addDocumentChunks(chunks) {
    if (!this.initialized) {
      await this.initStore();
    }

    if (!Array.isArray(chunks) || chunks.length === 0) {
      throw new Error("文档切片数组不能为空");
    }

    try {
      const data = chunks.map((chunk) => ({
        vector: chunk.vector,
        text: chunk.text || "",
        user_id: String(chunk.user_id),
        document_id: String(chunk.document_id),
        filename: chunk.filename || "",
        chunk_index: String(chunk.chunk_index || 0),
        start_position: String(chunk.start_position || 0),
        end_position: String(chunk.end_position || 0),
      }));

      await this.collection.add(data);
      logger.info(`成功添加 ${chunks.length} 个文档切片到LanceDB`);

      return { success: true, count: chunks.length };
    } catch (error) {
      logger.error("添加文档切片到LanceDB失败:", error);
      throw new Error(`添加文档切片失败: ${error.message}`);
    }
  }

  /**
   * 根据文档ID删除该文档的所有向量切片
   * @param {string|number} documentId - 文档ID
   * @returns {Promise<{success: boolean}>} 删除结果
   */
  async deleteByDocumentId(documentId) {
    if (!this.initialized) {
      await this.initStore();
    }

    if (!documentId) {
      throw new Error("document_id不能为空");
    }

    try {
      const docIdStr = String(documentId);

      // 使用LanceDB原生delete方法，避免全表扫描
      // 时间复杂度从O(n)降低到O(1)（假设有索引）
      // SQL注入防护：转义用户输入
      await this.collection.delete(`document_id = '${escapeString(docIdStr)}'`);

      // 检查删除后是否还有数据
      const remainingData = await this.collection.query().toArray();

      // 如果删除后表为空，保留一条示例数据以维护表结构
      if (remainingData.length === 0) {
        const emptyData = [
          {
            vector: new Array(384).fill(0),
            text: "",
            user_id: "",
            document_id: "",
            filename: "",
            chunk_index: "0",
            start_position: "0",
            end_position: "0",
          },
        ];
        await this.db.createTable(this.collectionName, emptyData, {
          mode: "overwrite",
        });
        this.collection = await this.db.openTable(this.collectionName);
        logger.info(`文档 ${docIdStr} 的向量切片已删除，表已重置`);
      } else {
        logger.info(`文档 ${docIdStr} 的向量切片已删除`);
      }

      return { success: true };
    } catch (error) {
      logger.error("删除文档向量切片失败:", error);
      throw new Error(`删除文档向量失败: ${error.message}`);
    }
  }

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

      let query = this.collection
        .vectorSearch(queryVector)
        .where(`user_id = '${escapeString(options.user_id)}'`) // SQL注入防护：转义用户输入
        .select([
          "text",
          "document_id",
          "filename",
          "chunk_index",
          "start_position",
          "end_position",
        ]);

      if (options.document_id) {
        query = query.where(
          `document_id = '${escapeString(options.document_id)}'`,
        ); // SQL注入防护：转义用户输入
      }

      const results = await query.limit(topK).toArray();

      const formattedResults = results.map((row) => ({
        text: row.text || "",
        document_id: row.document_id || "",
        filename: row.filename || "",
        chunk_index: row.chunk_index || "0",
        start_position: row.start_position || "0",
        end_position: row.end_position || "0",
        distance: row._distance || 0,
        similarity: Math.max(0, 1 - (row._distance || 0)),
      }));

      logger.info(
        `用户 ${userIdStr} 相似度检索完成，返回 ${formattedResults.length} 条结果`,
      );

      return { success: true, results: formattedResults };
    } catch (error) {
      logger.error("相似度检索失败:", error);
      throw new Error(`检索失败: ${error.message}`);
    }
  }

  async getVectorCount(userId) {
    if (!this.initialized) {
      await this.initStore();
    }

    if (!userId) {
      throw new Error("user_id不能为空");
    }

    try {
      const userIdStr = String(userId);

      const countResult = await this.collection
        .query()
        .where(`user_id = '${escapeString(userId)}'`) // SQL注入防护：转义用户输入
        .where("document_id != ''") // 过滤掉空的document_id，避免统计示例数据
        .toArray();

      return { success: true, count: countResult.length };
    } catch (error) {
      logger.error("统计向量数量失败:", error);
      throw new Error(`统计失败: ${error.message}`);
    }
  }
}

module.exports = LanceVectorStore;
