/**
 * 请求验证中间件
 * 验证请求参数和数据格式
 */

import { ValidationError } from './errorHandler.js';
import { logger } from './logger.js';

// 通用验证函数
const validateRequired = (data, fields) => {
  const missing = [];
  
  fields.forEach(field => {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  });
  
  if (missing.length > 0) {
    throw new ValidationError(`缺少必需字段: ${missing.join(', ')}`);
  }
};

const validateTypes = (data, schema) => {
  Object.keys(schema).forEach(field => {
    const value = data[field];
    const expectedType = schema[field];
    
    if (value !== undefined && typeof value !== expectedType) {
      throw new ValidationError(`字段 ${field} 类型错误，期望 ${expectedType}，实际 ${typeof value}`);
    }
  });
};

const validateLength = (data, constraints) => {
  Object.keys(constraints).forEach(field => {
    const value = data[field];
    const { min, max } = constraints[field];
    
    if (value !== undefined) {
      const length = typeof value === 'string' ? value.length : 0;
      
      if (min !== undefined && length < min) {
        throw new ValidationError(`字段 ${field} 长度不能少于 ${min} 个字符`);
      }
      
      if (max !== undefined && length > max) {
        throw new ValidationError(`字段 ${field} 长度不能超过 ${max} 个字符`);
      }
    }
  });
};

const validateEnum = (data, enums) => {
  Object.keys(enums).forEach(field => {
    const value = data[field];
    const allowedValues = enums[field];
    
    if (value !== undefined && !allowedValues.includes(value)) {
      throw new ValidationError(`字段 ${field} 值无效，允许的值: ${allowedValues.join(', ')}`);
    }
  });
};

// 会话创建验证
const validateSessionCreation = (req, res, next) => {
  try {
    const { problem_description, problem_category } = req.body;
    
    // 验证必需字段
    validateRequired(req.body, ['problem_description', 'problem_category']);
    
    // 验证数据类型
    validateTypes(req.body, {
      problem_description: 'string',
      problem_category: 'string'
    });
    
    // 验证长度
    validateLength(req.body, {
      problem_description: { min: 10, max: 2000 },
      problem_category: { min: 1, max: 50 }
    });
    
    // 验证枚举值
    validateEnum(req.body, {
      problem_category: ['performance', 'network', 'service', 'security', 'storage', 'other']
    });
    
    next();
  } catch (error) {
    next(error);
  }
};

// 步骤执行验证
const validateStepExecution = (req, res, next) => {
  try {
    const { stepId, executionType } = req.body;
    
    validateRequired(req.body, ['stepId', 'executionType']);
    
    validateTypes(req.body, {
      stepId: 'string',
      executionType: 'string',
      userInput: 'string'
    });
    
    validateEnum(req.body, {
      executionType: ['auto', 'manual']
    });
    
    // 如果是手动执行，验证用户输入
    if (executionType === 'manual') {
      validateRequired(req.body, ['userInput']);
      validateLength(req.body, {
        userInput: { min: 1, max: 1000 }
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// 反馈提交验证
const validateFeedback = (req, res, next) => {
  try {
    const { stepId, feedback } = req.body;
    
    validateRequired(req.body, ['stepId', 'feedback']);
    
    validateTypes(req.body, {
      stepId: 'string',
      feedback: 'string'
    });
    
    validateLength(req.body, {
      feedback: { min: 1, max: 2000 }
    });
    
    next();
  } catch (error) {
    next(error);
  }
};

// 知识库搜索验证
const validateKnowledgeSearch = (req, res, next) => {
  try {
    const { query } = req.query;
    
    if (query) {
      validateTypes({ query }, { query: 'string' });
      validateLength({ query }, {
        query: { min: 1, max: 200 }
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// 会话搜索验证
const validateSessionSearch = (req, res, next) => {
  try {
    const { query, status, category, limit, offset } = req.query;
    
    if (query) {
      validateTypes({ query }, { query: 'string' });
      validateLength({ query }, {
        query: { min: 1, max: 200 }
      });
    }
    
    if (status) {
      validateEnum({ status }, {
        status: ['processing', 'completed', 'aborted']
      });
    }
    
    if (category) {
      validateEnum({ category }, {
        category: ['performance', 'network', 'service', 'security', 'storage', 'other']
      });
    }
    
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new ValidationError('limit 参数必须是 1-100 之间的数字');
      }
    }
    
    if (offset) {
      const offsetNum = parseInt(offset, 10);
      if (isNaN(offsetNum) || offsetNum < 0) {
        throw new ValidationError('offset 参数必须是非负数');
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// 工具执行验证
const validateToolExecution = (req, res, next) => {
  try {
    const { toolName, parameters } = req.body;
    
    validateRequired(req.body, ['toolName']);
    
    validateTypes(req.body, {
      toolName: 'string',
      parameters: 'object'
    });
    
    validateLength(req.body, {
      toolName: { min: 1, max: 100 }
    });
    
    next();
  } catch (error) {
    next(error);
  }
};

// UUID 参数验证
const validateUUID = (paramName) => {
  return (req, res, next) => {
    try {
      const uuid = req.params[paramName];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (!uuidRegex.test(uuid)) {
        throw new ValidationError(`无效的 ${paramName} 格式`);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

// 请求体不为空验证
const validateNotEmpty = (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!req.body || Object.keys(req.body).length === 0) {
      return next(new ValidationError('请求体不能为空'));
    }
  }
  next();
};

// 内容类型验证
const validateContentType = (expectedType = 'application/json') => {
  return (req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT') {
      const contentType = req.get('Content-Type');
      
      if (!contentType || !contentType.includes(expectedType)) {
        return next(new ValidationError(`期望的 Content-Type: ${expectedType}`));
      }
    }
    next();
  };
};

export {
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