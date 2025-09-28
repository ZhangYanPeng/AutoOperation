/**
 * 搜索路由服务
 * 智能分发搜索请求到不同的知识服务，提供统一的搜索接口
 */

import { troubleKnowledgeService } from './TroubleKnowledgeService.js';
import { deviceAPIService } from './DeviceAPIService.js';
import { categoryService } from './CategoryService.js';
import { logger } from '../utils/logger.js';

export class SearchRouterService {
  constructor() {
    this.initialized = false;
    this.searchStrategies = new Map();
    this.searchCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
  }

  /**
   * 初始化搜索路由服务
   */
  async initialize() {
    try {
      this.initializeSearchStrategies();
      this.initialized = true;
      
      logger.info('搜索路由服务初始化成功', {
        strategiesCount: this.searchStrategies.size
      });
    } catch (error) {
      logger.error('搜索路由服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检查初始化状态
   */
  checkInitialized() {
    if (!this.initialized) {
      throw new Error('搜索路由服务未初始化，请先调用 initialize()');
    }
  }

  /**
   * 初始化搜索策略
   */
  initializeSearchStrategies() {
    // 故障症状诊断策略
    this.searchStrategies.set('symptom_diagnosis', {
      name: '故障症状诊断',
      description: '基于故障症状进行智能诊断',
      priority: 10,
      keywords: ['故障', '异常', '错误', '问题', '症状', '不能', '无法', '失败'],
      handler: this.handleSymptomDiagnosis.bind(this)
    });

    // API端点搜索策略  
    this.searchStrategies.set('api_endpoint', {
      name: 'API端点搜索',
      description: '按API端点和方法搜索',
      priority: 9,
      keywords: ['api', 'get', 'post', 'put', 'delete', 'patch', 'endpoint', '接口'],
      patterns: [/\b(GET|POST|PUT|DELETE|PATCH)\s+\/\S+/i, /\/api\/\S+/i],
      handler: this.handleAPIEndpointSearch.bind(this)
    });

    // 分类导向搜索策略
    this.searchStrategies.set('category_guided', {
      name: '分类导向搜索',
      description: '基于知识分类进行搜索',
      priority: 8,
      keywords: ['性能', '网络', '安全', '数据库', '监控', '存储', '虚拟化'],
      handler: this.handleCategoryGuidedSearch.bind(this)
    });

    // 技术栈搜索策略
    this.searchStrategies.set('tech_stack', {
      name: '技术栈搜索',
      description: '基于技术栈和工具搜索',
      priority: 7,
      keywords: ['docker', 'kubernetes', 'mysql', 'nginx', 'redis', 'elasticsearch'],
      handler: this.handleTechStackSearch.bind(this)
    });

    // 通用关键词搜索策略
    this.searchStrategies.set('general_keyword', {
      name: '通用关键词搜索',
      description: '基于关键词的通用搜索',
      priority: 5,
      keywords: [],
      handler: this.handleGeneralKeywordSearch.bind(this)
    });
  }

  /**
   * 统一搜索接口
   */
  async search(query, options = {}) {
    this.checkInitialized();

    const {
      limit = 10,
      includeCategories = true,
      searchScope = 'all', // 'all', 'operation-procedure', 'device-api'
      strategy = 'auto' // 'auto' 或指定策略名称
    } = options;

    const startTime = Date.now();
    
    try {
      // 检查缓存
      const cacheKey = this.generateCacheKey(query, options);
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        logger.debug('从缓存返回搜索结果', { query, cacheKey });
        return cachedResult;
      }

      // 分析查询意图
      const intent = this.analyzeSearchIntent(query, options);
      
      // 选择搜索策略
      const selectedStrategy = strategy === 'auto' 
        ? this.selectBestStrategy(query, intent, options)
        : this.searchStrategies.get(strategy);

      if (!selectedStrategy) {
        throw new Error(`未找到搜索策略: ${strategy}`);
      }

      logger.info('执行搜索', { 
        query, 
        strategy: selectedStrategy.name,
        intent: intent.type,
        scope: searchScope 
      });

      // 执行搜索
      const searchResults = await selectedStrategy.handler(query, intent, options);

      // 合并分类信息
      if (includeCategories) {
        searchResults.categories = this.getRelevantCategories(query, searchScope);
      }

      // 添加元信息
      searchResults.meta = {
        query,
        strategy: selectedStrategy.name,
        intent: intent.type,
        searchScope,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      // 缓存结果
      this.setCache(cacheKey, searchResults);

      return searchResults;
    } catch (error) {
      logger.error('搜索执行失败:', error);
      throw error;
    }
  }

  /**
   * 分析搜索意图
   */
  analyzeSearchIntent(query, options) {
    const queryLower = query.toLowerCase();
    const intent = {
      type: 'general',
      confidence: 0.5,
      indicators: [],
      suggestedActions: []
    };

    // 故障诊断意图识别
    const troubleIndicators = ['故障', '异常', '错误', '问题', '不能', '无法', '失败', '报错'];
    const troubleCount = troubleIndicators.filter(indicator => queryLower.includes(indicator)).length;
    if (troubleCount > 0) {
      intent.type = 'troubleshooting';
      intent.confidence = Math.min(0.8 + troubleCount * 0.1, 1.0);
      intent.indicators.push('故障诊断关键词');
      intent.suggestedActions.push('symptom_diagnosis');
    }

    // API查询意图识别
    const apiIndicators = ['api', 'get', 'post', 'put', 'delete', 'endpoint', '接口', '调用'];
    const apiCount = apiIndicators.filter(indicator => queryLower.includes(indicator)).length;
    if (apiCount > 0 || /\/\w+/.test(query)) {
      if (intent.type === 'general') {
        intent.type = 'api_query';
        intent.confidence = Math.min(0.7 + apiCount * 0.1, 1.0);
      }
      intent.indicators.push('API查询关键词');
      intent.suggestedActions.push('api_endpoint');
    }

    // 学习意图识别
    const learningIndicators = ['如何', '怎么', '什么是', '教程', '指南', '文档'];
    const learningCount = learningIndicators.filter(indicator => queryLower.includes(indicator)).length;
    if (learningCount > 0) {
      if (intent.type === 'general') {
        intent.type = 'learning';
        intent.confidence = Math.min(0.6 + learningCount * 0.15, 1.0);
      }
      intent.indicators.push('学习相关关键词');
      intent.suggestedActions.push('category_guided');
    }

    return intent;
  }

  /**
   * 选择最佳搜索策略
   */
  selectBestStrategy(query, intent, options) {
    const candidates = [];

    for (const [key, strategy] of this.searchStrategies) {
      let score = strategy.priority;

      // 基于意图调整分数
      if (intent.suggestedActions.includes(key)) {
        score += intent.confidence * 10;
      }

      // 基于关键词匹配调整分数
      if (strategy.keywords.length > 0) {
        const queryLower = query.toLowerCase();
        const matchCount = strategy.keywords.filter(keyword => 
          queryLower.includes(keyword)
        ).length;
        score += matchCount * 2;
      }

      // 基于模式匹配调整分数
      if (strategy.patterns) {
        const patternMatches = strategy.patterns.filter(pattern => 
          pattern.test(query)
        ).length;
        score += patternMatches * 5;
      }

      candidates.push({ key, strategy, score });
    }

    // 按分数排序并选择最高分的策略
    candidates.sort((a, b) => b.score - a.score);
    
    const selected = candidates[0];
    logger.debug('策略选择结果', {
      query,
      selected: selected.key,
      score: selected.score,
      candidates: candidates.map(c => ({ key: c.key, score: c.score }))
    });

    return selected.strategy;
  }

  /**
   * 处理故障症状诊断
   */
  async handleSymptomDiagnosis(query, intent, options) {
    const { limit = 5, searchScope } = options;
    
    if (searchScope === 'device-api') {
      // 如果指定只搜索API，则降级到通用搜索
      return this.handleGeneralKeywordSearch(query, intent, options);
    }

    try {
      // 使用故障诊断服务
      const diagnosisResults = troubleKnowledgeService.diagnoseBySymptoms(query, {
        limit: limit * 2 // 获取更多结果以便后续筛选
      });

      // 同时进行关键词搜索作为补充
      const keywordResults = troubleKnowledgeService.searchTroubleKnowledge(query, {
        limit: Math.ceil(limit / 2)
      });

      return {
        type: 'symptom_diagnosis',
        primaryResults: diagnosisResults.results || [],
        supplementaryResults: keywordResults.results || [],
        totalMatches: (diagnosisResults.totalMatches || 0) + (keywordResults.totalMatches || 0),
        diagnosticInfo: {
          symptoms: diagnosisResults.symptoms,
          confidence: intent.confidence
        }
      };
    } catch (error) {
      logger.error('故障症状诊断失败:', error);
      // 降级到关键词搜索
      return this.handleGeneralKeywordSearch(query, intent, options);
    }
  }

  /**
   * 处理API端点搜索
   */
  async handleAPIEndpointSearch(query, intent, options) {
    const { limit = 10, searchScope } = options;
    
    if (searchScope === 'operation-procedure') {
      // 如果指定只搜索故障处置，则降级到通用搜索
      return this.handleGeneralKeywordSearch(query, intent, options);
    }

    try {
      // 尝试解析HTTP方法和路径
      const endpointMatch = query.match(/\b(GET|POST|PUT|DELETE|PATCH)\s+(\/\S+)/i);
      let endpointResults = { results: [] };
      
      if (endpointMatch) {
        const method = endpointMatch[1].toUpperCase();
        const path = endpointMatch[2];
        
        endpointResults = deviceAPIService.searchByEndpoint(method, path, {
          exact: false,
          limit: Math.ceil(limit * 0.7)
        });
      }

      // 进行API知识搜索作为补充
      const apiResults = deviceAPIService.searchAPIKnowledge(query, {
        limit: Math.ceil(limit * 0.6)
      });

      return {
        type: 'api_endpoint',
        primaryResults: endpointResults.results || [],
        supplementaryResults: apiResults.results || [],
        totalMatches: (endpointResults.totalMatches || 0) + (apiResults.totalMatches || 0),
        endpointInfo: endpointMatch ? {
          method: endpointMatch[1].toUpperCase(),
          path: endpointMatch[2]
        } : null
      };
    } catch (error) {
      logger.error('API端点搜索失败:', error);
      return this.handleGeneralKeywordSearch(query, intent, options);
    }
  }

  /**
   * 处理分类导向搜索
   */
  async handleCategoryGuidedSearch(query, intent, options) {
    const { limit = 10, searchScope } = options;

    try {
      // 搜索相关分类
      const relevantCategories = this.getRelevantCategories(query, searchScope);
      
      const results = [];
      const processedCategories = [];

      // 为每个相关分类进行搜索
      for (const category of relevantCategories.slice(0, 3)) { // 最多处理3个分类
        try {
          if (searchScope !== 'device-api' && category.knowledge_type === 'operation-procedure') {
            const troubleResults = troubleKnowledgeService.searchTroubleKnowledge(query, {
              category_id: category.category_id,
              limit: Math.ceil(limit / 3)
            });
            results.push(...(troubleResults.results || []));
            processedCategories.push(category);
          }
          
          if (searchScope !== 'operation-procedure' && category.knowledge_type === 'device-api') {
            const apiResults = deviceAPIService.searchAPIKnowledge(query, {
              category_id: category.category_id,
              limit: Math.ceil(limit / 3)
            });
            results.push(...(apiResults.results || []));
            processedCategories.push(category);
          }
        } catch (error) {
          logger.warn(`分类搜索失败: ${category.category_id}`, error);
        }
      }

      // 按分数排序
      results.sort((a, b) => (b.score || 0) - (a.score || 0));

      return {
        type: 'category_guided',
        primaryResults: results.slice(0, limit),
        supplementaryResults: [],
        totalMatches: results.length,
        categoryInfo: {
          processedCategories,
          totalRelevantCategories: relevantCategories.length
        }
      };
    } catch (error) {
      logger.error('分类导向搜索失败:', error);
      return this.handleGeneralKeywordSearch(query, intent, options);
    }
  }

  /**
   * 处理技术栈搜索
   */
  async handleTechStackSearch(query, intent, options) {
    const { limit = 10, searchScope } = options;

    try {
      const results = [];

      // 在故障处置知识中搜索
      if (searchScope !== 'device-api') {
        const troubleResults = troubleKnowledgeService.searchTroubleKnowledge(query, {
          limit: Math.ceil(limit * 0.6)
        });
        results.push(...(troubleResults.results || []));
      }

      // 在API知识中搜索
      if (searchScope !== 'operation-procedure') {
        const apiResults = deviceAPIService.searchAPIKnowledge(query, {
          limit: Math.ceil(limit * 0.6)
        });
        results.push(...(apiResults.results || []));
      }

      // 合并和去重
      const uniqueResults = this.deduplicateResults(results);
      uniqueResults.sort((a, b) => (b.score || 0) - (a.score || 0));

      return {
        type: 'tech_stack',
        primaryResults: uniqueResults.slice(0, limit),
        supplementaryResults: [],
        totalMatches: uniqueResults.length
      };
    } catch (error) {
      logger.error('技术栈搜索失败:', error);
      return this.handleGeneralKeywordSearch(query, intent, options);
    }
  }

  /**
   * 处理通用关键词搜索
   */
  async handleGeneralKeywordSearch(query, intent, options) {
    const { limit = 10, searchScope } = options;

    try {
      const results = [];

      // 在故障处置知识中搜索
      if (searchScope !== 'device-api') {
        try {
          const troubleResults = troubleKnowledgeService.searchTroubleKnowledge(query, {
            limit: Math.ceil(limit * 0.6)
          });
          results.push(...(troubleResults.results || []));
        } catch (error) {
          logger.warn('故障处置知识搜索失败:', error);
        }
      }

      // 在API知识中搜索
      if (searchScope !== 'operation-procedure') {
        try {
          const apiResults = deviceAPIService.searchAPIKnowledge(query, {
            limit: Math.ceil(limit * 0.6)
          });
          results.push(...(apiResults.results || []));
        } catch (error) {
          logger.warn('API知识搜索失败:', error);
        }
      }

      // 合并和去重
      const uniqueResults = this.deduplicateResults(results);
      uniqueResults.sort((a, b) => (b.score || 0) - (a.score || 0));

      return {
        type: 'general_keyword',
        primaryResults: uniqueResults.slice(0, limit),
        supplementaryResults: [],
        totalMatches: uniqueResults.length
      };
    } catch (error) {
      logger.error('通用关键词搜索失败:', error);
      return {
        type: 'general_keyword',
        primaryResults: [],
        supplementaryResults: [],
        totalMatches: 0,
        error: error.message
      };
    }
  }

  /**
   * 获取相关分类
   */
  getRelevantCategories(query, searchScope = 'all') {
    try {
      const allCategories = [];
      
      if (searchScope !== 'device-api') {
        const operationCategories = categoryService.getCategoriesByType('operation-procedure');
        allCategories.push(...operationCategories);
      }
      
      if (searchScope !== 'operation-procedure') {
        const deviceCategories = categoryService.getCategoriesByType('device-api');
        allCategories.push(...deviceCategories);
      }

      // 基于查询词匹配分类
      const queryLower = query.toLowerCase();
      const relevantCategories = allCategories
        .filter(category => {
          const categoryText = `${category.display_name_zh} ${category.display_name_en} ${category.description}`.toLowerCase();
          return queryLower.split(/\s+/).some(term => categoryText.includes(term));
        })
        .sort((a, b) => {
          // 简单的相关性评分
          const scoreA = this.calculateCategoryRelevance(query, a);
          const scoreB = this.calculateCategoryRelevance(query, b);
          return scoreB - scoreA;
        });

      return relevantCategories;
    } catch (error) {
      logger.error('获取相关分类失败:', error);
      return [];
    }
  }

  /**
   * 计算分类相关性
   */
  calculateCategoryRelevance(query, category) {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const categoryText = `${category.display_name_zh} ${category.display_name_en} ${category.description}`.toLowerCase();
    
    let score = 0;
    for (const term of queryTerms) {
      if (categoryText.includes(term)) {
        score += term.length; // 更长的匹配词权重更高
      }
    }
    
    return score;
  }

  /**
   * 结果去重
   */
  deduplicateResults(results) {
    const seen = new Set();
    const unique = [];
    
    for (const result of results) {
      const id = result.entry?.knowledge_id || result.knowledge_id;
      if (id && !seen.has(id)) {
        seen.add(id);
        unique.push(result);
      }
    }
    
    return unique;
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(query, options) {
    const keyData = {
      query: query.toLowerCase().trim(),
      limit: options.limit || 10,
      searchScope: options.searchScope || 'all',
      strategy: options.strategy || 'auto'
    };
    
    return JSON.stringify(keyData);
  }

  /**
   * 从缓存获取结果
   */
  getFromCache(key) {
    const cached = this.searchCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    if (cached) {
      this.searchCache.delete(key);
    }
    
    return null;
  }

  /**
   * 设置缓存
   */
  setCache(key, data) {
    // 限制缓存大小
    if (this.searchCache.size >= 1000) {
      // 删除最旧的缓存项
      const firstKey = this.searchCache.keys().next().value;
      this.searchCache.delete(firstKey);
    }
    
    this.searchCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.searchCache.clear();
    logger.info('搜索缓存已清除');
  }

  /**
   * 获取搜索统计信息
   */
  getStatistics() {
    this.checkInitialized();

    return {
      strategiesCount: this.searchStrategies.size,
      strategies: Array.from(this.searchStrategies.entries()).map(([key, strategy]) => ({
        key,
        name: strategy.name,
        description: strategy.description,
        priority: strategy.priority
      })),
      cacheInfo: {
        size: this.searchCache.size,
        maxSize: 1000,
        timeout: this.cacheTimeout
      }
    };
  }
}

// 创建全局单例实例
export const searchRouterService = new SearchRouterService();

export default searchRouterService;