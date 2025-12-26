/**
 * 知识库管理服务
 * 负责运维处置知识库和设备操作API知识库的管理和检索
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { KnowledgeEntry } from '../models/KnowledgeEntry.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class KnowledgeBaseService {
  constructor() {
    this.knowledgeEntries = new Map();
    this.categories = new Set();
    this.keywords = new Set();
    this.initialized = false;
    this.knowledgeBasePath = null;
  }

  /**
   * 初始化知识库服务
   */
  async initialize(knowledgeBasePath = null) {
    try {
      this.knowledgeBasePath = knowledgeBasePath || this.getDefaultKnowledgeBasePath();
      await this.loadKnowledgeBase();
      this.initialized = true;
      logger.info('知识库服务初始化成功', {
        entriesCount: this.knowledgeEntries.size,
        categoriesCount: this.categories.size,
        keywordsCount: this.keywords.size
      });
    } catch (error) {
      logger.error('知识库服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取默认知识库路径
   */
  getDefaultKnowledgeBasePath() {
    return path.join(__dirname, '../../../knowledge-base');
  }

  /**
   * 检查初始化状态
   */
  checkInitialized() {
    if (!this.initialized) {
      throw new Error('知识库服务未初始化，请先调用 initialize()');
    }
  }

  /**
   * 加载知识库
   */
  async loadKnowledgeBase() {
    try {
      // 加载运维处置知识库
      await this.loadOperationProcedures();
      
      // 加载设备操作API知识库
      await this.loadDeviceAPIs();
      
      logger.info('知识库加载完成');
    } catch (error) {
      logger.error('加载知识库失败:', error);
      throw error;
    }
  }

  /**
   * 加载运维处置知识库
   */
  async loadOperationProcedures() {
    const proceduresPath = path.join(this.knowledgeBasePath, 'operation-procedures');
    
    if (!fs.existsSync(proceduresPath)) {
      logger.warn(`运维处置知识库目录不存在: ${proceduresPath}`);
      return;
    }

    const files = fs.readdirSync(proceduresPath);
    const markdownFiles = files.filter(file => file.endsWith('.md'));

    for (const file of markdownFiles) {
      try {
        const filePath = path.join(proceduresPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        const entry = this.parseOperationProcedure(content, file);
        if (entry) {
          this.addKnowledgeEntry(entry);
        }
      } catch (error) {
        logger.error(`加载运维处置文档失败: ${file}`, error);
      }
    }

    logger.info(`已加载 ${markdownFiles.length} 个运维处置文档`);
  }

  /**
   * 解析运维处置文档
   */
  parseOperationProcedure(content, filename) {
    try {
      // 解析Markdown文档的标题、内容和关键词
      const lines = content.split('\n');
      let title = filename.replace('.md', '');
      let description = '';
      let category = null;
      let keywords = [];
      let procedureContent = content;

      // 查找第一个标题作为title
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('# ')) {
          title = trimmedLine.substring(2).trim();
          break;
        }
      }

      // 查找元数据注释
      const metadataMatch = content.match(/<!--\s*metadata\s*(.*?)\s*-->/s);
      if (metadataMatch) {
        try {
          const metadata = JSON.parse(metadataMatch[1]);
          category = metadata.category;
          keywords = metadata.keywords || [];
          description = metadata.description || '';
        } catch (error) {
          logger.warn(`解析文档元数据失败: ${filename}`, error);
        }
      }

      // 如果没有描述，从内容中提取
      if (!description) {
        const contentLines = lines.filter(line => 
          line.trim() && 
          !line.trim().startsWith('#') && 
          !line.trim().startsWith('<!--')
        );
        description = contentLines.slice(0, 3).join(' ').substring(0, 200);
      }

      // 自动提取关键词
      const extractedKeywords = this.extractKeywords(title + ' ' + description);
      keywords = [...new Set([...keywords, ...extractedKeywords])];

      return new KnowledgeEntry({
        knowledge_type: 'operation-procedure',
        title,
        content: procedureContent,
        keywords,
        category,
        source_file: filename,
        metadata: {
          description,
          fileSize: content.length,
          lineCount: lines.length
        }
      });
    } catch (error) {
      logger.error(`解析运维处置文档失败: ${filename}`, error);
      return null;
    }
  }

  /**
   * 加载设备操作API知识库
   */
  async loadDeviceAPIs() {
    const apisPath = path.join(this.knowledgeBasePath, 'device-apis');
    
    if (!fs.existsSync(apisPath)) {
      logger.warn(`设备API知识库目录不存在: ${apisPath}`);
      return;
    }

    const files = fs.readdirSync(apisPath);
    const apiFiles = files.filter(file => file.endsWith('.md') || file.endsWith('.apib'));

    for (const file of apiFiles) {
      try {
        const filePath = path.join(apisPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        const entries = this.parseDeviceAPI(content, file);
        entries.forEach(entry => this.addKnowledgeEntry(entry));
      } catch (error) {
        logger.error(`加载设备API文档失败: ${file}`, error);
      }
    }

    logger.info(`已加载 ${apiFiles.length} 个设备API文档`);
  }

  /**
   * 解析设备API文档
   */
  parseDeviceAPI(content, filename) {
    try {
      const entries = [];
      
      if (filename.endsWith('.apib')) {
        // 解析API Blueprint格式
        entries.push(...this.parseAPIBlueprint(content, filename));
      } else {
        // 解析Markdown格式的API文档
        entries.push(...this.parseAPIMarkdown(content, filename));
      }

      return entries;
    } catch (error) {
      logger.error(`解析设备API文档失败: ${filename}`, error);
      return [];
    }
  }

  /**
   * 解析API Blueprint格式
   */
  parseAPIBlueprint(content, filename) {
    const entries = [];
    
    // 简单的API Blueprint解析
    const sections = content.split(/^##\s+/m);
    
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const lines = section.split('\n');
      const title = lines[0].trim();
      
      // 查找HTTP方法和路径
      const methodMatch = section.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(.+)$/m);
      if (methodMatch) {
        const method = methodMatch[1];
        const path = methodMatch[2];
        
        // 提取描述
        const descriptionMatch = section.match(/^([^[]+)$/m);
        const description = descriptionMatch ? descriptionMatch[1].trim() : '';
        
        const keywords = this.extractKeywords(`${title} ${method} ${path} ${description}`);
        
        entries.push(new KnowledgeEntry({
          knowledge_type: 'device-api',
          title: `${method} ${path}`,
          content: section,
          keywords,
          category: 'api',
          source_file: filename,
          metadata: {
            method,
            path,
            description,
            apiType: 'blueprint'
          }
        }));
      }
    }

    return entries;
  }

  /**
   * 解析Markdown格式的API文档
   */
  parseAPIMarkdown(content, filename) {
    const entries = [];
    
    // 按标题分割
    const sections = content.split(/^#+\s+/m);
    
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const lines = section.split('\n');
      const title = lines[0].trim();
      
      // 查找API信息
      const httpMatch = section.match(/(GET|POST|PUT|DELETE|PATCH)\s+([^\s]+)/);
      if (httpMatch) {
        const method = httpMatch[1];
        const path = httpMatch[2];
        
        const keywords = this.extractKeywords(`${title} ${method} ${path}`);
        
        entries.push(new KnowledgeEntry({
          knowledge_type: 'device-api',
          title: title,
          content: section,
          keywords,
          category: 'api',
          source_file: filename,
          metadata: {
            method,
            path,
            apiType: 'markdown'
          }
        }));
      }
    }

    return entries;
  }

  /**
   * 提取关键词
   */
  extractKeywords(text) {
    // 简单的关键词提取逻辑
    const stopWords = new Set(['的', '是', '在', '有', '和', '或', '但', '等', '及', '与', '为', '了', '也', '都', '将', '可', '能', 'the', 'is', 'at', 'which', 'on', 'and', 'or', 'but', 'for', 'to', 'of', 'a', 'an']);
    
    const words = text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.has(word));
    
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
   * 添加知识条目
   */
  addKnowledgeEntry(entry) {
    const validation = entry.validate();
    if (!validation.isValid) {
      logger.error('知识条目验证失败:', validation.errors);
      return false;
    }

    this.knowledgeEntries.set(entry.knowledge_id, entry);
    
    // 更新索引
    if (entry.category) {
      this.categories.add(entry.category);
    }
    entry.keywords.forEach(keyword => this.keywords.add(keyword));

    return true;
  }

  /**
   * 搜索知识库
   */
  search(query, options = {}) {
    this.checkInitialized();

    const {
      type = 'all', // 'all', 'operation-procedure', 'device-api'
      category = null,
      limit = 10,
      minScore = 0.1
    } = options;

    const results = [];

    for (const entry of this.knowledgeEntries.values()) {
      // 类型过滤
      if (type !== 'all' && entry.knowledge_type !== type) {
        continue;
      }

      // 分类过滤
      if (category && entry.category !== category) {
        continue;
      }

      // 搜索匹配
      const matchResult = entry.matchesSearch(query, type);
      if (matchResult.matches && matchResult.score >= minScore) {
        results.push({
          entry,
          score: matchResult.score,
          reasons: matchResult.reasons,
          relevance: matchResult.relevance,
          summary: entry.createSearchSummary(query)
        });
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score);

    // 限制结果数量
    const limitedResults = results.slice(0, limit);

    logger.info('知识库搜索完成', {
      query,
      type,
      category,
      totalMatches: results.length,
      returnedResults: limitedResults.length
    });

    return {
      query,
      options,
      total: results.length,
      results: limitedResults.map(result => ({
        knowledge_id: result.entry.knowledge_id,
        title: result.entry.title,
        type: result.entry.knowledge_type,
        category: result.entry.category,
        summary: result.summary,
        score: result.score,
        relevance: result.relevance,
        reasons: result.reasons,
        usage_count: result.entry.usage_count,
        effectiveness_score: result.entry.effectiveness_score
      }))
    };
  }

  /**
   * 根据ID获取知识条目
   */
  getKnowledgeEntry(knowledgeId) {
    this.checkInitialized();

    const entry = this.knowledgeEntries.get(knowledgeId);
    if (!entry) {
      return null;
    }

    // 增加使用次数
    entry.incrementUsage();

    return entry.toJSON();
  }

  /**
   * 根据分类获取知识条目
   */
  getByCategory(category, limit = 20) {
    this.checkInitialized();

    const results = [];
    for (const entry of this.knowledgeEntries.values()) {
      if (entry.category === category) {
        results.push(entry.toJSON());
      }
    }

    // 按使用次数和有效性排序
    results.sort((a, b) => {
      const scoreA = a.usage_count * 0.3 + a.effectiveness_score * 0.7;
      const scoreB = b.usage_count * 0.3 + b.effectiveness_score * 0.7;
      return scoreB - scoreA;
    });

    return results.slice(0, limit);
  }

  /**
   * 获取推荐的知识条目
   */
  getRecommendations(problemCategory, limit = 5) {
    this.checkInitialized();

    // 基于问题分类推荐相关知识
    const categoryResults = this.getByCategory(problemCategory, limit * 2);
    
    // 基于使用频率和有效性推荐
    const popularEntries = Array.from(this.knowledgeEntries.values())
      .filter(entry => entry.knowledge_type === 'operation-procedure')
      .sort((a, b) => {
        const scoreA = a.usage_count * 0.4 + a.effectiveness_score * 0.6;
        const scoreB = b.usage_count * 0.4 + b.effectiveness_score * 0.6;
        return scoreB - scoreA;
      })
      .slice(0, limit)
      .map(entry => entry.toJSON());

    // 合并和去重
    const seen = new Set();
    const recommendations = [];
    
    [...categoryResults, ...popularEntries].forEach(entry => {
      if (!seen.has(entry.knowledge_id) && recommendations.length < limit) {
        seen.add(entry.knowledge_id);
        recommendations.push(entry);
      }
    });

    return recommendations;
  }

  /**
   * 更新知识条目的有效性评分
   */
  updateEffectivenessScore(knowledgeId, score) {
    this.checkInitialized();

    const entry = this.knowledgeEntries.get(knowledgeId);
    if (!entry) {
      throw new Error(`知识条目不存在: ${knowledgeId}`);
    }

    entry.updateEffectivenessScore(score);
    logger.info(`已更新知识条目有效性评分: ${knowledgeId} -> ${score}`);
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    this.checkInitialized();

    const stats = {
      total_entries: this.knowledgeEntries.size,
      by_type: {},
      by_category: {},
      total_categories: this.categories.size,
      total_keywords: this.keywords.size,
      most_used: [],
      most_effective: []
    };

    // 按类型统计
    for (const entry of this.knowledgeEntries.values()) {
      stats.by_type[entry.knowledge_type] = (stats.by_type[entry.knowledge_type] || 0) + 1;
      if (entry.category) {
        stats.by_category[entry.category] = (stats.by_category[entry.category] || 0) + 1;
      }
    }

    // 最常使用的知识条目
    stats.most_used = Array.from(this.knowledgeEntries.values())
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, 10)
      .map(entry => ({
        knowledge_id: entry.knowledge_id,
        title: entry.title,
        usage_count: entry.usage_count
      }));

    // 最有效的知识条目
    stats.most_effective = Array.from(this.knowledgeEntries.values())
      .sort((a, b) => b.effectiveness_score - a.effectiveness_score)
      .slice(0, 10)
      .map(entry => ({
        knowledge_id: entry.knowledge_id,
        title: entry.title,
        effectiveness_score: entry.effectiveness_score
      }));

    return stats;
  }

  /**
   * 重新加载知识库
   */
  async reload() {
    this.knowledgeEntries.clear();
    this.categories.clear();
    this.keywords.clear();
    await this.loadKnowledgeBase();
    logger.info('知识库已重新加载');
  }
}

// 创建全局单例实例
export const knowledgeBaseService = new KnowledgeBaseService();

export default knowledgeBaseService;