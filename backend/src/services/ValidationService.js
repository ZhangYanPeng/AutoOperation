/**
 * 验证服务
 * 负责文件、文档内容和元数据的验证
 */

import path from 'path';
import { logger } from '../utils/logger.js';

export class ValidationService {
  constructor() {
    // 支持的文件类型
    this.allowedMimeTypes = [
      'text/markdown',
      'text/plain',
      'application/octet-stream'
    ];
    
    // 支持的文件扩展名
    this.allowedExtensions = ['.md', '.markdown', '.txt'];
    
    // 文件大小限制 (5MB)
    this.maxFileSize = 5 * 1024 * 1024;
    
    // 内容长度限制
    this.maxContentLength = 1000000; // 1MB 文本内容
    this.minContentLength = 10;
    
    // 必需的元数据字段
    this.requiredFields = ['title', 'knowledge_type'];
    
    // 危险内容模式
    this.dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /onload\s*=/gi,
      /onclick\s*=/gi,
      /onerror\s*=/gi
    ];
  }

  /**
   * 验证上传文件
   */
  async validateFile(file) {
    const errors = [];
    
    try {
      // 检查文件是否存在
      if (!file) {
        errors.push('文件不能为空');
        return { isValid: false, errors };
      }

      // 验证文件名
      const filenameValidation = this.validateFilename(file.originalname);
      if (!filenameValidation.isValid) {
        errors.push(...filenameValidation.errors);
      }

      // 验证文件大小
      const sizeValidation = this.validateFileSize(file.size);
      if (!sizeValidation.isValid) {
        errors.push(...sizeValidation.errors);
      }

      // 验证文件类型
      const typeValidation = this.validateFileType(file);
      if (!typeValidation.isValid) {
        errors.push(...typeValidation.errors);
      }

      // 验证文件内容
      if (file.buffer || file.path) {
        const contentValidation = await this.validateFileContent(file);
        if (!contentValidation.isValid) {
          errors.push(...contentValidation.errors);
        }
      }

      logger.info('文件验证完成', { 
        filename: file.originalname,
        valid: errors.length === 0,
        errors: errors.length 
      });

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      logger.error('文件验证失败:', error);
      return {
        isValid: false,
        errors: ['文件验证过程中发生错误']
      };
    }
  }

  /**
   * 验证文件名
   */
  validateFilename(filename) {
    const errors = [];

    if (!filename || filename.trim() === '') {
      errors.push('文件名不能为空');
      return { isValid: false, errors };
    }

    // 检查文件扩展名
    const extension = path.extname(filename).toLowerCase();
    if (!this.allowedExtensions.includes(extension)) {
      errors.push(`不支持的文件类型。支持的格式: ${this.allowedExtensions.join(', ')}`);
    }

    // 检查文件名长度
    if (filename.length > 255) {
      errors.push('文件名过长，最大长度为255个字符');
    }

    // 检查危险字符
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
      errors.push('文件名包含非法字符');
    }

    // 检查保留名称
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const nameWithoutExt = path.basename(filename, extension).toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) {
      errors.push('文件名不能使用系统保留名称');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证文件大小
   */
  validateFileSize(size) {
    const errors = [];

    if (typeof size !== 'number' || size < 0) {
      errors.push('无效的文件大小');
      return { isValid: false, errors };
    }

    if (size === 0) {
      errors.push('文件不能为空');
    }

    if (size > this.maxFileSize) {
      const maxSizeMB = (this.maxFileSize / (1024 * 1024)).toFixed(1);
      errors.push(`文件大小超过限制，最大允许 ${maxSizeMB}MB`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证文件类型
   */
  validateFileType(file) {
    const errors = [];

    // 基于扩展名验证
    const extension = path.extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.includes(extension)) {
      errors.push(`不支持的文件扩展名: ${extension}`);
    }

    // 基于MIME类型验证
    if (file.mimetype && !this.allowedMimeTypes.includes(file.mimetype)) {
      // 对于 .md 文件，有时会被识别为 application/octet-stream
      if (extension === '.md' && file.mimetype === 'application/octet-stream') {
        // 允许这种情况
      } else {
        errors.push(`不支持的MIME类型: ${file.mimetype}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证文件内容
   */
  async validateFileContent(file) {
    const errors = [];

    try {
      let content;
      
      if (file.buffer) {
        content = file.buffer.toString('utf8');
      } else if (file.path) {
        const fs = await import('fs/promises');
        content = await fs.readFile(file.path, 'utf8');
      } else {
        errors.push('无法读取文件内容');
        return { isValid: false, errors };
      }

      // 验证内容长度
      const lengthValidation = this.validateContentLength(content);
      if (!lengthValidation.isValid) {
        errors.push(...lengthValidation.errors);
      }

      // 验证内容格式
      const formatValidation = this.validateMarkdownStructure(content);
      if (!formatValidation.isValid) {
        errors.push(...formatValidation.errors);
      }

      // 检查恶意内容
      const securityValidation = this.checkMaliciousContent(content);
      if (!securityValidation.isValid) {
        errors.push(...securityValidation.errors);
      }

      // 验证文本编码
      const encodingValidation = this.validateTextEncoding(content);
      if (!encodingValidation.isValid) {
        errors.push(...encodingValidation.errors);
      }

    } catch (error) {
      logger.error('验证文件内容失败:', error);
      errors.push('文件内容读取失败');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证内容长度
   */
  validateContentLength(content) {
    const errors = [];

    if (!content || content.trim() === '') {
      errors.push('文件内容不能为空');
      return { isValid: false, errors };
    }

    if (content.length < this.minContentLength) {
      errors.push(`文件内容过短，至少需要 ${this.minContentLength} 个字符`);
    }

    if (content.length > this.maxContentLength) {
      const maxSizeKB = (this.maxContentLength / 1024).toFixed(1);
      errors.push(`文件内容过长，最大允许 ${maxSizeKB}KB`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证Markdown结构
   */
  validateMarkdownStructure(content) {
    const errors = [];
    const warnings = [];

    try {
      // 检查是否有标题
      const hasTitle = /^#{1,6}\s+.+$/m.test(content);
      if (!hasTitle) {
        warnings.push('建议添加标题（# 标题）');
      }

      // 检查代码块是否正确闭合
      const codeBlockMatches = content.match(/```/g);
      if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
        errors.push('代码块未正确闭合，请检查 ``` 标记');
      }

      // 检查链接格式
      const malformedLinks = content.match(/\[([^\]]*)\]\(\s*\)/g);
      if (malformedLinks && malformedLinks.length > 0) {
        warnings.push('发现空链接，请检查链接格式');
      }

      // 检查表格格式
      const tableRows = content.split('\n').filter(line => line.includes('|'));
      for (let i = 0; i < tableRows.length - 1; i++) {
        const currentCols = tableRows[i].split('|').length;
        const nextCols = tableRows[i + 1].split('|').length;
        if (Math.abs(currentCols - nextCols) > 1) {
          warnings.push('表格列数不一致，可能影响渲染效果');
          break;
        }
      }

      // 检查内容结构
      const lines = content.split('\n');
      const nonEmptyLines = lines.filter(line => line.trim() !== '');
      if (nonEmptyLines.length < 3) {
        warnings.push('文档内容较少，建议添加更多详细信息');
      }

    } catch (error) {
      logger.warn('Markdown结构验证失败:', error);
      warnings.push('无法完全验证Markdown结构');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 检查恶意内容
   */
  checkMaliciousContent(content) {
    const errors = [];

    // 检查危险脚本模式
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(content)) {
        errors.push('文档包含可能的恶意脚本内容');
        break;
      }
    }

    // 检查SQL注入模式
    const sqlPatterns = [
      /('|(\\\\')|('')|("|(\\\\")|(""))).*?(or|and)\s*(\w|\d)+\s*[=|>|<]/i,
      /(union\s*select|insert\s*into|delete\s*from|update\s*set)/i
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(content)) {
        errors.push('文档包含可能的SQL注入模式');
        break;
      }
    }

    // 检查过多的重复内容
    const repeatedPattern = /(.{10,}?)\1{5,}/;
    if (repeatedPattern.test(content)) {
      errors.push('文档包含大量重复内容，可能是垃圾内容');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证文本编码
   */
  validateTextEncoding(content) {
    const errors = [];

    try {
      // 检查是否包含二进制数据
      const binaryPattern = /[\x00-\x08\x0E-\x1F\x7F]/;
      if (binaryPattern.test(content)) {
        errors.push('文件包含二进制数据，请使用纯文本格式');
      }

      // 检查是否包含过多的控制字符
      const controlChars = content.match(/[\x00-\x1F]/g);
      if (controlChars && controlChars.length > content.length * 0.1) {
        errors.push('文件包含过多控制字符，可能不是有效的文本文件');
      }

    } catch (error) {
      logger.warn('文本编码验证失败:', error);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证元数据
   */
  validateMetadata(metadata) {
    const errors = [];

    if (!metadata || typeof metadata !== 'object') {
      errors.push('元数据必须是有效的对象');
      return { isValid: false, errors };
    }

    // 检查必需字段
    for (const field of this.requiredFields) {
      if (!metadata[field] || metadata[field].toString().trim() === '') {
        errors.push(`缺少必需字段: ${field}`);
      }
    }

    // 验证知识类型
    const validTypes = ['operation-procedure', 'device-api'];
    if (metadata.knowledge_type && !validTypes.includes(metadata.knowledge_type)) {
      errors.push(`无效的知识类型: ${metadata.knowledge_type}`);
    }

    // 验证优先级
    if (metadata.priority !== undefined) {
      const priority = parseInt(metadata.priority);
      if (isNaN(priority) || priority < 0 || priority > 10) {
        errors.push('优先级必须是0-10之间的数字');
      }
    }

    // 验证标签
    if (metadata.tags && Array.isArray(metadata.tags)) {
      if (metadata.tags.length > 20) {
        errors.push('标签数量不能超过20个');
      }
      
      for (const tag of metadata.tags) {
        if (typeof tag !== 'string' || tag.length > 50) {
          errors.push('标签必须是字符串且长度不超过50个字符');
          break;
        }
      }
    }

    // 验证关键词
    if (metadata.keywords && Array.isArray(metadata.keywords)) {
      if (metadata.keywords.length > 50) {
        errors.push('关键词数量不能超过50个');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证必需字段
   */
  validateRequiredFields(data) {
    const errors = [];

    for (const field of this.requiredFields) {
      if (!data[field] || data[field].toString().trim() === '') {
        errors.push(`缺少必需字段: ${field}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 清理和净化内容
   */
  sanitizeContent(content) {
    if (!content || typeof content !== 'string') {
      return '';
    }

    // 移除危险的HTML标签和脚本
    let sanitized = content;
    
    for (const pattern of this.dangerousPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    // 清理控制字符（保留换行和制表符）
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 限制连续空行
    sanitized = sanitized.replace(/
{4,}/g, '


');

    // 清理行尾空格
    sanitized = sanitized.replace(/ +$/gm, '');

    return sanitized;
  }

  /**
   * 自动提取关键词
   */
  extractKeywordsAutomatically(content) {
    if (!content || typeof content !== 'string') {
      return [];
    }

    const keywords = new Set();
    
    try {
      // 提取标题中的关键词
      const headers = content.match(/#{1,6}\s+(.+)/g) || [];
      headers.forEach(header => {
        const text = header.replace(/#{1,6}\s+/, '');
        const words = text.split(/\s+/).filter(word => word.length > 2);
        words.forEach(word => keywords.add(word.toLowerCase()));
      });

      // 提取代码块中的技术术语
      const codeBlocks = content.match(/`([^`]+)`/g) || [];
      codeBlocks.forEach(block => {
        const code = block.replace(/`/g, '');
        if (code.length > 2 && code.length < 30) {
          keywords.add(code.toLowerCase());
        }
      });

      // 提取粗体文本中的关键词
      const boldText = content.match(/\*\*([^*]+)\*\*/g) || [];
      boldText.forEach(text => {
        const cleaned = text.replace(/\*\*/g, '');
        if (cleaned.length > 2 && cleaned.length < 30) {
          keywords.add(cleaned.toLowerCase());
        }
      });

      // 提取链接文本中的关键词
      const links = content.match(/\[([^\]]+)\]/g) || [];
      links.forEach(link => {
        const text = link.replace(/[\[\]]/g, '');
        if (text.length > 2 && text.length < 30) {
          keywords.add(text.toLowerCase());
        }
      });

    } catch (error) {
      logger.warn('自动提取关键词失败:', error);
    }

    return Array.from(keywords).slice(0, 20);
  }

  /**
   * 验证批量操作
   */
  validateBatchOperation(operation, knowledgeIds, options = {}) {
    const errors = [];

    // 验证操作类型
    const validOperations = ['delete', 'archive', 'publish', 'move'];
    if (!validOperations.includes(operation)) {
      errors.push(`无效的批量操作类型: ${operation}`);
    }

    // 验证ID数组
    if (!Array.isArray(knowledgeIds) || knowledgeIds.length === 0) {
      errors.push('知识条目ID数组不能为空');
    } else {
      // 检查ID格式
      const invalidIds = knowledgeIds.filter(id => !id || typeof id !== 'string');
      if (invalidIds.length > 0) {
        errors.push('包含无效的知识条目ID');
      }

      // 检查批量操作数量限制
      if (knowledgeIds.length > 100) {
        errors.push('单次批量操作不能超过100个条目');
      }
    }

    // 验证特定操作的选项
    if (operation === 'move') {
      if (!options.targetCategory) {
        errors.push('移动操作需要指定目标分类');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default ValidationService;