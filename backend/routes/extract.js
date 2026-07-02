const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const iconv = require("iconv-lite");
const {
  getDocumentById,
  getDocumentChunks,
  insertDocumentChunk,
  updateDocumentChunkCount,
} = require("../database");
const { authMiddleware } = require("../middleware/auth");
const { success, error, notFound } = require("../response");
const logger = require("../logger");
const TextSplitter = require("../rag/text_splitter");
const OllamaEmbeddingService = require("../services/ollama_embedding_service");
const LanceVectorStore = require("../rag/lance_store");

/**
 * 检测文件编码
 */
function detectEncoding(buffer) {
  // 简单的编码检测逻辑
  // 尝试UTF-8
  try {
    const decoded = buffer.toString("utf8");
    if (!decoded.includes("�")) {
      return "utf8";
    }
  } catch (e) {}

  // 尝试GBK
  try {
    const decoded = iconv.decode(buffer, "gbk");
    if (decoded && !decoded.includes("�")) {
      return "gbk";
    }
  } catch (e) {}

  // 默认返回utf8
  return "utf8";
}

/**
 * 提取PDF文件内容
 */
async function extractPdfContent(filepath) {
  try {
    const dataBuffer = fs.readFileSync(filepath);
    const data = await pdfParse(dataBuffer);
    return {
      content: data.text,
      pages: data.numpages,
      info: data.info || {},
    };
  } catch (err) {
    throw new Error(`PDF解析失败: ${err.message}`);
  }
}

/**
 * 提取TXT文件内容
 */
function extractTxtContent(filepath) {
  try {
    const buffer = fs.readFileSync(filepath);
    const encoding = detectEncoding(buffer);
    const content = iconv.decode(buffer, encoding);
    return {
      content,
      encoding,
      lines: content.split("\n").length,
    };
  } catch (err) {
    throw new Error(`TXT文件读取失败: ${err.message}`);
  }
}

/**
 * 提取Markdown文件内容
 */
function extractMdContent(filepath) {
  try {
    const buffer = fs.readFileSync(filepath);
    const encoding = detectEncoding(buffer);
    const content = iconv.decode(buffer, encoding);
    return {
      content,
      encoding,
      lines: content.split("\n").length,
    };
  } catch (err) {
    throw new Error(`Markdown文件读取失败: ${err.message}`);
  }
}

/**
 * 文件内容提取接口
 * GET /api/documents/:id/content
 * Headers: Authorization: Bearer <token>
 */
router.get("/:id/content", authMiddleware, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    // 获取文档信息
    const document = getDocumentById(documentId, userId);
    if (!document) {
      return notFound(res, "文档不存在或无权访问");
    }

    // 检查文件是否存在
    if (!fs.existsSync(document.filepath)) {
      logger.error(`文件不存在: ${document.filepath}`);
      return error(res, "文件已被删除或移动", 404);
    }

    let result;
    const filetype = document.filetype.toLowerCase();

    // 根据文件类型提取内容
    switch (filetype) {
      case "pdf":
        result = await extractPdfContent(document.filepath);
        break;
      case "txt":
        result = extractTxtContent(document.filepath);
        break;
      case "md":
        result = extractMdContent(document.filepath);
        break;
      default:
        return error(res, `不支持的文件类型: ${filetype}`, 400);
    }

    logger.info(`文件内容提取成功: ${document.originalname}`, {
      documentId,
      filetype,
      contentLength: result.content.length,
    });

    success(
      res,
      {
        id: documentId,
        filename: document.originalname,
        file_type: document.filetype,
        ...result,
        extracted_at: new Date().toISOString(),
      },
      "内容提取成功",
    );
  } catch (err) {
    logger.error("文件内容提取错误", { error: err.message });
    error(res, err.message || "内容提取失败", 500);
  }
});

/**
 * 获取文档切片内容接口
 * GET /api/documents/:id/chunks
 * Headers: Authorization: Bearer <token>
 */
