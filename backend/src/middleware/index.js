/**
 * 中间件索引文件
 * 统一导出所有中间件
 */

const { logger, requestLogger } = require('./logger');
const { 
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  RateLimitError,
  errorHandler,
  asyncHandler,
  notFound
} = require('./errorHandler');
const {
  corsOptions,
  generalLimiter,
  apiLimiter,
  loginLimiter,
  sessionCreationLimiter,
  requestId,
  requestSizeLimit,
  ipWhitelist,
  securityHeaders
} = require('./security');
const {
  validateRequired,
  validateTypes,
  validateLength,
  validateEnum,
  validateSessionCreation,
  validateStepExecution,
  validateFeedback,
  validateKnowledgeSearch,
  validateSessionSearch,
  validateToolExecution,
  validateUUID,
  validateNotEmpty,
  validateContentType
} = require('./validation');

module.exports = {
  // 日志相关
  logger,
  requestLogger,
  
  // 错误处理相关
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  RateLimitError,
  errorHandler,
  asyncHandler,
  notFound,
  
  // 安全相关
  corsOptions,
  generalLimiter,
  apiLimiter,
  loginLimiter,
  sessionCreationLimiter,
  requestId,
  requestSizeLimit,
  ipWhitelist,
  securityHeaders,
  
  // 验证相关
  validateRequired,
  validateTypes,
  validateLength,
  validateEnum,
  validateSessionCreation,
  validateStepExecution,
  validateFeedback,
  validateKnowledgeSearch,
  validateSessionSearch,
  validateToolExecution,
  validateUUID,
  validateNotEmpty,
  validateContentType
};