const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { findUserById } = require("../database");
const { unauthorized, error } = require("../response");
const logger = require("../logger");

// JWT密钥
const JWT_SECRET =
  process.env.JWT_SECRET || "ai-knowledge-base-secret-key-2024";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// 生成JWT令牌
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

// 验证JWT令牌
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// JWT认证中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return unauthorized(res, "请提供有效的认证令牌");
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return unauthorized(res, "认证令牌无效或已过期");
  }

  // 查询用户信息
  const user = findUserById(decoded.id);
  if (!user) {
    return unauthorized(res, "用户不存在");
  }

  // 将用户信息附加到请求对象
  req.user = user;
  req.token = token;
  next();
}

// 可选认证中间件（不强制要求登录）
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (decoded) {
      const user = findUserById(decoded.id);
      if (user) {
        req.user = user;
        req.token = token;
      }
    }
  }

  next();
}

// 登录请求频率限制
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次尝试
  message: {
    code: 429,
    message: "登录尝试次数过多，请15分钟后再试",
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("登录频率限制触发", { ip: req.ip });
    res.status(429).json({
      code: 429,
      message: "登录尝试次数过多，请15分钟后再试",
      data: null,
    });
  },
});

// API请求频率限制
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 100, // 最多100次请求
  message: {
    code: 429,
    message: "请求过于频繁，请稍后再试",
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 检查用户权限
function checkPermission(requiredPermission) {
  return (req, res, next) => {
    // 这里可以扩展更复杂的权限检查逻辑
    if (!req.user) {
      return unauthorized(res, "请先登录");
    }
    next();
  };
}

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware,
  optionalAuth,
  loginLimiter,
  apiLimiter,
  checkPermission,
  JWT_SECRET,
};
