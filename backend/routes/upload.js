const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { insertDocument, updateDocumentStatus } = require("../database");
const { authMiddleware } = require("../middleware/auth");
const { success, error } = require("../response");
const logger = require("../logger");

// 上传目录配置
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 支持的文件类型
const ALLOWED_TYPES = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
};

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Multer配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadDir, req.user.id.toString());
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

// 修复中文文件名编码问题
function fixFilenameEncoding(filename) {
  try {
    return Buffer.from(filename, "latin1").toString("utf8");
  } catch (e) {
    return filename;
  }
}

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // 检查文件扩展名
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`不支持的文件类型: ${ext}`), false);
  }

  // 检查MIME类型
  const mimetype = file.mimetype;
  if (
    mimetype === "application/pdf" ||
    mimetype.startsWith("text/") ||
    mimetype === "application/octet-stream"
  ) {
    cb(null, true);
  } else {
    return cb(new Error(`不支持的文件类型: ${mimetype}`), false);
  }
};

// Multer实例
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

/**
 * 文件上传接口
 * POST /api/documents/upload
 * Headers: Authorization: Bearer <token>
 * Body: FormData with file field
 */
router.post("/upload", authMiddleware, (req, res) => {
  upload.single("file")(req, res, async (err) => {
    try {
      // Multer错误处理
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return error(res, "文件大小超过限制（最大10MB）", 400);
        }
        if (err.message.includes("不支持的文件类型")) {
          return error(res, err.message, 400);
        }
        logger.error("文件上传错误", { error: err.message });
        return error(res, "文件上传失败", 500);
      }

      // 检查文件是否存在
      if (!req.file) {
        return error(res, "请选择要上传的文件", 400);
      }

      const {
        filename,
        originalname: rawOriginalname,
        path: filepath,
        size,
        mimetype,
      } = req.file;
      const originalname = fixFilenameEncoding(rawOriginalname);
      const userId = req.user.id;

      // 确定文件类型
      const ext = path.extname(originalname).toLowerCase().slice(1);
      const filetype = ALLOWED_TYPES[mimetype] || ext;

      // 保存文档记录到数据库
      const documentId = insertDocument(
        userId,
        filename,
        originalname,
        filepath,
        filetype,
        size,
      );

      logger.info(`文件上传成功: ${originalname}`, {
        documentId,
        userId,
        filetype,
        size,
      });

      // 返回文件元数据
      success(
        res,
        {
          id: documentId,
          filename: originalname,
          filetype,
          filesize: size,
          uploadTime: new Date().toISOString(),
          status: "completed",
        },
        "文件上传成功",
      );
    } catch (err) {
      logger.error("文件上传处理错误", { error: err.message });
      error(res, "文件上传失败", 500);
    }
  });
});

/**
 * 批量文件上传接口
 * POST /api/documents/upload-multiple
 * Headers: Authorization: Bearer <token>
 * Body: FormData with files field (array)
 */
router.post("/upload-multiple", authMiddleware, (req, res) => {
  upload.array("files", 10)(req, res, async (err) => {
    try {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return error(res, "文件大小超过限制（最大10MB）", 400);
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return error(res, "最多同时上传10个文件", 400);
        }
        logger.error("批量上传错误", { error: err.message });
        return error(res, "文件上传失败", 500);
      }

      if (!req.files || req.files.length === 0) {
        return error(res, "请选择要上传的文件", 400);
      }

      const userId = req.user.id;
      const results = [];

      for (const file of req.files) {
        const {
          filename,
          originalname: rawOriginalname,
          path: filepath,
          size,
          mimetype,
        } = file;
        const originalname = fixFilenameEncoding(rawOriginalname);
        const ext = path.extname(originalname).toLowerCase().slice(1);
        const filetype = ALLOWED_TYPES[mimetype] || ext;

        const documentId = insertDocument(
          userId,
          filename,
          originalname,
          filepath,
          filetype,
          size,
        );

        results.push({
          id: documentId,
          filename: originalname,
          filetype,
          filesize: size,
          uploadTime: new Date().toISOString(),
          status: "completed",
        });
      }

      logger.info(`批量文件上传成功: ${results.length}个文件`, { userId });

      success(res, results, `成功上传${results.length}个文件`);
    } catch (err) {
      logger.error("批量上传处理错误", { error: err.message });
      error(res, "文件上传失败", 500);
    }
  });
});

module.exports = router;
