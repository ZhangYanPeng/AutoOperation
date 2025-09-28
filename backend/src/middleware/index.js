/**
 * 中间件索引文件
 * 统一导出所有中间件
 */

import { logger, requestLogger } from './logger.js';
import { 
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  RateLimitError,
  errorHandler,
  asyncHandler,
  notFound
} from './errorHandler.js';
import {
  corsOptions,
  generalLimiter,
  apiLimiter,
  loginLimiter,
  sessionCreationLimiter,
  requestId,
  requestSizeLimit,
  ipWhitelist,
  securityHeaders
} from './security.js';
import {
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
} from './validation.js';

export {
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