router.get("/:id/chunks", authMiddleware, (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    // 获取文档信息
    const document = getDocumentById(documentId, userId);
    if (!document) {
      return notFound(res, "文档不存在或无权访问");
    }

    // 获取文档切片
    const chunks = getDocumentChunks(documentId);

    success(
      res,
      {
        id: documentId,
        filename: document.originalname,
        chunks: chunks.map((chunk) => ({
          index: chunk.chunk_index,
          content: chunk.content,
        })),
        totalChunks: chunks.length,
      },
      "获取切片成功",
    );
  } catch (err) {
    logger.error("获取文档切片错误", { error: err.message });
    error(res, "获取切片失败", 500);
  }
});

/**
 * 获取文档元数据接口
 * GET /api/documents/:id/metadata
 * Headers: Authorization: Bearer <token>
 */
router.get("/:id/metadata", authMiddleware, (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    const document = getDocumentById(documentId, userId);
    if (!document) {
      return notFound(res, "文档不存在或无权访问");
    }

    // 获取文件统计信息
    const stats = fs.statSync(document.filepath);

    success(
      res,
      {
        id: document.id,
        filename: document.originalname,
        file_type: document.filetype,
        filesize: document.filesize,
        status: document.status,
        created_at: document.created_at,
        last_modified: stats.mtime,
        file_path: document.filepath,
      },
      "获取元数据成功",
    );
  } catch (err) {
    logger.error("获取文档元数据错误", { error: err.message });
    error(res, "获取元数据失败", 500);
  }
});

module.exports = router;

/**
 * 处理文档提取和切片（供上传接口调用）
 * @param {number} documentId - 文档ID
 * @param {number} userId - 用户ID
 * @returns {Object} - 处理结果
 */
async function processDocument(documentId, userId) {
  try {
    const document = getDocumentById(documentId, userId);
    if (!document) {
      return { success: false, message: "文档不存在" };
    }

    // 检查文件是否存在
    if (!fs.existsSync(document.filepath)) {
      logger.error(`文件不存在: ${document.filepath}`);
      return { success: false, message: "文件不存在" };
    }

    let result;
    const filetype = document.filetype.toLowerCase();

    // 根据文件类型提取内容
    switch (filetype) {
      case "pdf":
        result = await extractPdfContent(document.filepath);
        break;
      case "txt":
        result = extractTxtContent(document.filepath);
        break;
      case "md":
        result = extractMdContent(document.filepath);
        break;
      default:
        return { success: false, message: `不支持的文件类型: ${filetype}` };
    }

    logger.info(`文件内容提取成功: ${document.originalname}`, {
      documentId,
      filetype,
      contentLength: result.content.length,
    });

    // 创建文本切片器并进行切片
    const splitter = new TextSplitter({
      chunkSize: 500,
      chunkOverlap: 100,
    });
    const chunks = splitter.splitTextByParagraphs(result.content);

    logger.info(`文本切片成功: ${document.originalname}`, {
      documentId,
      chunkCount: chunks.length,
    });

    // 将切片保存到数据库（SQLite）
    for (let i = 0; i < chunks.length; i++) {
      insertDocumentChunk(documentId, i, chunks[i].text);
    }

    // 更新文档的切片数量
    updateDocumentChunkCount(documentId, chunks.length);

    // ========== 原JSON向量库逻辑替换为LanceDB实现 ==========
    // 创建Ollama Embedding服务实例（向量维度由环境变量VECTOR_DIMENSION配置）
    const vectorizer = new OllamaEmbeddingService({
      baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
      model: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",
    });
    await vectorizer.initialize();

    // 创建LanceDB向量存储实例
    const vectorStore = new LanceVectorStore({
      collectionName: "document_chunks",
      persistPath: "./lance_db",
    });
    await vectorStore.initStore();

    // 对每个切片进行向量化
    logger.info(`开始向量化文档切片: ${document.originalname}`, { documentId });
    const embeddedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = await vectorizer.embed(chunk.text);
      embeddedChunks.push({
        vector: vector,
        text: chunk.text,
        user_id: userId,
        document_id: documentId,
        filename: document.originalname,
        chunk_index: i,
        start_position: chunk.startPosition || 0,
        end_position: chunk.endPosition || chunk.text.length,
      });
    }
    logger.info(`向量化完成: ${document.originalname}`, {
      documentId,
      vectorCount: embeddedChunks.length,
    });

    // 批量插入到LanceDB向量库
    // 绑定当前登录用户userId、文档ID、文件名等元数据
    // 元数据字段说明：
    // - user_id: 用户ID，用于多用户知识库隔离
    // - document_id: 文档ID，用于关联原始文档和批量删除
    // - filename: 文件名，便于溯源和展示
    // - chunk_index: 切片索引，用于保持顺序
    // - start_position/end_position: 文本位置，用于定位原文
    const storeResult = await vectorStore.addDocumentChunks(embeddedChunks);
    logger.info(`向量入库成功: ${document.originalname}`, {
      documentId,
      storedCount: storeResult.count,
    });

    return {
      success: true,
      data: {
        id: documentId,
        filename: document.originalname,
        file_type: document.filetype,
        ...result,
        chunks: chunks,
        chunkCount: chunks.length,
        vectorCount: storeResult.count,
        extracted_at: new Date().toISOString(),
      },
    };
  } catch (err) {
    logger.error("文件内容提取错误", { error: err.message, stack: err.stack });
    return { success: false, message: err.message };
  }
}

