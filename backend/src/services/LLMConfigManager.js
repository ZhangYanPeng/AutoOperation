/**
 * 大模型配置管理器
 * 支持多种大模型提供商的统一配置管理
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class LLMConfigManager {
  constructor() {
    this.config = null;
    this.configPath = null;
    this.initialized = false;
  }

  /**
   * 初始化配置管理器
   */
  async initialize(configPath = null) {
    try {
      this.configPath = configPath || this.getDefaultConfigPath();
      await this.loadConfig();
      this.initialized = true;
      logger.info('大模型配置管理器初始化成功');
    } catch (error) {
      logger.error('大模型配置管理器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取默认配置文件路径
   */
  getDefaultConfigPath() {
    const configDir = path.join(__dirname, '../../../configs');
    return path.join(configDir, 'llm-config.json');
  }

  /**
   * 加载配置文件
   */
  async loadConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        await this.createDefaultConfig();
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      
      // 验证配置
      this.validateConfig();
      
      logger.info(`已加载大模型配置: ${this.configPath}`);
    } catch (error) {
      logger.error('加载大模型配置失败:', error);
      throw new Error(`加载配置文件失败: ${error.message}`);
    }
  }

  /**
   * 创建默认配置文件
   */
  async createDefaultConfig() {
    const defaultConfig = {
      "version": "1.0.0",
      "active_provider": "ollama",
      "providers": {
        "ollama": {
          "name": "Ollama",
          "type": "local",
          "endpoint": "http://localhost:11434",
          "models": {
            "primary": "llama2",
            "fallback": "qwen2"
          },
          "parameters": {
            "temperature": 0.7,
            "max_tokens": 2048,
            "top_p": 0.9,
            "timeout": 30000
          },
          "enabled": true
        },
        "openai": {
          "name": "OpenAI",
          "type": "remote",
          "endpoint": "https://api.openai.com/v1",
          "api_key": "${OPENAI_API_KEY}",
          "models": {
            "primary": "gpt-3.5-turbo",
            "fallback": "gpt-3.5-turbo-0613"
          },
          "parameters": {
            "temperature": 0.7,
            "max_tokens": 2048,
            "top_p": 0.9,
            "timeout": 30000
          },
          "enabled": false
        },
        "azure": {
          "name": "Azure OpenAI",
          "type": "remote",
          "endpoint": "${AZURE_OPENAI_ENDPOINT}",
          "api_key": "${AZURE_OPENAI_API_KEY}",
          "deployment_id": "${AZURE_DEPLOYMENT_ID}",
          "models": {
            "primary": "gpt-35-turbo",
            "fallback": "gpt-35-turbo-16k"
          },
          "parameters": {
            "temperature": 0.7,
            "max_tokens": 2048,
            "top_p": 0.9,
            "timeout": 30000
          },
          "enabled": false
        }
      },
      "retry_config": {
        "max_retries": 3,
        "retry_delay": 1000,
        "backoff_factor": 2
      },
      "cache_config": {
        "enabled": true,
        "ttl": 3600,
        "max_size": 1000
      },
      "prompt_templates": {
        "problem_analysis": "请分析以下运维问题并提供处置步骤:\\n\\n问题分类: {category}\\n问题描述: {description}\\n\\n请按照以下格式返回结构化的处置方案:\\n1. 问题分析\\n2. 处置步骤（按优先级排序）\\n3. 注意事项",
        "step_generation": "基于以下上下文生成下一个处置步骤:\\n\\n当前状态: {current_status}\\n已完成步骤: {completed_steps}\\n用户反馈: {user_feedback}\\n\\n请提供具体的下一步操作指导。",
        "result_evaluation": "请评估以下处置步骤的执行结果:\\n\\n步骤描述: {step_description}\\n执行结果: {execution_result}\\n\\n请判断是否成功，并提供下一步建议。"
      }
    };

    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
    logger.info(`已创建默认大模型配置文件: ${this.configPath}`);
  }

  /**
   * 验证配置文件
   */
  validateConfig() {
    if (!this.config) {
      throw new Error('配置为空');
    }

    if (!this.config.active_provider) {
      throw new Error('未指定活跃的模型提供商');
    }

    if (!this.config.providers || typeof this.config.providers !== 'object') {
      throw new Error('模型提供商配置无效');
    }

    const activeProvider = this.config.providers[this.config.active_provider];
    if (!activeProvider) {
      throw new Error(`活跃的模型提供商 '${this.config.active_provider}' 未找到`);
    }

    if (!activeProvider.enabled) {
      throw new Error(`活跃的模型提供商 '${this.config.active_provider}' 未启用`);
    }

    // 验证必需字段
    const requiredFields = ['endpoint', 'models'];
    requiredFields.forEach(field => {
      if (!activeProvider[field]) {
        throw new Error(`模型提供商 '${this.config.active_provider}' 缺少必需字段: ${field}`);
      }
    });
  }

  /**
   * 获取当前活跃的提供商配置
   */
  getActiveProvider() {
    if (!this.initialized) {
      throw new Error('配置管理器未初始化');
    }
    return this.config.providers[this.config.active_provider];
  }

  /**
   * 获取提示模板
   */
  getPromptTemplate(templateName) {
    if (!this.config.prompt_templates || !this.config.prompt_templates[templateName]) {
      throw new Error(`提示模板 '${templateName}' 未找到`);
    }
    return this.config.prompt_templates[templateName];
  }

  /**
   * 获取重试配置
   */
  getRetryConfig() {
    return this.config.retry_config || {
      max_retries: 3,
      retry_delay: 1000,
      backoff_factor: 2
    };
  }

  /**
   * 获取缓存配置
   */
  getCacheConfig() {
    return this.config.cache_config || {
      enabled: true,
      ttl: 3600,
      max_size: 1000
    };
  }

  /**
   * 切换活跃提供商
   */
  async switchProvider(providerName) {
    if (!this.config.providers[providerName]) {
      throw new Error(`模型提供商 '${providerName}' 不存在`);
    }

    if (!this.config.providers[providerName].enabled) {
      throw new Error(`模型提供商 '${providerName}' 未启用`);
    }

    this.config.active_provider = providerName;
    await this.saveConfig();
    logger.info(`已切换到模型提供商: ${providerName}`);
  }

  /**
   * 保存配置文件
   */
  async saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      logger.info('大模型配置已保存');
    } catch (error) {
      logger.error('保存大模型配置失败:', error);
      throw error;
    }
  }

  /**
   * 重新加载配置
   */
  async reload() {
    await this.loadConfig();
    logger.info('大模型配置已重新加载');
  }

  /**
   * 获取完整配置
   */
  getConfig() {
    return this.config;
  }

  /**
   * 替换环境变量占位符
   */
  resolveEnvironmentVariables(value) {
    if (typeof value !== 'string') {
      return value;
    }

    return value.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      return process.env[envVar] || match;
    });
  }

  /**
   * 获取解析后的提供商配置（替换环境变量）
   */
  getResolvedProvider(providerName = null) {
    const provider = providerName ? 
      this.config.providers[providerName] : 
      this.getActiveProvider();

    if (!provider) {
      throw new Error(`模型提供商 '${providerName}' 不存在`);
    }

    // 深拷贝配置
    const resolvedProvider = JSON.parse(JSON.stringify(provider));

    // 递归解析环境变量
    const resolveObject = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = this.resolveEnvironmentVariables(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          resolveObject(obj[key]);
        }
      }
    };

    resolveObject(resolvedProvider);
    return resolvedProvider;
  }
}

// 创建全局单例实例
export const llmConfig = new LLMConfigManager();

export default llmConfig;