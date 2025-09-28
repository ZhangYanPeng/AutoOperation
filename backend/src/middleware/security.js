/**
 * 安全相关中间件
 * 包含 CORS、请求限制、安全头等
 */

import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import crypto from 'crypto';
import { RateLimitError } from './errorHandler.js';
import { logger } from './logger.js';

// CORS 配置
const corsOptions = {
  origin: function (origin, callback) {
    // 允许的源列表
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];
    
    // 在开发环境中允许没有 origin 的请求（比如移动应用）
    if (process.env.NODE_ENV === 'development' && !origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

// 通用请求限制
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 15分钟内最多100个请求
  message: {
    success: false,
    error: {
      message: '请求过于频繁，请稍后再试'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      success: false,
      error: {
        message: '请求过于频繁，请稍后再试'
      }
    });
  }
});

// API 请求限制（更严格）
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 50, // 限制每个IP 15分钟内最多50个API请求
  message: {
    success: false,
    error: {
      message: 'API请求过于频繁，请稍后再试'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 登录请求限制（非常严格）
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制每个IP 15分钟内最多5次登录尝试
  message: {
    success: false,
    error: {
      message: '登录尝试次数过多，请稍后再试'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // 成功的请求不计入限制
});

// 创建会话限制
const sessionCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 10, // 限制每个IP 1小时内最多创建10个会话
  message: {
    success: false,
    error: {
      message: '会话创建过于频繁，请稍后再试'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 请求ID中间件
const requestId = (req, res, next) => {
  // Node.js 14 兼容性：使用 uuid 包替代 crypto.randomUUID
  req.id = crypto.randomBytes(16).toString('hex');
  res.setHeader('X-Request-ID', req.id);
  next();
};

// 请求大小限制
const requestSizeLimit = (req, res, next) => {
  const contentLength = parseInt(req.get('content-length') || '0', 10);
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength > maxSize) {
    logger.warn('Request size exceeded', {
      contentLength,
      maxSize,
      ip: req.ip,
      url: req.url
    });
    
    return res.status(413).json({
      success: false,
      error: {
        message: '请求体过大'
      }
    });
  }
  
  next();
};

// IP 白名单中间件（用于管理端点）
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // 开发环境跳过检查
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    
    if (allowedIPs.length === 0 || allowedIPs.includes(clientIP)) {
      next();
    } else {
      logger.warn('IP not in whitelist', {
        clientIP,
        allowedIPs,
        url: req.url
      });
      
      res.status(403).json({
        success: false,
        error: {
          message: '访问被拒绝'
        }
      });
    }
  };
};

// 安全头配置
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false // 关闭以支持某些第三方库
});

export {
  corsOptions,
  generalLimiter,
  apiLimiter,
  loginLimiter,
  sessionCreationLimiter,
  requestId,
  requestSizeLimit,
  ipWhitelist,
  securityHeaders
};