/**
 * 大模型服务主服务类
 * 提供统一的大模型调用接口，支持重试、缓存和提示模板
 */

import { LLMProviderFactory } from './LLMProvider.js';
import { llmConfig } from './LLMConfigManager.js';
import { logger } from '../utils/logger.js';

export class LLMService {
  constructor() {
    this.provider = null;
    this.cache = new Map();
    this.initialized = false;
  }

  /**
   * 初始化服务
   */
  async initialize(configPath = null) {
    try {
      await llmConfig.initialize(configPath);
      await this.createProvider();
      this.setupCache();
      this.initialized = true;
      logger.info('大模型服务初始化成功');
    } catch (error) {
      logger.error('大模型服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建提供商实例
   */
  async createProvider() {
    try {
      const providerConfig = llmConfig.getResolvedProvider();
      this.provider = LLMProviderFactory.createProvider(providerConfig);
      logger.info(`已创建大模型提供商: ${this.provider.name}`);
    } catch (error) {
      logger.error('创建大模型提供商失败:', error);
      throw error;
    }
  }

  /**
   * 设置缓存
   */
  setupCache() {
    const cacheConfig = llmConfig.getCacheConfig();
    if (cacheConfig.enabled) {
      this.cacheConfig = cacheConfig;
      logger.info('大模型响应缓存已启用');
    }
  }

  /**
   * 检查初始化状态
   */
  checkInitialized() {
    if (!this.initialized) {
      throw new Error('大模型服务未初始化，请先调用 initialize()');
    }
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(messages, options = {}) {
    const key = JSON.stringify({
      messages,
      model: options.model,
      temperature: options.temperature,
      max_tokens: options.max_tokens
    });
    return Buffer.from(key).toString('base64');
  }

  /**
   * 从缓存获取响应
   */
  getFromCache(cacheKey) {
    if (!this.cacheConfig?.enabled) {
      return null;
    }

    const cached = this.cache.get(cacheKey);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > this.cacheConfig.ttl * 1000) {
      this.cache.delete(cacheKey);
      return null;
    }

    logger.debug('从缓存获取大模型响应');
    return cached.response;
  }

  /**
   * 保存响应到缓存
   */
  saveToCache(cacheKey, response) {
    if (!this.cacheConfig?.enabled) {
      return;
    }

    // 检查缓存大小限制
    if (this.cache.size >= this.cacheConfig.max_size) {
      // 删除最旧的条目
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });

    logger.debug('已保存大模型响应到缓存');
  }

  /**
   * 执行带重试的请求
   */
  async executeWithRetry(operation, context = '') {
    const retryConfig = llmConfig.getRetryConfig();
    let lastError;

    for (let attempt = 1; attempt <= retryConfig.max_retries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt <= retryConfig.max_retries) {
          const delay = retryConfig.retry_delay * Math.pow(retryConfig.backoff_factor, attempt - 1);
          logger.warn(`${context} 第${attempt}次尝试失败，${delay}ms后重试`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * 基础聊天接口
   */
  async chat(messages, options = {}) {
    this.checkInitialized();

    const cacheKey = this.generateCacheKey(messages, options);
    
    // 尝试从缓存获取
    const cachedResponse = this.getFromCache(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    // 执行请求
    const response = await this.executeWithRetry(
      () => this.provider.chat(messages, options),
      '大模型聊天请求'
    );

    // 保存到缓存
    this.saveToCache(cacheKey, response);

    return response;
  }

  /**
   * 分析运维问题
   */
  async analyzeProblem(problemCategory, problemDescription, context = {}) {
    this.checkInitialized();

    const template = llmConfig.getPromptTemplate('problem_analysis');
    const prompt = template
      .replace('{category}', problemCategory)
      .replace('{description}', problemDescription);

    const messages = [
      {
        role: 'system',
        content: '你是一个专业的运维专家，擅长分析各种系统问题并提供详细的解决方案。请按照要求的格式返回结构化的分析结果。'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    logger.info('开始分析运维问题', {
      category: problemCategory,
      description: problemDescription.substring(0, 100) + '...'
    });

    const response = await this.chat(messages, {
      temperature: 0.3, // 降低随机性，确保分析准确性
      max_tokens: 2048
    });

    return {
      analysis: response.content,
      model: response.model,
      usage: response.usage,
      category: problemCategory,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 生成处置步骤
   */
  async generateSteps(currentStatus, completedSteps = [], userFeedback = '', context = {}) {
    this.checkInitialized();

    const template = llmConfig.getPromptTemplate('step_generation');
    const prompt = template
      .replace('{current_status}', currentStatus)
      .replace('{completed_steps}', JSON.stringify(completedSteps, null, 2))
      .replace('{user_feedback}', userFeedback);

    const messages = [
      {
        role: 'system',
        content: '你是一个运维处置专家，负责根据当前状态和用户反馈生成下一个具体的处置步骤。请提供清晰、可执行的操作指导。'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    logger.info('生成处置步骤', {
      completedStepsCount: completedSteps.length,
      hasFeedback: !!userFeedback
    });

    const response = await this.chat(messages, {
      temperature: 0.4,
      max_tokens: 1024
    });

    return {
      steps: response.content,
      model: response.model,
      usage: response.usage,
      context: currentStatus,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 评估执行结果
   */
  async evaluateResult(stepDescription, executionResult, context = {}) {
    this.checkInitialized();

    const template = llmConfig.getPromptTemplate('result_evaluation');
    const prompt = template
      .replace('{step_description}', stepDescription)
      .replace('{execution_result}', JSON.stringify(executionResult, null, 2));

    const messages = [
      {
        role: 'system',
        content: '你是一个运维结果评估专家，负责分析处置步骤的执行结果，判断是否成功，并提供后续建议。'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    logger.info('评估执行结果', {
      stepDescription: stepDescription.substring(0, 100) + '...'
    });

    const response = await this.chat(messages, {
      temperature: 0.2, // 更低的随机性，确保评估准确性
      max_tokens: 1024
    });

    return {
      evaluation: response.content,
      model: response.model,
      usage: response.usage,
      stepDescription,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 切换模型提供商
   */
  async switchProvider(providerName) {
    await llmConfig.switchProvider(providerName);
    await this.createProvider();
    this.cache.clear(); // 清除缓存
    logger.info(`已切换到模型提供商: ${providerName}`);
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      initialized: this.initialized,
      provider: this.provider ? {
        name: this.provider.name,
        type: this.provider.type,
        endpoint: this.provider.endpoint,
        models: this.provider.models
      } : null,
      cache: {
        enabled: !!this.cacheConfig?.enabled,
        size: this.cache.size,
        maxSize: this.cacheConfig?.max_size || 0
      }
    };
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear();
    logger.info('已清除大模型响应缓存');
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    this.checkInitialized();

    try {
      const testMessage = '这是一个健康检查测试消息，请回复"OK"';
      const response = await this.chat([{ role: 'user', content: testMessage }], {
        temperature: 0,
        max_tokens: 10
      });

      return {
        healthy: true,
        provider: this.provider.name,
        model: response.model,
        responseTime: response.usage?.total_tokens || 'unknown',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('大模型服务健康检查失败:', error);
      return {
        healthy: false,
        provider: this.provider?.name || 'unknown',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// 创建全局单例实例
export const llmService = new LLMService();

export default llmService;