/**
 * 文件上传中间件
 * 处理文档上传的验证、限制和预处理
 */

import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置存储
const storage = multer.memoryStorage(); // 使用内存存储，便于后续处理

// 文件过滤器
const fileFilter = (req, file, cb) => {
  logger.info('文件上传过滤检查', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  // 允许的文件扩展名
  const allowedExtensions = ['.md', '.markdown', '.txt'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  // 允许的MIME类型
  const allowedMimeTypes = [
    'text/markdown',
    'text/plain',
    'application/octet-stream' // 某些系统可能将.md识别为此类型
  ];

  // 检查文件扩展名
  if (!allowedExtensions.includes(fileExtension)) {
    const error = new Error(`不支持的文件类型: ${fileExtension}。支持的格式: ${allowedExtensions.join(', ')}`);
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  // 检查MIME类型
  if (!allowedMimeTypes.includes(file.mimetype)) {
    // 对于.md文件，即使MIME类型不匹配也允许
    if (fileExtension === '.md' || fileExtension === '.markdown') {
      logger.warn('Markdown文件MIME类型不匹配，但允许上传', {
        filename: file.originalname,
        mimetype: file.mimetype
      });
    } else {
      const error = new Error(`不支持的MIME类型: ${file.mimetype}`);
      error.code = 'INVALID_MIME_TYPE';
      return cb(error, false);
    }
  }

  // 检查文件名
  if (!file.originalname || file.originalname.trim() === '') {
    const error = new Error('文件名不能为空');
    error.code = 'INVALID_FILENAME';
    return cb(error, false);
  }

  // 检查文件名长度
  if (file.originalname.length > 255) {
    const error = new Error('文件名过长，最大长度为255个字符');
    error.code = 'FILENAME_TOO_LONG';
    return cb(error, false);
  }

  // 检查文件名中的危险字符
  const dangerousChars = /[<>:"|?*\x00-\x1f]/;
  if (dangerousChars.test(file.originalname)) {
    const error = new Error('文件名包含非法字符');
    error.code = 'INVALID_FILENAME_CHARS';
    return cb(error, false);
  }

  cb(null, true);
};

// 创建multer实例
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1, // 一次只允许上传一个文件
    fields: 10, // 最多10个表单字段
    fieldNameSize: 100, // 字段名最大长度
    fieldSize: 1024 * 1024 // 字段值最大1MB
  }
});

/**
 * 单文件上传中间件
 */
export const uploadSingle = upload.single('file');

/**
 * 多文件上传中间件（可选，用于批量上传）
 */
export const uploadMultiple = upload.array('files', 10); // 最多10个文件

/**
 * 上传错误处理中间件
 */
export const handleUploadErrors = (error, req, res, next) => {
  logger.error('文件上传错误:', error);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: '文件上传失败',
          message: '文件大小超过限制，最大允许5MB',
          code: 'FILE_TOO_LARGE'
        });
      
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: '文件上传失败',
          message: '上传文件数量超过限制',
          code: 'TOO_MANY_FILES'
        });
      
      case 'LIMIT_FIELD_COUNT':
        return res.status(400).json({
          error: '文件上传失败',
          message: '表单字段数量超过限制',
          code: 'TOO_MANY_FIELDS'
        });
      
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: '文件上传失败',
          message: '意外的文件字段',
          code: 'UNEXPECTED_FILE'
        });
      
      default:
        return res.status(400).json({
          error: '文件上传失败',
          message: error.message,
          code: error.code
        });
    }
  }

  if (error.code) {
    // 自定义错误代码
    switch (error.code) {
      case 'INVALID_FILE_TYPE':
      case 'INVALID_MIME_TYPE':
      case 'INVALID_FILENAME':
      case 'FILENAME_TOO_LONG':
      case 'INVALID_FILENAME_CHARS':
        return res.status(400).json({
          error: '文件验证失败',
          message: error.message,
          code: error.code
        });
      
      default:
        return res.status(500).json({
          error: '文件处理失败',
          message: error.message,
          code: error.code
        });
    }
  }

  // 其他错误
  return res.status(500).json({
    error: '文件上传失败',
    message: '服务器内部错误',
    code: 'INTERNAL_ERROR'
  });
};

/**
 * 文件预处理中间件
 */
