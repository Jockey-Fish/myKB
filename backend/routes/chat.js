/**
 * AI问答接口路由
 */

const express = require("express");
const router = express.Router();
const RAGService = require("../services/rag_service");
const { authMiddleware } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");

// 创建RAG服务实例
const ragService = new RAGService({
  topK: 5,
  similarityThreshold: 0.05,
  maxContextLength: 3000,
});

// 问答请求限流（每分钟最多20次）
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    code: 429,
    message: "请求过于频繁，请稍后再试",
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/chat/ask - AI问答（非流式）
 * @body {string} question - 用户问题
 * @body {number} topK - 检索文档数量（可选，默认5）
 * @body {number} maxTokens - 最大生成token数（可选）
 * @body {number} temperature - 生成温度（可选）
 */
router.post("/ask", authMiddleware, chatLimiter, async (req, res) => {
  try {
    const { question, topK, top_k, maxTokens, temperature, document_id } =
      req.body;

    // 参数验证
    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length === 0
    ) {
      return res.status(400).json({
        code: 400,
        message: "问题不能为空",
        data: null,
      });
    }

    if (question.length > 2000) {
      return res.status(400).json({
        code: 400,
        message: "问题长度不能超过2000字符",
        data: null,
      });
    }

    // 执行RAG查询
    const result = await ragService.query(question, {
      topK: topK || top_k || 5,
      maxTokens,
      temperature,
      userId: req.user.id,
      documentId: document_id,
    });

    console.log(
      `[DEBUG] /chat/ask - userId=${req.user.id}, document_id=${document_id}, sourcesCount=${result.sources.length}`,
    );
    if (result.sources.length > 0) {
      console.log(
        `[DEBUG] /chat/ask - 第一条相似度=${result.sources[0].similarity}`,
      );
    }

    res.json({
      code: 200,
      message: "查询成功",
      data: result,
    });
  } catch (error) {
    console.error("AI问答失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "AI问答服务异常",
      data: null,
    });
  }
});

/**
 * POST /api/chat/stream - AI问答（流式）
 * @body {string} question - 用户问题
 * @body {number} topK - 检索文档数量（可选，默认5）
 * @body {number} maxTokens - 最大生成token数（可选）
 * @body {number} temperature - 生成温度（可选）
 */
router.post("/stream", authMiddleware, chatLimiter, async (req, res) => {
  try {
    const { question, topK, top_k, maxTokens, temperature, document_id } =
      req.body;

    // 参数验证
    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length === 0
    ) {
      return res.status(400).json({
        code: 400,
        message: "问题不能为空",
        data: null,
      });
    }

    if (question.length > 2000) {
      return res.status(400).json({
        code: 400,
        message: "问题长度不能超过2000字符",
        data: null,
      });
    }

    // 设置SSE响应头
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // 禁用nginx缓冲

    // 执行流式RAG查询
    const stream = ragService.queryStream(question, {
      topK: topK || top_k || 5,
      maxTokens,
      temperature,
      userId: req.user.id,
      documentId: document_id,
      debug: req.query.debug === "true",
    });

    for await (const chunk of stream) {
      // 发送SSE事件
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);

      // 强制刷新响应缓冲区，确保数据实时发送到客户端
      if (res.flush) {
        res.flush();
      }
    }

    // 发送结束事件
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("AI流式问答失败:", error);

    if (!res.headersSent) {
      res.status(500).json({
        code: 500,
        message: error.message || "AI问答服务异常",
        data: null,
      });
    } else {
      res.write(
        `data: ${JSON.stringify({ type: "error", data: error.message })}\n\n`,
      );
      res.end();
    }
  }
});

/**
 * POST /api/chat/document - 添加文档到知识库
 * @body {string} text - 文档文本内容
 * @body {string} documentId - 文档ID（可选）
 */
router.post("/document", authMiddleware, async (req, res) => {
  try {
    const { text, documentId } = req.body;

    // 参数验证
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({
        code: 400,
        message: "文档内容不能为空",
        data: null,
      });
    }

    if (text.length > 100000) {
      return res.status(400).json({
        code: 400,
        message: "文档内容不能超过100000字符",
        data: null,
      });
    }

    // 添加文档
    const result = await ragService.addDocument(text, documentId);

    res.json({
      code: 200,
      message: "文档添加成功",
      data: result,
    });
  } catch (error) {
    console.error("添加文档失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "添加文档失败",
      data: null,
    });
  }
});

/**
 * GET /api/chat/status - 获取服务状态
 */
router.get("/status", async (req, res) => {
  try {
    const status = await ragService.getStatus();

    res.json({
      code: 200,
      message: "获取状态成功",
      data: status,
    });
  } catch (error) {
    console.error("获取状态失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "获取状态失败",
      data: null,
    });
  }
});

/**
 * GET /api/chat/history - 获取对话历史（需要实现会话管理）
 * @query {number} page - 页码
 * @query {number} pageSize - 每页数量
 */
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const userId = req.user.id;

    // TODO: 从数据库获取对话历史
    // 这里返回空数据，需要后续实现会话管理

    res.json({
      code: 200,
      message: "获取对话历史成功",
      data: {
        history: [],
        total: 0,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    console.error("获取对话历史失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "获取对话历史失败",
      data: null,
    });
  }
});

/**
 * DELETE /api/chat/history - 清空对话历史
 */
router.delete("/history", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // TODO: 清空数据库中的对话历史

    res.json({
      code: 200,
      message: "对话历史已清空",
      data: null,
    });
  } catch (error) {
    console.error("清空对话历史失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "清空对话历史失败",
      data: null,
    });
  }
});

module.exports = router;
