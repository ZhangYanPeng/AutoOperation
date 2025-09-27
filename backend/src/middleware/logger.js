/**
 * 日志中间件
 * 记录请求和响应信息
 */

const fs = require('fs').promises;
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.initLogDir();
  }

  async initLogDir() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('创建日志目录失败:', error);
    }
  }

  getLogFileName(type = 'app') {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${type}-${date}.log`);
  }

  formatLogEntry(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      meta
    }) + '\n';
  }

  async writeLog(filename, entry) {
    try {
      await fs.appendFile(filename, entry);
    } catch (error) {
      console.error('写入日志失败:', error);
    }
  }

  log(level, message, meta = {}) {
    const entry = this.formatLogEntry(level, message, meta);
    const filename = this.getLogFileName();
    
    // 控制台输出
    console.log(`[${level.toUpperCase()}] ${message}`, meta);
    
    // 文件输出
    this.writeLog(filename, entry);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
    
    // 错误日志单独记录
    const errorEntry = this.formatLogEntry('error', message, meta);
    const errorFilename = this.getLogFileName('error');
    this.writeLog(errorFilename, errorEntry);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, meta);
    }
  }
}

const logger = new Logger();

// Express 中间件
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, url, ip } = req;
  
  // 记录请求开始
  logger.info('Request started', {
    method,
    url,
    ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });

  // 拦截响应结束
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    // 记录请求完成
    logger.info('Request completed', {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      requestId: req.id
    });

    // 如果是错误响应，记录详细信息
    if (statusCode >= 400) {
      logger.error('Request error', {
        method,
        url,
        statusCode,
        duration: `${duration}ms`,
        requestId: req.id,
        responseData: data
      });
    }

    originalSend.call(this, data);
  };

  next();
};

module.exports = {
  logger,
  requestLogger
};