export const preprocessFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }

    const file = req.file;
    
    logger.info('开始预处理文件', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    // 添加处理时间戳
    file.uploadTimestamp = new Date().toISOString();
    
    // 生成安全的文件名
    const safeFilename = generateSafeFilename(file.originalname);
    file.safeFilename = safeFilename;
    
    // 验证文件内容（如果是文本文件）
    if (file.buffer) {
      try {
        const content = file.buffer.toString('utf8');
        
        // 检查内容长度
        if (content.length === 0) {
          return res.status(400).json({
            error: '文件验证失败',
            message: '文件内容为空',
            code: 'EMPTY_FILE'
          });
        }
        
        if (content.length > 1000000) { // 1MB
          return res.status(400).json({
            error: '文件验证失败',
            message: '文件内容过长，最大允许1MB',
            code: 'CONTENT_TOO_LONG'
          });
        }
        
        // 检查是否为有效的UTF-8编码
        if (!/^[\x00-\x7F]|[\xC2-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|[\xF0-\xF7][\x80-\xBF]{3}*$/.test(content)) {
          logger.warn('文件编码可能不是UTF-8', { filename: file.originalname });
        }
        
        // 添加内容预览
        file.contentPreview = content.substring(0, 200);
        
        // 统计基本信息
        file.lineCount = content.split('\n').length;
        file.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
        
      } catch (error) {
        logger.error('文件内容预处理失败:', error);
        return res.status(400).json({
          error: '文件验证失败',
          message: '无法读取文件内容，请确保文件编码为UTF-8',
          code: 'INVALID_ENCODING'
        });
      }
    }

    logger.info('文件预处理完成', {
      originalname: file.originalname,
      safeFilename: file.safeFilename,
      lineCount: file.lineCount,
      wordCount: file.wordCount
    });

    next();
  } catch (error) {
    logger.error('文件预处理失败:', error);
    return res.status(500).json({
      error: '文件处理失败',
      message: '预处理过程中发生错误',
      code: 'PREPROCESSING_ERROR'
    });
  }
};

/**
 * 验证上传权限中间件
 */
export const validateUploadPermission = (req, res, next) => {
  // 这里可以添加用户权限验证逻辑
  // 例如检查用户是否有上传权限、是否在允许的IP范围内等
  
  const { uploader } = req.body;
  
  if (!uploader || uploader.trim() === '') {
    logger.warn('上传请求缺少上传者信息', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // 暂时允许匿名上传，但记录警告
    req.body.uploader = 'anonymous';
  }

  // TODO: 实现具体的权限验证逻辑
  // 例如：
  // - 检查用户角色
  // - 检查上传频率限制
  // - 检查存储配额
  
  logger.info('上传权限验证通过', {
    uploader: req.body.uploader,
    ip: req.ip
  });

  next();
};

/**
 * 上传频率限制中间件
 */
export const uploadRateLimit = (req, res, next) => {
  // 简单的频率限制实现
  // 在生产环境中，应该使用Redis或其他持久化存储来跟踪限制
  
  const clientId = req.ip; // 使用IP作为客户端标识
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15分钟窗口
  const maxUploads = 20; // 最大上传次数
  
  // 这里应该使用外部存储来持久化限制信息
  // 目前仅作为示例
  if (!req.app.uploadLimits) {
    req.app.uploadLimits = new Map();
  }
  
  const limits = req.app.uploadLimits;
  const clientLimits = limits.get(clientId) || { count: 0, resetTime: now + windowMs };
  
  if (now > clientLimits.resetTime) {
    // 重置窗口
    clientLimits.count = 0;
    clientLimits.resetTime = now + windowMs;
  }
  
  if (clientLimits.count >= maxUploads) {
    logger.warn('上传频率超限', {
      clientId,
      count: clientLimits.count,
      resetTime: new Date(clientLimits.resetTime)
    });
    
    return res.status(429).json({
      error: '上传频率超限',
      message: `15分钟内最多允许上传${maxUploads}个文件`,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((clientLimits.resetTime - now) / 1000)
    });
  }
  
  clientLimits.count++;
  limits.set(clientId, clientLimits);
  
  next();
};

/**
 * 生成安全的文件名
 */
function generateSafeFilename(originalname) {
  const extension = path.extname(originalname);
  const basename = path.basename(originalname, extension);
  
  // 移除或替换危险字符
  const safeName = basename
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_') // 保留中英文、数字、点、下划线、连字符
    .replace(/_{2,}/g, '_') // 合并多个下划线
    .replace(/^_+|_+$/g, '') // 移除开头和结尾的下划线
    .slice(0, 200); // 限制长度
  
  return safeName + extension;
}

/**
 * 清理临时文件中间件（用于错误情况）
 */
export const cleanupTempFiles = (req, res, next) => {
  // 添加清理函数到响应结束事件
  res.on('finish', () => {
    if (req.file && req.file.path) {
      // 如果有临时文件路径，尝试清理
      import('fs/promises').then(fs => {
        fs.unlink(req.file.path).catch(error => {
          logger.warn('清理临时文件失败:', error);
        });
      });
    }
  });
  
  next();
};

export default {
  uploadSingle,
  uploadMultiple,
  handleUploadErrors,
  preprocessFile,
  validateUploadPermission,
  uploadRateLimit,
  cleanupTempFiles
};