/**
 * 大模型服务提供商接口
 * 统一不同大模型提供商的调用接口
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';

export class LLMProvider {
  constructor(config) {
    this.config = config;
    this.name = config.name;
    this.type = config.type;
    this.endpoint = config.endpoint;
    this.models = config.models;
    this.parameters = config.parameters || {};
  }

  /**
   * 发送聊天请求（需要子类实现）
   */
  async chat(messages, options = {}) {
    throw new Error('chat method must be implemented by subclass');
  }

  /**
   * 验证配置
   */
  validateConfig() {
    if (!this.endpoint) {
      throw new Error(`${this.name}: 缺少端点配置`);
    }
    if (!this.models || !this.models.primary) {
      throw new Error(`${this.name}: 缺少主要模型配置`);
    }
  }

  /**
   * 创建HTTP客户端
   */
  createHttpClient(timeout = 30000) {
    return axios.create({
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'intelligent-operation-assistant/1.0.0'
      }
    });
  }

  /**
   * 处理错误响应
   */
  handleError(error, context = '') {
    let errorMessage = `${this.name} API调用失败`;
    
    if (context) {
      errorMessage += ` (${context})`;
    }

    if (error.response) {
      errorMessage += `: HTTP ${error.response.status} - ${error.response.data?.error || error.response.statusText}`;
    } else if (error.request) {
      errorMessage += ': 网络请求失败';
    } else {
      errorMessage += `: ${error.message}`;
    }

    logger.error(errorMessage, {
      provider: this.name,
      context,
      error: error.message,
      stack: error.stack
    });

    throw new Error(errorMessage);
  }

  /**
   * 格式化消息
   */
  formatMessages(messages) {
    if (!Array.isArray(messages)) {
      return [{ role: 'user', content: messages }];
    }
    return messages;
  }

  /**
   * 合并参数
   */
  mergeParameters(options = {}) {
    return {
      ...this.parameters,
      ...options
    };
  }
}

/**
 * Ollama 提供商实现
 */
export class OllamaProvider extends LLMProvider {
  constructor(config) {
    super(config);
    this.validateConfig();
  }

  async chat(messages, options = {}) {
    try {
      const client = this.createHttpClient(this.parameters.timeout);
      const formattedMessages = this.formatMessages(messages);
      const parameters = this.mergeParameters(options);
      
      const requestData = {
        model: options.model || this.models.primary,
        messages: formattedMessages,
        stream: false,
        options: {
          temperature: parameters.temperature,
          top_p: parameters.top_p,
          num_predict: parameters.max_tokens
        }
      };

      logger.info(`发送Ollama请求: ${this.endpoint}/api/chat`, {
        model: requestData.model,
        messageCount: formattedMessages.length
      });

      const response = await client.post(`${this.endpoint}/api/chat`, requestData);
      
      if (!response.data || !response.data.message) {
        throw new Error('Ollama响应格式无效');
      }

      const result = {
        content: response.data.message.content,
        model: requestData.model,
        usage: {
          prompt_tokens: response.data.prompt_eval_count || 0,
          completion_tokens: response.data.eval_count || 0,
          total_tokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0)
        },
        finish_reason: response.data.done ? 'stop' : 'length'
      };

      logger.info('Ollama请求成功', {
        model: result.model,
        tokens: result.usage.total_tokens
      });

      return result;
    } catch (error) {
      this.handleError(error, 'chat');
    }
  }

  /**
   * 检查模型是否可用
   */
  async checkModelAvailability(modelName = null) {
    try {
      const client = this.createHttpClient(5000);
      const response = await client.get(`${this.endpoint}/api/tags`);
      
      const availableModels = response.data.models || [];
      const modelToCheck = modelName || this.models.primary;
      
      const isAvailable = availableModels.some(model => 
        model.name === modelToCheck || model.name.startsWith(modelToCheck + ':')
      );

      return {
        available: isAvailable,
        model: modelToCheck,
        availableModels: availableModels.map(m => m.name)
      };
    } catch (error) {
      logger.warn('无法检查Ollama模型可用性', error.message);
      return { available: false, model: modelName, error: error.message };
    }
  }
}

/**
 * OpenAI 提供商实现
 */
export class OpenAIProvider extends LLMProvider {
  constructor(config) {
    super(config);
    if (!config.api_key) {
      throw new Error('OpenAI: 缺少API密钥配置');
    }
    this.apiKey = config.api_key;
    this.validateConfig();
  }

