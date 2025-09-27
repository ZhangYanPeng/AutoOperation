import { logger } from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // 记录请求开始
  logger.info(`收到请求: ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined
  });

  // 监听响应完成
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel](`请求完成: ${req.method} ${req.path}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0
    });
  });

  next();
};

export default requestLogger;