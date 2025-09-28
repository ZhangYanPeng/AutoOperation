/**
 * 设备API知识服务
 * 专门管理设备API知识库，提供API文档管理和集成支持
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { KnowledgeEntry } from '../models/KnowledgeEntry.js';
import { categoryService } from './CategoryService.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DeviceAPIService {
  constructor() {
    this.apiEntries = new Map();
    this.apiCategories = new Map();
    this.apiEndpoints = new Map();
    this.apiVersions = new Map();
    this.initialized = false;
    this.knowledgeBasePath = null;
  }

  /**
   * 初始化设备API知识服务
   */
  async initialize(knowledgeBasePath = null) {
    try {
      this.knowledgeBasePath = knowledgeBasePath || this.getDefaultKnowledgeBasePath();
      await this.loadAPICategories();
      await this.loadAPIKnowledge();
      await this.buildAPIEndpoints();
      this.initialized = true;
      
      logger.info('设备API知识服务初始化成功', {
        apiCount: this.apiEntries.size,
        categoriesCount: this.apiCategories.size,
        endpointsCount: this.apiEndpoints.size
      });
    } catch (error) {
      logger.error('设备API知识服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取默认知识库路径
   */
  getDefaultKnowledgeBasePath() {
    return path.join(__dirname, '../../../knowledge-base/device-apis');
  }

  /**
   * 检查初始化状态
   */
  checkInitialized() {
    if (!this.initialized) {
      throw new Error('设备API知识服务未初始化，请先调用 initialize()');
    }
  }

  /**
   * 加载API分类
   */
  async loadAPICategories() {
    try {
      const categories = categoryService.getCategoriesByType('device-api');
      categories.forEach(category => {
        this.apiCategories.set(category.category_id, category);
      });
      
      logger.info(`已加载 ${this.apiCategories.size} 个设备API分类`);
    } catch (error) {
      logger.error('加载设备API分类失败:', error);
      throw error;
    }
  }

  /**
   * 加载设备API知识
   */
  async loadAPIKnowledge() {
    try {
      if (!fs.existsSync(this.knowledgeBasePath)) {
        logger.warn(`设备API知识库目录不存在: ${this.knowledgeBasePath}`);
        return;
      }

      const files = fs.readdirSync(this.knowledgeBasePath);
      const apiFiles = files.filter(file => 
        file.endsWith('.md') || 
        file.endsWith('.apib') || 
        file.endsWith('.yaml') || 
        file.endsWith('.yml') ||
        file.endsWith('.json')
      );

      for (const file of apiFiles) {
        try {
          const filePath = path.join(this.knowledgeBasePath, file);
          const content = fs.readFileSync(filePath, 'utf8');
          
          const entries = this.parseAPIDocument(content, file);
          entries.forEach(entry => this.addAPIEntry(entry));
        } catch (error) {
          logger.error(`加载设备API文档失败: ${file}`, error);
        }
      }

      logger.info(`已加载 ${apiFiles.length} 个设备API文档`);
    } catch (error) {
      logger.error('加载设备API知识失败:', error);
      throw error;
    }
  }

  /**
   * 解析API文档
   */
  parseAPIDocument(content, filename) {
    const entries = [];
    const fileExtension = path.extname(filename).toLowerCase();
    
    try {
      switch (fileExtension) {
        case '.apib':
          entries.push(...this.parseAPIBlueprint(content, filename));
          break;
        case '.yaml':
        case '.yml':
          entries.push(...this.parseOpenAPISpec(content, filename));
          break;
        case '.json':
          entries.push(...this.parseJSONAPI(content, filename));
          break;
        case '.md':
        default:
          entries.push(...this.parseMarkdownAPI(content, filename));
          break;
      }
    } catch (error) {
      logger.error(`解析API文档失败: ${filename}`, error);
    }
    
    return entries;
  }

  /**
   * 解析API Blueprint格式
   */
  parseAPIBlueprint(content, filename) {
    const entries = [];
    
    // 解析API Blueprint基本结构
    const lines = content.split('\n');
    let currentGroup = null;
    let currentResource = null;
    let currentAction = null;
    let apiInfo = {
      title: '',
      description: '',
      version: '1.0.0'
    };

    // 提取API基本信息
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      apiInfo.title = titleMatch[1];
    }

    const versionMatch = content.match(/HOST:\s*(.+)/i);
    if (versionMatch) {
      apiInfo.host = versionMatch[1];
    }

    // 按组和资源分割
    const sections = content.split(/^##\s+/m);
    
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const lines = section.split('\n');
      const sectionTitle = lines[0].trim();
      
      // 解析资源操作
      const actionMatch = section.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(.+)$/m);
      if (actionMatch) {
        const method = actionMatch[1];
        const path = actionMatch[2];
        
        // 提取参数
        const parameters = this.extractAPIParameters(section);
        
        // 提取响应示例
        const responses = this.extractAPIResponses(section);
        
        // 提取描述
        const description = this.extractAPIDescription(section);

        const entry = new KnowledgeEntry({
          knowledge_type: 'device-api',
          title: `${method} ${path}`,
          content: section,
          keywords: this.extractAPIKeywords(`${sectionTitle} ${method} ${path} ${description}`),
          category_id: this.intelligentAPICategotyMatching(sectionTitle, section),
          source_file: filename,
          metadata: {
            apiType: 'blueprint',
            method,
            path,
            description,
            parameters,
            responses,
            group: currentGroup,
            resource: sectionTitle,
            version: apiInfo.version,
            host: apiInfo.host
          }
        });

        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * 解析OpenAPI规范
   */
  parseOpenAPISpec(content, filename) {
    const entries = [];
    
    try {
      // 简单的YAML解析 (在实际项目中应使用专业的YAML解析库)
      const yamlData = this.parseSimpleYAML(content);
      
      if (yamlData.paths) {
        for (const [path, pathItem] of Object.entries(yamlData.paths)) {
          for (const [method, operation] of Object.entries(pathItem)) {
            if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
              const entry = new KnowledgeEntry({
                knowledge_type: 'device-api',
                title: operation.summary || `${method.toUpperCase()} ${path}`,
                content: this.buildOpenAPIContent(path, method, operation),
                keywords: this.extractAPIKeywords(`${operation.summary || ''} ${operation.description || ''} ${path}`),
                category_id: this.intelligentAPICategotyMatching(operation.tags?.[0] || '', operation.description || ''),
                source_file: filename,
                metadata: {
                  apiType: 'openapi',
                  method: method.toUpperCase(),
                  path,
                  description: operation.description,
                  summary: operation.summary,
                  parameters: operation.parameters || [],
                  responses: operation.responses || {},
                  tags: operation.tags || [],
                  version: yamlData.info?.version || '1.0.0'
                }
              });

              entries.push(entry);
            }
          }
        }
      }
    } catch (error) {
      logger.error(`解析OpenAPI规范失败: ${filename}`, error);
    }

    return entries;
  }

  /**
   * 解析JSON格式API
   */
  parseJSONAPI(content, filename) {
    const entries = [];
    
    try {
      const jsonData = JSON.parse(content);
      
      // 判断JSON格式类型
      if (jsonData.openapi || jsonData.swagger) {
        // OpenAPI/Swagger JSON
        return this.parseOpenAPISpec(JSON.stringify(jsonData), filename);
      } else if (jsonData.apiVersion || jsonData.kind) {
        // Kubernetes API 或其他API规范
        const entry = new KnowledgeEntry({
          knowledge_type: 'device-api',
          title: jsonData.metadata?.name || jsonData.kind || 'API Definition',
          content: content,
          keywords: this.extractAPIKeywords(JSON.stringify(jsonData).substring(0, 500)),
          category_id: this.intelligentAPICategotyMatching(jsonData.kind || '', content),
          source_file: filename,
          metadata: {
            apiType: 'json',
            kind: jsonData.kind,
            apiVersion: jsonData.apiVersion,
            name: jsonData.metadata?.name,
            description: jsonData.metadata?.description
          }
        });

        entries.push(entry);
      }
    } catch (error) {
      logger.error(`解析JSON API失败: ${filename}`, error);
    }

    return entries;
  }

  /**
   * 解析Markdown格式API
   */
  parseMarkdownAPI(content, filename) {
    const entries = [];
    
    // 按标题分割
    const sections = content.split(/^#+\s+/m);
    
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const lines = section.split('\n');
      const title = lines[0].trim();
      
      // 查找HTTP方法和路径
      const httpMatch = section.match(/(GET|POST|PUT|DELETE|PATCH)\s+([^\s\n]+)/i);
      if (httpMatch) {
        const method = httpMatch[1].toUpperCase();
        const path = httpMatch[2];
        
        // 提取描述
        const description = this.extractAPIDescription(section);
        
        // 提取参数和响应
        const parameters = this.extractAPIParameters(section);
        const responses = this.extractAPIResponses(section);

        const entry = new KnowledgeEntry({
          knowledge_type: 'device-api',
          title: title,
          content: section,
          keywords: this.extractAPIKeywords(`${title} ${method} ${path} ${description}`),
          category_id: this.intelligentAPICategotyMatching(title, section),
          source_file: filename,
          metadata: {
            apiType: 'markdown',
            method,
            path,
            description,
            parameters,
            responses
          }
        });

        entries.push(entry);
      } else {
        // 非HTTP API文档，作为通用API文档处理
        const entry = new KnowledgeEntry({
          knowledge_type: 'device-api',
          title: title,
          content: section,
          keywords: this.extractAPIKeywords(title + ' ' + section.substring(0, 200)),
          category_id: this.intelligentAPICategotyMatching(title, section),
          source_file: filename,
          metadata: {
            apiType: 'documentation',
            description: section.substring(0, 200)
          }
        });

        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * 智能API分类匹配
   */
  intelligentAPICategotyMatching(title, content) {
    const text = `${title} ${content}`.toLowerCase();
    
    // 定义API类型关键词映射
    const categoryKeywords = {
      'database_systems_backup': ['backup', '备份', 'dump', 'restore', '恢复', 'snapshot'],
      'database_systems_performance': ['performance', '性能', 'monitor', '监控', 'metrics', 'stats'],
      'database_systems_security': ['auth', '认证', 'security', '安全', 'user', '用户', 'permission', '权限'],
      'database_systems_maintenance': ['maintenance', '维护', 'config', '配置', 'admin', '管理'],
      'network_devices': ['network', '网络', 'switch', '交换机', 'router', '路由器', 'firewall', '防火墙'],
      'server_hardware': ['server', '服务器', 'hardware', '硬件', 'cpu', 'memory', '内存', 'disk', '磁盘'],
      'storage_systems': ['storage', '存储', 'volume', '卷', 'disk', '磁盘', 'raid'],
      'virtualization': ['vm', '虚拟机', 'container', '容器', 'docker', 'kubernetes', 'k8s'],
      'monitoring_tools': ['monitor', '监控', 'alert', '告警', 'metric', '指标', 'log', '日志']
    };

    let bestMatch = 'database_systems'; // 默认分类
    let maxScore = 0;

    for (const [categoryId, keywords] of Object.entries(categoryKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score += keyword.length;
        }
      }
      
      if (score > maxScore) {
        maxScore = score;
        bestMatch = categoryId;
      }
    }

    return bestMatch;
  }

  /**
   * 提取API关键词
   */
  extractAPIKeywords(text) {
    const apiStopWords = new Set([
      'api', 'endpoint', 'request', 'response', 'method', 'parameter', 'param',
      'header', 'body', 'json', 'xml', 'http', 'https', 'get', 'post', 'put', 'delete',
      'the', 'is', 'at', 'which', 'on', 'and', 'or', 'but', 'for', 'to', 'of', 'a', 'an'
    ]);
    
    const words = text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1 && !apiStopWords.has(word));
    
    // 统计词频并返回前10个
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    return Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * 提取API描述
   */
  extractAPIDescription(section) {
    const lines = section.split('\n');
    const descriptionLines = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && 
          !trimmed.startsWith('#') && 
          !trimmed.startsWith('```') &&
          !trimmed.match(/^(GET|POST|PUT|DELETE|PATCH)/i) &&
          !trimmed.startsWith('|') &&
          !trimmed.startsWith('-') &&
          !trimmed.startsWith('*')) {
        descriptionLines.push(trimmed);
        if (descriptionLines.length >= 3) break; // 只取前3行描述
      }
    }
    
    return descriptionLines.join(' ').substring(0, 200);
  }

  /**
   * 提取API参数
   */
  extractAPIParameters(section) {
    const parameters = [];
    const lines = section.split('\n');
    let inParameterSection = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.toLowerCase().includes('parameter') || 
          trimmed.toLowerCase().includes('参数')) {
        inParameterSection = true;
        continue;
      }
      
      if (inParameterSection) {
        if (trimmed.startsWith('|')) {
          // 表格格式参数
          const cells = trimmed.split('|').map(cell => cell.trim()).filter(cell => cell);
          if (cells.length >= 3 && !cells[0].includes('-')) {
            parameters.push({
              name: cells[0],
              type: cells[1],
              description: cells[2],
              required: cells.length > 3 ? cells[3] : 'optional'
            });
          }
        } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          // 列表格式参数
          const paramMatch = trimmed.match(/[-*]\s*(\w+)[\s:：]*(.*)/);
          if (paramMatch) {
            parameters.push({
              name: paramMatch[1],
              description: paramMatch[2],
              type: 'string',
              required: 'optional'
            });
          }
        } else if (trimmed.startsWith('#') || !trimmed) {
          inParameterSection = false;
        }
      }
    }
    
    return parameters;
  }

  /**
   * 提取API响应
   */
  extractAPIResponses(section) {
    const responses = {};
    const lines = section.split('\n');
    let inResponseSection = false;
    let currentCode = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.toLowerCase().includes('response') || 
          trimmed.toLowerCase().includes('响应')) {
        inResponseSection = true;
        continue;
      }
      
      if (inResponseSection) {
        // 匹配HTTP状态码
        const codeMatch = trimmed.match(/^(\d{3})\s*(.*)$/);
        if (codeMatch) {
          currentCode = codeMatch[1];
          responses[currentCode] = {
            description: codeMatch[2] || '',
            example: ''
          };
        } else if (trimmed.startsWith('```')) {
          // 代码块开始/结束
          continue;
        } else if (currentCode && trimmed && !trimmed.startsWith('#')) {
          // 响应示例内容
          if (!responses[currentCode].example) {
            responses[currentCode].example = trimmed;
          } else {
            responses[currentCode].example += '\n' + trimmed;
          }
        } else if (trimmed.startsWith('#')) {
          inResponseSection = false;
        }
      }
    }
    
    return responses;
  }

  /**
   * 构建API端点索引
   */
  async buildAPIEndpoints() {
    this.apiEndpoints.clear();
    
    for (const [entryId, entry] of this.apiEntries) {
      if (entry.metadata.method && entry.metadata.path) {
        const endpointKey = `${entry.metadata.method}:${entry.metadata.path}`;
        
        if (!this.apiEndpoints.has(endpointKey)) {
          this.apiEndpoints.set(endpointKey, []);
        }
        
        this.apiEndpoints.get(endpointKey).push({
          entryId,
          title: entry.title,
          category_id: entry.category_id,
          version: entry.metadata.version || '1.0.0',
          description: entry.metadata.description
        });
      }
    }
    
    logger.info(`已构建 ${this.apiEndpoints.size} 个API端点索引`);
  }

  /**
   * 简单YAML解析器
   */
  parseSimpleYAML(content) {
    // 这是一个简化的YAML解析器，仅用于演示
    // 在实际项目中应使用专业的YAML解析库如js-yaml
    try {
      const lines = content.split('\n');
      const result = {};
      let currentObj = result;
      let objStack = [result];
      let keyStack = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const indent = line.length - line.trimStart().length;
        const colonIndex = line.indexOf(':');
        
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          
          // 简化处理，只支持基本的键值对
          if (value) {
            currentObj[key] = value.replace(/^["']|["']$/g, '');
          } else {
            currentObj[key] = {};
          }
        }
      }
      
      return result;
    } catch (error) {
      logger.error('YAML解析失败:', error);
      return {};
    }
  }

  /**
   * 构建OpenAPI内容
   */
  buildOpenAPIContent(path, method, operation) {
    let content = `# ${operation.summary || `${method.toUpperCase()} ${path}`}\n\n`;
    
    if (operation.description) {
      content += `${operation.description}\n\n`;
    }
    
    content += `**Method:** ${method.toUpperCase()}\n`;
    content += `**Path:** ${path}\n\n`;
    
    if (operation.parameters && operation.parameters.length > 0) {
      content += `## Parameters\n\n`;
      for (const param of operation.parameters) {
        content += `- **${param.name}** (${param.in}): ${param.description || ''}\n`;
      }
      content += '\n';
    }
    
    if (operation.responses) {
      content += `## Responses\n\n`;
      for (const [code, response] of Object.entries(operation.responses)) {
        content += `**${code}**: ${response.description || ''}\n`;
      }
    }
    
    return content;
  }

  /**
   * 添加API条目
   */
  addAPIEntry(entry) {
    const validation = entry.validate();
    if (!validation.isValid) {
      logger.error('API知识条目验证失败:', validation.errors);
      return false;
    }

    this.apiEntries.set(entry.knowledge_id, entry);
    return true;
  }

  /**
   * 按端点搜索API
   */
  searchByEndpoint(method, path, options = {}) {
    this.checkInitialized();

    const {
      exact = false,
      limit = 10
    } = options;

    const results = [];
    const endpointKey = `${method.toUpperCase()}:${path}`;
    
    if (exact) {
      // 精确匹配
      const endpoints = this.apiEndpoints.get(endpointKey) || [];
      endpoints.forEach(endpoint => {
        const entry = this.apiEntries.get(endpoint.entryId);
        if (entry) {
          results.push({
            entry: entry.toJSON(),
            matchType: 'exact',
            score: 1.0
          });
        }
      });
    } else {
      // 模糊匹配
      const pathPattern = path.toLowerCase();
      const methodUpper = method.toUpperCase();
      
      for (const [key, endpoints] of this.apiEndpoints) {
        const [keyMethod, keyPath] = key.split(':');
        
        if (keyMethod === methodUpper || method === '*') {
          const keyPathLower = keyPath.toLowerCase();
          
          let score = 0;
          if (keyPathLower === pathPattern) {
            score = 1.0;
          } else if (keyPathLower.includes(pathPattern) || pathPattern.includes(keyPathLower)) {
            score = 0.8;
          } else {
            // 路径段匹配
            const pathSegments = pathPattern.split('/').filter(s => s);
            const keySegments = keyPathLower.split('/').filter(s => s);
            const commonSegments = pathSegments.filter(seg => keySegments.includes(seg));
            score = commonSegments.length / Math.max(pathSegments.length, keySegments.length);
          }
          
          if (score > 0.3) {
            endpoints.forEach(endpoint => {
              const entry = this.apiEntries.get(endpoint.entryId);
              if (entry) {
                results.push({
                  entry: entry.toJSON(),
                  matchType: score === 1.0 ? 'exact' : 'partial',
                  score
                });
              }
            });
          }
        }
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score);

    return {
      method,
      path,
      totalMatches: results.length,
      results: results.slice(0, limit)
    };
  }

  /**
   * 搜索API知识
   */
  searchAPIKnowledge(query, options = {}) {
    this.checkInitialized();

    const {
      category_id = null,
      apiType = null, // 'blueprint', 'openapi', 'markdown', 'json'
      method = null,
      limit = 10,
      minScore = 0.1
    } = options;

    const results = [];
    const searchTerms = query.toLowerCase().split(/\s+/);

    for (const entry of this.apiEntries.values()) {
      // 分类过滤
      if (category_id && entry.category_id !== category_id) {
        continue;
      }

      // API类型过滤
      if (apiType && entry.metadata.apiType !== apiType) {
        continue;
      }

      // HTTP方法过滤
      if (method && entry.metadata.method !== method.toUpperCase()) {
        continue;
      }

      let score = 0;
      let reasons = [];

      // 标题匹配（最高权重）
      const titleLower = entry.title.toLowerCase();
      const titleMatches = searchTerms.filter(term => titleLower.includes(term));
      if (titleMatches.length > 0) {
        score += titleMatches.length * 3;
        reasons.push(`标题匹配: ${titleMatches.join(', ')}`);
      }

      // 路径匹配（高权重）
      if (entry.metadata.path) {
        const pathLower = entry.metadata.path.toLowerCase();
        const pathMatches = searchTerms.filter(term => pathLower.includes(term));
        if (pathMatches.length > 0) {
          score += pathMatches.length * 2.5;
          reasons.push(`路径匹配: ${pathMatches.join(', ')}`);
        }
      }

      // 描述匹配
      if (entry.metadata.description) {
        const descLower = entry.metadata.description.toLowerCase();
        const descMatches = searchTerms.filter(term => descLower.includes(term));
        if (descMatches.length > 0) {
          score += descMatches.length * 2;
          reasons.push(`描述匹配: ${descMatches.length} 个词条`);
        }
      }

      // 关键词匹配
      const keywordMatches = searchTerms.filter(term => 
        entry.keywords.some(keyword => keyword.includes(term))
      );
      if (keywordMatches.length > 0) {
        score += keywordMatches.length * 1.5;
        reasons.push(`关键词匹配: ${keywordMatches.join(', ')}`);
      }

      // 参数匹配
      if (entry.metadata.parameters) {
        const paramText = entry.metadata.parameters
          .map(p => `${p.name} ${p.description || ''}`)
          .join(' ')
          .toLowerCase();
        const paramMatches = searchTerms.filter(term => paramText.includes(term));
        if (paramMatches.length > 0) {
          score += paramMatches.length * 1;
          reasons.push(`参数匹配: ${paramMatches.length} 个词条`);
        }
      }

      // 内容匹配（最低权重）
      const contentLower = entry.content.toLowerCase();
      const contentMatches = searchTerms.filter(term => contentLower.includes(term));
      if (contentMatches.length > 0) {
        score += contentMatches.length * 0.5;
        reasons.push(`内容匹配: ${contentMatches.length} 个词条`);
      }

      if (score >= minScore) {
        results.push({
          entry: entry.toJSON(),
          score,
          reasons,
          relevance: searchTerms.length > 0 ? (titleMatches.length + keywordMatches.length) / searchTerms.length : 0
        });
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score);

    return {
      query,
      category_id,
      apiType,
      method,
      totalMatches: results.length,
      results: results.slice(0, limit)
    };
  }

  /**
   * 获取API版本信息
   */
  getAPIVersions(options = {}) {
    this.checkInitialized();

    const {
      category_id = null,
      groupBy = 'category' // 'category', 'type', 'source'
    } = options;

    const versions = new Map();

    for (const entry of this.apiEntries.values()) {
      if (category_id && entry.category_id !== category_id) {
        continue;
      }

      const version = entry.metadata.version || '1.0.0';
      let groupKey;

      switch (groupBy) {
        case 'category':
          groupKey = entry.category_id || 'uncategorized';
          break;
        case 'type':
          groupKey = entry.metadata.apiType || 'unknown';
          break;
        case 'source':
          groupKey = entry.source_file || 'unknown';
          break;
        default:
          groupKey = 'all';
      }

      if (!versions.has(groupKey)) {
        versions.set(groupKey, new Set());
      }
      versions.get(groupKey).add(version);
    }

    const result = {};
    for (const [key, versionSet] of versions) {
      result[key] = Array.from(versionSet).sort();
    }

    return result;
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    this.checkInitialized();

    const stats = {
      total_apis: this.apiEntries.size,
      total_categories: this.apiCategories.size,
      total_endpoints: this.apiEndpoints.size,
      by_category: {},
      by_type: {},
      by_method: {},
      version_distribution: {},
      coverage_analysis: {
        with_parameters: 0,
        with_responses: 0,
        with_examples: 0,
        complete_documentation: 0
      }
    };

    // 统计分析
    for (const entry of this.apiEntries.values()) {
      // 按分类统计
      const categoryId = entry.category_id || 'uncategorized';
      stats.by_category[categoryId] = (stats.by_category[categoryId] || 0) + 1;

      // 按类型统计
      const apiType = entry.metadata.apiType || 'unknown';
      stats.by_type[apiType] = (stats.by_type[apiType] || 0) + 1;

      // 按HTTP方法统计
      if (entry.metadata.method) {
        const method = entry.metadata.method;
        stats.by_method[method] = (stats.by_method[method] || 0) + 1;
      }

      // 版本分布
      const version = entry.metadata.version || '1.0.0';
      stats.version_distribution[version] = (stats.version_distribution[version] || 0) + 1;

      // 覆盖率分析
      if (entry.metadata.parameters && entry.metadata.parameters.length > 0) {
        stats.coverage_analysis.with_parameters++;
      }
      if (entry.metadata.responses && Object.keys(entry.metadata.responses).length > 0) {
        stats.coverage_analysis.with_responses++;
      }
      if (entry.metadata.responses && Object.values(entry.metadata.responses).some(r => r.example)) {
        stats.coverage_analysis.with_examples++;
      }
      if (entry.metadata.parameters && entry.metadata.responses && entry.metadata.description) {
        stats.coverage_analysis.complete_documentation++;
      }
    }

    return stats;
  }

  /**
   * 重新加载API知识
   */
  async reload() {
    this.apiEntries.clear();
    this.apiCategories.clear();
    this.apiEndpoints.clear();
    
    await this.loadAPICategories();
    await this.loadAPIKnowledge();
    await this.buildAPIEndpoints();
    
    logger.info('设备API知识已重新加载');
  }
}

// 创建全局单例实例
export const deviceAPIService = new DeviceAPIService();

export default deviceAPIService;
      if (entry.metadata.parameters) {
        const paramText = entry.metadata.parameters
          .map(p => `${p.name} ${p.description || '