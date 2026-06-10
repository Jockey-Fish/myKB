const express = require('express');
const router = express.Router();
const { findUserByUsername, verifyPassword, updateLastLogin, createUser } = require('../database');
const { generateToken, loginLimiter, authMiddleware } = require('../middleware/auth');
const { success, error } = require('../response');
const logger = require('../logger');

/**
 * 用户登录接口
 * POST /api/auth/login
 * Body: { username, password, rememberMe }
 */
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;

    // 参数验证
    if (!username || !password) {
      return error(res, '用户名和密码不能为空', 400);
    }

    // 查找用户
    const user = findUserByUsername(username);
    if (!user) {
      logger.warn(`登录失败: 用户不存在 - ${username}`);
      return error(res, '用户名或密码错误', 401);
    }

    // 验证密码
    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      logger.warn(`登录失败: 密码错误 - ${username}`);
      return error(res, '用户名或密码错误', 401);
    }

    // 更新最后登录时间
    updateLastLogin(user.id);

    // 生成JWT令牌
    const token = generateToken(user);

    // 返回用户信息（不包含密码）
    const userInfo = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name
    };

    logger.info(`用户登录成功: ${username}`);

    success(res, {
      token,
      user: userInfo,
      expiresIn: rememberMe ? '30d' : '7d'
    }, '登录成功');

  } catch (err) {
    logger.error('登录错误', { error: err.message });
    error(res, '登录失败，请稍后重试', 500);
  }
});

/**
 * 用户注册接口
 * POST /api/auth/register
 * Body: { username, email, password, name }
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, name } = req.body;

    // 参数验证
    if (!username || !password) {
      return error(res, '用户名和密码不能为空', 400);
    }

    if (username.length < 3 || username.length > 20) {
      return error(res, '用户名长度应为3-20个字符', 400);
    }

    if (password.length < 6 || password.length > 20) {
      return error(res, '密码长度应为6-20个字符', 400);
    }

    // 创建用户
    const user = await createUser(username, email, password, name || username);

    logger.info(`用户注册成功: ${username}`);

    success(res, {
      id: user.id,
      username: user.username,
      email: user.email
    }, '注册成功');

  } catch (err) {
    logger.error('注册错误', { error: err.message });
    if (err.message === '用户名或邮箱已存在') {
      return error(res, err.message, 400);
    }
    error(res, '注册失败，请稍后重试', 500);
  }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, (req, res) => {
  success(res, req.user, '获取用户信息成功');
});

/**
 * 用户登出接口
 * POST /api/auth/logout
 */
router.post('/logout', authMiddleware, (req, res) => {
  logger.info(`用户登出: ${req.user.username}`);
  success(res, null, '登出成功');
});

/**
 * 验证令牌有效性
 * GET /api/auth/verify
 */
router.get('/verify', authMiddleware, (req, res) => {
  success(res, { valid: true, user: req.user }, '令牌有效');
});

module.exports = router;
