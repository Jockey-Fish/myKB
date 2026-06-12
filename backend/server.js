require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// 导入模块
const { initDatabase } = require("./database");
const { apiLimiter } = require("./middleware/auth");
const logger = require("./logger");
const { error } = require("./response");

// 导入路由
const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const extractRoutes = require("./routes/extract");
const documentsRoutes = require("./routes/documents");
const ragRoutes = require("./routes/rag");
const chatRoutes = require("./routes/chat");

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 确保上传目录存在
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ==================== 中间件配置 ====================

// CORS配置
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// JSON解析
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 请求日志中间件
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on("finish", () => {
    const responseTime = Date.now() - startTime;
    logger.request(req, res, responseTime);
  });

  next();
});

// API频率限制
app.use("/api", apiLimiter);

// 静态文件服务（上传的文件）
app.use("/uploads", express.static(uploadDir));

// ==================== 路由配置 ====================

// API路由
app.use("/api/auth", authRoutes);
app.use("/api/documents", uploadRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/extract", extractRoutes);
app.use("/api/rag", ragRoutes);
app.use("/api/chat", chatRoutes);

// favicon.ico 请求处理
app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

// 健康检查接口
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API文档接口
app.get("/api", (req, res) => {
  res.json({
    name: "AI知识库API",
    version: "1.0.0",
    endpoints: {
      auth: {
        "POST /api/auth/login": "用户登录",
        "POST /api/auth/register": "用户注册",
        "GET /api/auth/me": "获取当前用户信息",
        "POST /api/auth/logout": "用户登出",
        "GET /api/auth/verify": "验证令牌",
      },
      documents: {
        "GET /api/documents": "获取文档列表（分页）",
        "GET /api/documents/:id": "获取文档详情",
        "DELETE /api/documents/:id": "删除文档",
        "POST /api/documents/batch-delete": "批量删除文档",
        "GET /api/documents/search/query": "搜索文档",
        "GET /api/documents/stats/overview": "获取统计信息",
      },
      upload: {
        "POST /api/documents/upload": "上传单个文件",
        "POST /api/documents/upload-multiple": "批量上传文件",
      },
      extract: {
        "GET /api/extract/:id/content": "提取文件内容",
        "GET /api/extract/:id/chunks": "获取文档切片",
        "GET /api/extract/:id/metadata": "获取文档元数据",
      },
      rag: {
        "POST /api/rag/ingest": "文档向量化并存储",
        "POST /api/rag/query": "向量相似度检索",
        "GET /api/rag/stats": "获取向量库统计信息",
        "DELETE /api/rag/documents": "批量删除文档",
        "DELETE /api/rag/document/:documentId": "删除指定文档的所有分块",
        "DELETE /api/rag/clear": "清空向量库",
        "POST /api/rag/split": "文本切片（仅切片，不存储）",
        "POST /api/rag/embed": "文本向量化（仅向量化，不存储）",
      },
      chat: {
        "POST /api/chat/ask": "AI问答（非流式）",
        "POST /api/chat/stream": "AI问答（流式SSE）",
        "POST /api/chat/document": "添加文档到知识库",
        "GET /api/chat/status": "获取服务状态",
        "GET /api/chat/history": "获取对话历史",
        "DELETE /api/chat/history": "清空对话历史",
      },
    },
  });
});

// ==================== 错误处理 ====================

// 404处理
app.use((req, res) => {
  error(res, `路由未找到: ${req.method} ${req.path}`, 404);
});

// 全局错误处理
app.use((err, req, res, next) => {
  logger.error("服务器错误", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Multer错误
  if (err.code === "LIMIT_FILE_SIZE") {
    return error(res, "文件大小超过限制", 400);
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return error(res, "文件上传字段错误", 400);
  }

  // JWT错误
  if (err.name === "JsonWebTokenError") {
    return error(res, "认证令牌无效", 401);
  }

  if (err.name === "TokenExpiredError") {
    return error(res, "认证令牌已过期", 401);
  }

  // 默认错误
  error(
    res,
    process.env.NODE_ENV === "development" ? err.message : "服务器内部错误",
    500,
  );
});

// ==================== 启动服务器 ====================

async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    logger.info("数据库初始化完成");

    const server = app.listen(PORT, () => {
      logger.info(`服务器启动成功，端口: ${PORT}`);
      logger.info(`环境: ${process.env.NODE_ENV || "development"}`);
      logger.info(`API文档: http://localhost:${PORT}/api`);
      logger.info(`健康检查: http://localhost:${PORT}/health`);
    });

    // 优雅关闭
    process.on("SIGTERM", () => {
      logger.info("收到SIGTERM信号，正在关闭服务器...");
      server.close(() => {
        logger.info("服务器已关闭");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      logger.info("收到SIGINT信号，正在关闭服务器...");
      server.close(() => {
        logger.info("服务器已关闭");
        process.exit(0);
      });
    });
  } catch (err) {
    logger.error("服务器启动失败", { error: err.message });
    process.exit(1);
  }
}

// 未捕获异常处理
process.on("uncaughtException", (err) => {
  logger.error("未捕获异常", { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("未处理的Promise拒绝", { reason: String(reason) });
});

startServer();

module.exports = app;
