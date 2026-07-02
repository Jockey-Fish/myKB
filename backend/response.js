const logger = require('./logger');

/**
 * 统一响应格式
 * {
 *   code: 状态码 (200成功, 400客户端错误, 500服务器错误)
 *   message: 提示消息
 *   data: 响应数据
 *   timestamp: 时间戳
 * }
 */

// 成功响应
function success(res, data = null, message = '操作成功', code = 200) {
  const response = {
    code,
    message,
    data,
    timestamp: new Date().toISOString()
  };
  logger.info(`Response: ${code} - ${message}`);
  return res.status(code).json(response);
}

// 错误响应
function error(res, message = '操作失败', code = 400, errors = null) {
  const response = {
    code,
    message,
    data: null,
    errors,
    timestamp: new Date().toISOString()
  };
  logger.error(`Response: ${code} - ${message}`);
  return res.status(code).json(response);
}

// 分页响应
function paginated(res, data, total, page, pageSize, message = '查询成功') {
  const response = {
    code: 200,
    message,
    data: {
      list: data,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / pageSize)
      }
    },
    timestamp: new Date().toISOString()
  };
  logger.info(`Paginated Response: ${total} records, page ${page}`);
  return res.status(200).json(response);
}

// 未授权响应
function unauthorized(res, message = '未授权访问') {
  return error(res, message, 401);
}

// 禁止访问响应
function forbidden(res, message = '禁止访问') {
  return error(res, message, 403);
}

// 资源未找到响应
function notFound(res, message = '资源未找到') {
  return error(res, message, 404);
}

// 服务器错误响应
function serverError(res, message = '服务器内部错误') {
  return error(res, message, 500);
}

module.exports = {
  success,
  error,
  paginated,
  unauthorized,
  forbidden,
  notFound,
  serverError
};