  async chat(messages, options = {}) {
    try {
      const client = this.createHttpClient(this.parameters.timeout);
      client.defaults.headers['Authorization'] = `Bearer ${this.apiKey}`;
      
      const formattedMessages = this.formatMessages(messages);
      const parameters = this.mergeParameters(options);
      
      const requestData = {
        model: options.model || this.models.primary,
        messages: formattedMessages,
        temperature: parameters.temperature,
        max_tokens: parameters.max_tokens,
        top_p: parameters.top_p
      };

      logger.info(`发送OpenAI请求: ${this.endpoint}/chat/completions`, {
        model: requestData.model,
        messageCount: formattedMessages.length
      });

      const response = await client.post(`${this.endpoint}/chat/completions`, requestData);
      
      if (!response.data || !response.data.choices || response.data.choices.length === 0) {
        throw new Error('OpenAI响应格式无效');
      }

      const choice = response.data.choices[0];
      const result = {
        content: choice.message.content,
        model: response.data.model,
        usage: response.data.usage || {},
        finish_reason: choice.finish_reason
      };

      logger.info('OpenAI请求成功', {
        model: result.model,
        tokens: result.usage.total_tokens
      });

      return result;
    } catch (error) {
      this.handleError(error, 'chat');
    }
  }
}

/**
 * Azure OpenAI 提供商实现
 */
export class AzureOpenAIProvider extends LLMProvider {
  constructor(config) {
    super(config);
    if (!config.api_key) {
      throw new Error('Azure OpenAI: 缺少API密钥配置');
    }
    if (!config.deployment_id) {
      throw new Error('Azure OpenAI: 缺少部署ID配置');
    }
    this.apiKey = config.api_key;
    this.deploymentId = config.deployment_id;
    this.validateConfig();
  }

  async chat(messages, options = {}) {
    try {
      const client = this.createHttpClient(this.parameters.timeout);
      client.defaults.headers['api-key'] = this.apiKey;
      
      const formattedMessages = this.formatMessages(messages);
      const parameters = this.mergeParameters(options);
      
      const requestData = {
        messages: formattedMessages,
        temperature: parameters.temperature,
        max_tokens: parameters.max_tokens,
        top_p: parameters.top_p
      };

      const url = `${this.endpoint}/openai/deployments/${this.deploymentId}/chat/completions?api-version=2023-05-15`;
      
      logger.info(`发送Azure OpenAI请求: ${url}`, {
        deployment: this.deploymentId,
        messageCount: formattedMessages.length
      });

      const response = await client.post(url, requestData);
      
      if (!response.data || !response.data.choices || response.data.choices.length === 0) {
        throw new Error('Azure OpenAI响应格式无效');
      }

      const choice = response.data.choices[0];
      const result = {
        content: choice.message.content,
        model: this.deploymentId,
        usage: response.data.usage || {},
        finish_reason: choice.finish_reason
      };

      logger.info('Azure OpenAI请求成功', {
        deployment: result.model,
        tokens: result.usage.total_tokens
      });

      return result;
    } catch (error) {
      this.handleError(error, 'chat');
    }
  }
}

/**
 * Mock 提供商实现（用于测试和开发）
 */
export class MockProvider extends LLMProvider {
  constructor(config) {
    super(config);
    this.name = 'Mock Provider';
    this.type = 'mock';
  }

  // Mock 提供商不需要验证端点
  validateConfig() {
    if (!this.models || !this.models.primary) {
      throw new Error(`${this.name}: 缺少主要模型配置`);
    }
  }

  async chat(messages, options = {}) {
    // 模拟等待时间
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const formattedMessages = this.formatMessages(messages);
    const lastMessage = formattedMessages[formattedMessages.length - 1];
    
    // 生成模拟响应
    let content = '这是一个模拟响应。根据您的问题：';
    
    if (lastMessage.content.includes('问题分类')) {
      content = `
## 问题分析
根据您描述的问题，初步分析如下：

## 处置步骤
1. **查看系统状态** - 检查系统资源使用情况
2. **排查日志** - 查看相关错误日志
3. **重启服务** - 必要时重启相关服务

## 注意事项
- 操作前请备份重要数据
- 遵循变更管理流程
- 实时监控系统状态
      `;
    }
    
    logger.info('Mock Provider生成响应', {
      messageCount: formattedMessages.length,
      contentLength: content.length
    });

    return {
      content,
      model: 'mock-model',
      usage: {
        prompt_tokens: lastMessage.content.length,
        completion_tokens: content.length,
        total_tokens: lastMessage.content.length + content.length
      },
      finish_reason: 'stop'
    };
  }

  async checkModelAvailability() {
    return {
      available: true,
      model: 'mock-model',
      availableModels: ['mock-model']
    };
  }
}

/**
 * 提供商工厂
 */
export class LLMProviderFactory {
  static createProvider(config) {
    const type = config.type;
    const name = config.name;

    switch (name.toLowerCase()) {
      case 'ollama':
        return new OllamaProvider(config);
      case 'openai':
        return new OpenAIProvider(config);
      case 'azure openai':
        return new AzureOpenAIProvider(config);
      case 'mock provider':
      case 'mock':
        return new MockProvider(config);
      default:
        throw new Error(`不支持的大模型提供商: ${name}`);
    }
  }
}

export default {
  LLMProvider,
  OllamaProvider,
  OpenAIProvider,
  AzureOpenAIProvider,
  MockProvider,
  LLMProviderFactory
};