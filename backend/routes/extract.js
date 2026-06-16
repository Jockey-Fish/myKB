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

    // 将切片保存到数据库
    for (let i = 0; i < chunks.length; i++) {
      insertDocumentChunk(documentId, i, chunks[i].text);
    }

    // 更新文档的切片数量
    updateDocumentChunkCount(documentId, chunks.length);

    return {
      success: true,
      data: {
        id: documentId,
        filename: document.originalname,
        file_type: document.filetype,
        ...result,
        chunks: chunks,
        chunkCount: chunks.length,
        extracted_at: new Date().toISOString(),
      },
    };
  } catch (err) {
    logger.error("文件内容提取错误", { error: err.message });
    return { success: false, message: err.message };
  }
}

module.exports.processDocument = processDocument;
