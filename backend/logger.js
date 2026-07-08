const fs = require('fs');
const path = require('path');

// 日志文件路径
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, 'app.log');
const errorLogFile = path.join(logDir, 'error.log');

// 获取当前时间戳
function getTimestamp() {
  return new Date().toISOString();
}

// 格式化日志消息
function safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
}

function formatMessage(level, message, meta = {}) {
  const timestamp = getTimestamp();
  const metaStr = Object.keys(meta).length > 0 ? ` ${safeStringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
}

// 写入日志文件
function writeLog(filePath, content) {
  fs.appendFileSync(filePath, content, 'utf8');
}

// 日志级别
const logger = {
  info(message, meta = {}) {
    const logMessage = formatMessage('INFO', message, meta);
    console.log(logMessage.trim());
    writeLog(logFile, logMessage);
  },

  error(message, meta = {}) {
    const logMessage = formatMessage('ERROR', message, meta);
    console.error(logMessage.trim());
    writeLog(errorLogFile, logMessage);
    writeLog(logFile, logMessage);
  },

  warn(message, meta = {}) {
    const logMessage = formatMessage('WARN', message, meta);
    console.warn(logMessage.trim());
    writeLog(logFile, logMessage);
  },

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      const logMessage = formatMessage('DEBUG', message, meta);
      console.log(logMessage.trim());
      writeLog(logFile, logMessage);
    }
  },

  // HTTP请求日志
  request(req, res, responseTime) {
    const meta = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress
    };
    const logMessage = formatMessage('HTTP', `${req.method} ${req.originalUrl}`, meta);
    writeLog(logFile, logMessage);
  }
};

module.exports = logger;
