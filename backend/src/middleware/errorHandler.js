import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  // 记录错误日志
  logger.error(`错误发生在 ${req.method} ${req.path}:`, {
    error: err.message,
    stack: err.stack,
    body: req.body,
    query: req.query,
    params: req.params,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // 默认错误响应
  let status = 500;
  let message = '服务器内部错误';

  // 根据错误类型设置响应
  if (err.name === 'ValidationError') {
    status = 400;
    message = '请求参数验证失败';
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = '未授权访问';
  } else if (err.name === 'NotFoundError') {
    status = 404;
    message = '资源未找到';
  } else if (err.status) {
    status = err.status;
    message = err.message;
  }

  // 生产环境不暴露详细错误信息
  const errorResponse = {
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // 开发环境包含详细错误信息
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.details = err.message;
    errorResponse.stack = err.stack;
  }

  res.status(status).json(errorResponse);
};

export default errorHandler;