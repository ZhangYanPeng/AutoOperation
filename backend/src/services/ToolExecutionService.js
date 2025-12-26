/**
 * 工具执行服务
 * 负责执行外部API调用和处理执行结果
 */

import axios from 'axios';
import { knowledgeBaseService } from './KnowledgeBaseService.js';
import { logger } from '../utils/logger.js';

export class ToolExecutionService {
  constructor() {
    this.initialized = false;
    this.executionHistory = new Map();
    this.toolCache = new Map();
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      retryBackoffFactor: 2
    };
  }

  /**
   * 初始化工具执行服务
   */
  async initialize(config = {}) {
    try {
      this.config = { ...this.config, ...config };
      
      // 确保知识库服务已初始化
      if (!knowledgeBaseService.initialized) {
        await knowledgeBaseService.initialize();
      }

      // 预加载设备API信息
      await this.preloadDeviceAPIs();

      this.initialized = true;
      logger.info('工具执行服务初始化成功', {
        loadedAPIs: this.toolCache.size,
        timeout: this.config.timeout
      });
    } catch (error) {
      logger.error('工具执行服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检查初始化状态
   */
  checkInitialized() {
    if (!this.initialized) {
      throw new Error('工具执行服务未初始化，请先调用 initialize()');
    }
  }

  /**
   * 预加载设备API信息
   */
  async preloadDeviceAPIs() {
    try {
      const apiResults = await knowledgeBaseService.search('', {
        type: 'device-api',
        limit: 100
      });

      for (const apiResult of apiResults.results) {
        const apiDetail = knowledgeBaseService.getKnowledgeEntry(apiResult.knowledge_id);
        if (apiDetail) {
          const parsedAPI = this.parseAPIDefinition(apiDetail);
          if (parsedAPI) {
            this.toolCache.set(apiResult.knowledge_id, parsedAPI);
          }
        }
      }

      logger.info(`已预加载 ${this.toolCache.size} 个设备API定义`);
    } catch (error) {
      logger.error('预加载设备API失败:', error);
      throw error;
    }
  }

  /**
   * 解析API定义
   */
  parseAPIDefinition(apiDetail) {
    try {
      const { content, metadata } = apiDetail;
      
      // 基本信息
      const api = {
        id: apiDetail.knowledge_id,
        title: apiDetail.title,
        method: metadata.method || 'GET',
        path: metadata.path || '',
        description: metadata.description || '',
        type: metadata.apiType || 'unknown'
      };

      // 解析API文档内容
      if (metadata.apiType === 'blueprint') {
        return this.parseAPIBlueprint(api, content);
      } else {
        return this.parseMarkdownAPI(api, content);
      }
    } catch (error) {
      logger.error(`解析API定义失败: ${apiDetail.knowledge_id}`, error);
      return null;
    }
  }

  /**
   * 解析API Blueprint格式
   */
  parseAPIBlueprint(api, content) {
    try {
      // 解析请求参数
      const parametersMatch = content.match(/\+ Parameters\s*([\s\S]*?)(?=\n\+|\n##|$)/);
      if (parametersMatch) {
        api.parameters = this.parseParameters(parametersMatch[1]);
      }

      // 解析请求体
      const requestMatch = content.match(/\+ Request[^(]*\(([^)]+)\)\s*([\s\S]*?)(?=\n\+|\n##|$)/);
      if (requestMatch) {
        api.requestContentType = requestMatch[1];
        api.requestBody = this.parseRequestBody(requestMatch[2]);
      }

      // 解析响应
      const responseMatch = content.match(/\+ Response\s+(\d+)[^(]*\(([^)]+)\)\s*([\s\S]*?)(?=\n\+|\n##|$)/);
      if (responseMatch) {
        api.responseStatusCode = parseInt(responseMatch[1]);
        api.responseContentType = responseMatch[2];
        api.responseBody = this.parseResponseBody(responseMatch[3]);
      }

      // 提取基础URL
      const hostMatch = content.match(/HOST:\s*(.+)/i);
      if (hostMatch) {
        api.baseURL = hostMatch[1].trim();
      }

      return api;
    } catch (error) {
      logger.error('解析API Blueprint失败:', error);
      return api;
    }
  }

  /**
   * 解析Markdown API格式
   */
  parseMarkdownAPI(api, content) {
    try {
      // 查找URL模式
      const urlMatch = content.match(/(?:URL|Endpoint|接口地址)[\s\:\：]*([^\s\n]+)/i);
      if (urlMatch) {
        api.baseURL = urlMatch[1];
      }

      // 查找参数说明
      const paramsSection = content.match(/(?:参数|Parameters|请求参数)([\s\S]*?)(?=\n#|响应|Response|$)/i);
      if (paramsSection) {
        api.parameters = this.parseMarkdownParameters(paramsSection[1]);
      }

      // 查找请求体说明
      const bodySection = content.match(/(?:请求体|Request Body|Body)([\s\S]*?)(?=\n#|响应|Response|$)/i);
      if (bodySection) {
        api.requestBody = this.parseMarkdownBody(bodySection[1]);
      }

      // 查找响应说明
      const responseSection = content.match(/(?:响应|Response|返回)([\s\S]*?)(?=\n#|$)/i);
      if (responseSection) {
        api.responseBody = this.parseMarkdownBody(responseSection[1]);
      }

      return api;
    } catch (error) {
      logger.error('解析Markdown API失败:', error);
      return api;
    }
  }

  /**
   * 解析参数
   */
  parseParameters(parameterText) {
    const parameters = [];
    const lines = parameterText.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('+') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        const paramMatch = trimmedLine.match(/[\+\-\*]\s*([^:\(]+)[\:\(]?\s*([^)]*)\)?\s*-?\s*(.*)/);
        if (paramMatch) {
          parameters.push({
            name: paramMatch[1].trim(),
            type: paramMatch[2].trim() || 'string',
            description: paramMatch[3].trim(),
            required: trimmedLine.includes('required') || trimmedLine.includes('必需')
          });
        }
      }
    }
    
    return parameters;
  }

  /**
   * 解析Markdown参数
   */
  parseMarkdownParameters(paramText) {
    const parameters = [];
    
    // 查找表格格式
    const tableMatch = paramText.match(/\|([^|]+\|[^|]+\|[^|]+)\|/g);
    if (tableMatch) {
      for (const row of tableMatch.slice(1)) { // 跳过表头
        const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);
        if (cells.length >= 2) {
          parameters.push({
            name: cells[0],
            type: cells[1] || 'string',
            description: cells[2] || '',
            required: cells[3]?.includes('是') || cells[3]?.includes('true') || false
          });
        }
      }
    }
    
    return parameters;
  }

  /**
   * 解析请求体
   */
  parseRequestBody(bodyText) {
    try {
      // 尝试解析JSON
      const jsonMatch = bodyText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // 返回原始文本
      return bodyText.trim();
    } catch (error) {
      return bodyText.trim();
    }
  }

  /**
   * 解析响应体
   */
  parseResponseBody(responseText) {
    try {
      // 尝试解析JSON
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      return responseText.trim();
    } catch (error) {
      return responseText.trim();
    }
  }

  /**
   * 解析Markdown Body
   */
  parseMarkdownBody(bodyText) {
    try {
      const jsonMatch = bodyText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch {
          return jsonMatch[1].trim();
        }
      }
      return bodyText.trim();
    } catch (error) {
      return bodyText.trim();
    }
  }

  /**
   * 执行工具API
   */
  async executeAPI(apiId, parameters = {}, options = {}) {
    this.checkInitialized();

    try {
      const apiDefinition = this.toolCache.get(apiId);
      if (!apiDefinition) {
        throw new Error(`API定义不存在: ${apiId}`);
      }

      logger.info('开始执行API工具', {
        apiId,
        title: apiDefinition.title,
        method: apiDefinition.method,
        parametersCount: Object.keys(parameters).length
      });

      // 验证参数
      this.validateParameters(apiDefinition, parameters);

      // 构建请求
      const request = this.buildRequest(apiDefinition, parameters, options);

      // 执行请求（带重试）
      const result = await this.executeWithRetry(request, apiDefinition);

      // 记录执行历史
      this.recordExecution(apiId, parameters, result);

      logger.info('API工具执行成功', {
        apiId,
        statusCode: result.statusCode,
        duration: result.duration
      });

      return result;
    } catch (error) {
      logger.error('API工具执行失败:', error);
      
      // 记录失败的执行
      this.recordExecution(apiId, parameters, { error: error.message, success: false });
      
      throw error;
    }
  }

  /**
   * 验证参数
   */
  validateParameters(apiDefinition, parameters) {
    if (!apiDefinition.parameters) {
      return;
    }

    const errors = [];

    for (const param of apiDefinition.parameters) {
      if (param.required && !(param.name in parameters)) {
        errors.push(`缺少必需参数: ${param.name}`);
      }

      if (param.name in parameters) {
        const value = parameters[param.name];
        
        // 简单类型验证
        if (param.type === 'number' && isNaN(Number(value))) {
          errors.push(`参数 ${param.name} 应为数字类型`);
        } else if (param.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`参数 ${param.name} 应为布尔类型`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`参数验证失败: ${errors.join(', ')}`);
    }
  }

  /**
   * 构建请求
   */
  buildRequest(apiDefinition, parameters, options) {
    const { baseURL, path, method } = apiDefinition;
    
    // 构建完整URL
    let fullURL = baseURL || '';
    if (path) {
      if (fullURL && !fullURL.endsWith('/') && !path.startsWith('/')) {
        fullURL += '/';
      }
      fullURL += path;
    }

    // 替换路径参数
    for (const [key, value] of Object.entries(parameters)) {
      fullURL = fullURL.replace(`{${key}}`, encodeURIComponent(value));
      fullURL = fullURL.replace(`:${key}`, encodeURIComponent(value));
    }

    // 构建请求配置
    const requestConfig = {
      url: fullURL,
      method: method.toLowerCase(),
      timeout: options.timeout || this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'intelligent-operation-assistant/1.0.0',
        ...options.headers
      }
    };

    // 处理查询参数和请求体
    if (method.toUpperCase() === 'GET') {
      requestConfig.params = parameters;
    } else {
      requestConfig.data = parameters;
    }

    return requestConfig;
  }

  /**
   * 执行带重试的请求
   */
  async executeWithRetry(requestConfig, apiDefinition) {
    let lastError;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        const response = await axios(requestConfig);
        
        const duration = Date.now() - startTime;
        
        return {
          success: true,
          statusCode: response.status,
          headers: response.headers,
          data: response.data,
          duration,
          attempt,
          apiDefinition: {
            id: apiDefinition.id,
            title: apiDefinition.title,
            method: apiDefinition.method
          }
        };
      } catch (error) {
        lastError = error;
        
        if (attempt <= this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(this.config.retryBackoffFactor, attempt - 1);
          logger.warn(`API调用失败，第${attempt}次尝试，${delay}ms后重试`, {
            error: error.message,
            apiId: apiDefinition.id
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // 所有重试都失败了
    const duration = Date.now() - startTime;
    throw new Error(`API调用失败（已重试${this.config.maxRetries}次）: ${lastError.message}`);
  }

  /**
   * 记录执行历史
   */
  recordExecution(apiId, parameters, result) {
    const execution = {
      apiId,
      parameters,
      result,
      timestamp: new Date().toISOString()
    };

    if (!this.executionHistory.has(apiId)) {
      this.executionHistory.set(apiId, []);
    }

    const history = this.executionHistory.get(apiId);
    history.push(execution);

    // 限制历史记录数量
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools() {
    this.checkInitialized();

    const tools = [];
    for (const [id, api] of this.toolCache) {
      tools.push({
        id,
        title: api.title,
        method: api.method,
        path: api.path,
        description: api.description,
        parameters: api.parameters || [],
        usage_count: this.getToolUsageCount(id)
      });
    }

    return tools.sort((a, b) => b.usage_count - a.usage_count);
  }

  /**
   * 获取工具使用次数
   */
  getToolUsageCount(apiId) {
    const history = this.executionHistory.get(apiId);
    return history ? history.length : 0;
  }

  /**
   * 获取工具详情
   */
  getToolDetails(apiId) {
    this.checkInitialized();

    const api = this.toolCache.get(apiId);
    if (!api) {
      return null;
    }

    const history = this.executionHistory.get(apiId) || [];
    const successfulExecutions = history.filter(h => h.result.success);

    return {
      ...api,
      statistics: {
        total_executions: history.length,
        successful_executions: successfulExecutions.length,
        success_rate: history.length > 0 ? successfulExecutions.length / history.length : 0,
        last_execution: history.length > 0 ? history[history.length - 1].timestamp : null
      },
      recent_executions: history.slice(-10).map(h => ({
        timestamp: h.timestamp,
        success: h.result.success,
        duration: h.result.duration,
        parameters: h.parameters
      }))
    };
  }

  /**
   * 测试工具连接
   */
  async testTool(apiId, testParameters = {}) {
    this.checkInitialized();

    try {
      const result = await this.executeAPI(apiId, testParameters, { timeout: 5000 });
      
      return {
        success: true,
        message: 'API连接测试成功',
        statusCode: result.statusCode,
        duration: result.duration
      };
    } catch (error) {
      return {
        success: false,
        message: 'API连接测试失败',
        error: error.message
      };
    }
  }

  /**
   * 获取执行历史
   */
  getExecutionHistory(apiId = null, limit = 50) {
    this.checkInitialized();

    if (apiId) {
      const history = this.executionHistory.get(apiId) || [];
      return history.slice(-limit);
    }

    // 返回所有API的执行历史
    const allHistory = [];
    for (const [id, history] of this.executionHistory) {
      allHistory.push(...history.map(h => ({ ...h, apiId: id })));
    }

    return allHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * 清除执行历史
   */
  clearExecutionHistory(apiId = null) {
    if (apiId) {
      this.executionHistory.delete(apiId);
      logger.info(`已清除API执行历史: ${apiId}`);
    } else {
      this.executionHistory.clear();
      logger.info('已清除所有API执行历史');
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      initialized: this.initialized,
      loadedAPIs: this.toolCache.size,
      totalExecutions: Array.from(this.executionHistory.values()).reduce((sum, history) => sum + history.length, 0),
      config: this.config
    };
  }
}

// 创建全局单例实例
export const toolExecutionService = new ToolExecutionService();

export default toolExecutionService;