module.exports.processDocument = processDocument;

/**
 * 获取文档内容
 */
router.get("/:id/content", authMiddleware, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const document = getDocumentById(documentId);

    if (!document) {
      return res.status(404).json(notFound("文档不存在"));
    }

    // 检查权限
    if (document.user_id !== req.user.id) {
      return res.status(403).json(error("无权访问该文档"));
    }

    // 检查文档状态
    if (document.status !== "processed") {
      return res.status(400).json(error("文档尚未处理完成"));
    }

    // 从数据库获取文档内容
    const chunks = getDocumentChunks(documentId);
    if (!chunks || chunks.length === 0) {
      return res.status(404).json(notFound("文档内容不存在"));
    }

    // 合并所有切片内容
    const content = chunks.map((chunk) => chunk.content).join("\n\n");

    res.json(
      success(
        {
          content,
          chunkCount: chunks.length,
          documentId,
        },
        "获取文档内容成功",
      ),
    );
  } catch (err) {
    logger.error("获取文档内容错误", { error: err.message });
    res.status(500).json(error("获取文档内容失败"));
  }
});

/**
 * 获取文档切片
 */
router.get("/:id/chunks", authMiddleware, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const document = getDocumentById(documentId);

    if (!document) {
      return res.status(404).json(notFound("文档不存在"));
    }

    // 检查权限
    if (document.user_id !== req.user.id) {
      return res.status(403).json(error("无权访问该文档"));
    }

    // 检查文档状态
    if (document.status !== "processed") {
      return res.status(400).json(error("文档尚未处理完成"));
    }

    // 从数据库获取文档切片
    const chunks = getDocumentChunks(documentId);
    if (!chunks || chunks.length === 0) {
      return res.status(404).json(notFound("文档切片不存在"));
    }

    // 格式化切片数据
    const formattedChunks = chunks.map((chunk) => ({
      id: chunk.id,
      index: chunk.chunk_index,
      content: chunk.content,
      documentId: chunk.document_id,
      createdAt: chunk.created_at,
    }));

    res.json(
      success(
        {
          chunks: formattedChunks,
          total: formattedChunks.length,
          documentId,
        },
        "获取文档切片成功",
      ),
    );
  } catch (err) {
    logger.error("获取文档切片错误", { error: err.message });
    res.status(500).json(error("获取文档切片失败"));
  }
});
