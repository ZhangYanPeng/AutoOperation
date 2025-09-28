/**
 * 故障处置知识服务
 * 专门管理运维故障处置知识库，提供故障诊断流程管理
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { KnowledgeEntry } from '../models/KnowledgeEntry.js';
import { categoryService } from './CategoryService.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TroubleKnowledgeService {
  constructor() {
    this.knowledgeEntries = new Map();
    this.troubleCategories = new Map();
    this.diagnosticFlows = new Map();
    this.initialized = false;
    this.knowledgeBasePath = null;
  }

  /**
   * 初始化故障处置知识服务
   */
  async initialize(knowledgeBasePath = null) {
    try {
      this.knowledgeBasePath = knowledgeBasePath || this.getDefaultKnowledgeBasePath();
      await this.loadTroubleCategories();
      await this.loadTroubleKnowledge();
      await this.buildDiagnosticFlows();
      this.initialized = true;
      
      logger.info('故障处置知识服务初始化成功', {
        knowledgeCount: this.knowledgeEntries.size,
        categoriesCount: this.troubleCategories.size,
        diagnosticFlowsCount: this.diagnosticFlows.size
      });
    } catch (error) {
      logger.error('故障处置知识服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取默认知识库路径
   */
  getDefaultKnowledgeBasePath() {
    return path.join(__dirname, '../../../knowledge-base/operation-procedures');
  }

  /**
   * 检查初始化状态
   */
  checkInitialized() {
    if (!this.initialized) {
      throw new Error('故障处置知识服务未初始化，请先调用 initialize()');
    }
  }

  /**
   * 加载故障处置分类
   */
  async loadTroubleCategories() {
    try {
      const categories = categoryService.getCategoriesByType('operation-procedure');
      categories.forEach(category => {
        this.troubleCategories.set(category.category_id, category);
      });
      
      logger.info(`已加载 ${this.troubleCategories.size} 个故障处置分类`);
    } catch (error) {
      logger.error('加载故障处置分类失败:', error);
      throw error;
    }
  }

  /**
   * 加载故障处置知识
   */
  async loadTroubleKnowledge() {
    try {
      if (!fs.existsSync(this.knowledgeBasePath)) {
        logger.warn(`故障处置知识库目录不存在: ${this.knowledgeBasePath}`);
        return;
      }

      const files = fs.readdirSync(this.knowledgeBasePath);
      const markdownFiles = files.filter(file => file.endsWith('.md'));

      for (const file of markdownFiles) {
        try {
          const filePath = path.join(this.knowledgeBasePath, file);
          const content = fs.readFileSync(filePath, 'utf8');
          
          const entry = this.parseTroubleProcedure(content, file);
          if (entry) {
            this.addKnowledgeEntry(entry);
          }
        } catch (error) {
          logger.error(`加载故障处置文档失败: ${file}`, error);
        }
      }

      logger.info(`已加载 ${markdownFiles.length} 个故障处置文档`);
    } catch (error) {
      logger.error('加载故障处置知识失败:', error);
      throw error;
    }
  }

  /**
   * 解析故障处置文档
   */
  parseTroubleProcedure(content, filename) {
    try {
      const lines = content.split('\n');
      let title = filename.replace('.md', '');
      let description = '';
      let category_id = null;
      let keywords = [];
      let symptoms = [];
      let solutions = [];
      let diagnosticSteps = [];

      // 查找第一个标题作为title
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('# ')) {
          title = trimmedLine.substring(2).trim();
          break;
        }
      }

      // 解析故障处置结构
      let currentSection = '';
      let currentContent = [];

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // 识别故障处置特定章节
        if (trimmedLine.startsWith('## 故障现象') || trimmedLine.startsWith('## 症状')) {
          if (currentContent.length > 0) {
            this.processSection(currentSection, currentContent, { symptoms, solutions, diagnosticSteps });
          }
          currentSection = 'symptoms';
          currentContent = [];
        } else if (trimmedLine.startsWith('## 解决方案') || trimmedLine.startsWith('## 处置步骤')) {
          if (currentContent.length > 0) {
            this.processSection(currentSection, currentContent, { symptoms, solutions, diagnosticSteps });
          }
          currentSection = 'solutions';
          currentContent = [];
        } else if (trimmedLine.startsWith('## 诊断步骤') || trimmedLine.startsWith('## 排查步骤')) {
          if (currentContent.length > 0) {
            this.processSection(currentSection, currentContent, { symptoms, solutions, diagnosticSteps });
          }
          currentSection = 'diagnostic';
          currentContent = [];
        } else if (trimmedLine.startsWith('##')) {
          if (currentContent.length > 0) {
            this.processSection(currentSection, currentContent, { symptoms, solutions, diagnosticSteps });
          }
          currentSection = 'other';
          currentContent = [];
        } else if (trimmedLine && !trimmedLine.startsWith('#')) {
          currentContent.push(trimmedLine);
        }
      }

      // 处理最后一个章节
      if (currentContent.length > 0) {
        this.processSection(currentSection, currentContent, { symptoms, solutions, diagnosticSteps });
      }

      // 查找元数据注释
      const metadataMatch = content.match(/<!--\s*metadata\s*(.*?)\s*-->/s);
      if (metadataMatch) {
        try {
          const metadata = JSON.parse(metadataMatch[1]);
          category_id = metadata.category_id;
          keywords = metadata.keywords || [];
          description = metadata.description || '';
        } catch (error) {
          logger.warn(`解析文档元数据失败: ${filename}`, error);
        }
      }

      // 智能分类匹配
      if (!category_id) {
        category_id = this.intelligentCategoryMatching(title, content);
      }

      // 如果没有描述，从症状中提取
      if (!description && symptoms.length > 0) {
        description = symptoms.slice(0, 2).join('; ').substring(0, 200);
      }

      // 自动提取关键词
      const extractedKeywords = this.extractTroubleKeywords(title + ' ' + description + ' ' + symptoms.join(' '));
      keywords = [...new Set([...keywords, ...extractedKeywords])];

      return new KnowledgeEntry({
        knowledge_type: 'operation-procedure',
        title,
        content,
        keywords,
        category_id,
        source_file: filename,
        metadata: {
          description,
          symptoms,
          solutions,
          diagnosticSteps,
          fileSize: content.length,
          lineCount: lines.length,
          parsedSections: {
            hasSymptoms: symptoms.length > 0,
            hasSolutions: solutions.length > 0,
            hasDiagnostic: diagnosticSteps.length > 0
          }
        }
      });
    } catch (error) {
      logger.error(`解析故障处置文档失败: ${filename}`, error);
      return null;
    }
  }

  /**
   * 处理文档章节
   */
  processSection(sectionType, content, collections) {
    const text = content.join(' ');
    
    switch (sectionType) {
      case 'symptoms':
        // 按行或者列表项分割症状
        const symptomItems = content.filter(line => 
          line.trim().startsWith('-') || 
          line.trim().startsWith('*') || 
          line.trim().startsWith('1.') ||
          (line.trim() && !line.includes('：') && !line.includes(':'))
        );
        collections.symptoms.push(...symptomItems.map(item => item.replace(/^[-*\d\.]\s*/, '').trim()));
        break;
        
      case 'solutions':
        // 提取解决方案步骤
        const solutionSteps = content.filter(line => 
          line.trim().startsWith('-') || 
          line.trim().startsWith('*') || 
          /^\d+\./.test(line.trim())
        );
        collections.solutions.push(...solutionSteps.map(step => step.replace(/^[-*\d\.]\s*/, '').trim()));
        break;
        
      case 'diagnostic':
        // 提取诊断步骤
        const diagSteps = content.filter(line => 
          line.trim().startsWith('-') || 
          line.trim().startsWith('*') || 
          /^\d+\./.test(line.trim())
        );
        collections.diagnosticSteps.push(...diagSteps.map(step => step.replace(/^[-*\d\.]\s*/, '').trim()));
        break;
    }
  }

  /**
   * 智能分类匹配
   */
  intelligentCategoryMatching(title, content) {
    const text = `${title} ${content}`.toLowerCase();
    
    // 定义关键词映射
    const categoryKeywords = {
      'system_performance_cpu': ['cpu', '处理器', '占用率', '使用率过高', 'load', '负载'],
      'system_performance_memory': ['内存', 'memory', 'ram', '内存不足', '内存泄漏', 'oom'],
      'system_performance_disk': ['磁盘', 'disk', '硬盘', '存储', '空间不足', 'io', '读写'],
      'system_performance_load': ['负载', 'load', '系统负载', '响应慢', '性能'],
      'network_connectivity': ['网络', 'network', '连接', '断网', '网络中断', 'ping', 'dns'],
      'security_incidents': ['安全', 'security', '攻击', '漏洞', '权限', '认证', '病毒'],
      'service_availability': ['服务', 'service', '应用', '可用性', '宕机', '故障', '重启'],
      'data_integrity': ['数据', 'data', '数据库', 'database', '备份', '恢复', '丢失'],
      'infrastructure_maintenance': ['维护', 'maintenance', '更新', '升级', '硬件', '设备']
    };

    let bestMatch = 'system_performance'; // 默认分类
    let maxScore = 0;

    for (const [categoryId, keywords] of Object.entries(categoryKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score += keyword.length; // 更长的关键词权重更高
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
   * 提取故障处置关键词
   */
  extractTroubleKeywords(text) {
    // 故障处置特定的关键词
    const troubleStopWords = new Set([
      '故障', '问题', '处置', '解决', '方案', '步骤', '检查', '确认', '操作',
      '系统', '服务', '应用', '设备', '网络', '数据', '文件', '配置',
      'the', 'is', 'at', 'which', 'on', 'and', 'or', 'but', 'for', 'to', 'of', 'a', 'an'
    ]);
    
    const words = text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1 && !troubleStopWords.has(word));
    
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
   * 构建诊断流程
   */
  async buildDiagnosticFlows() {
    // 根据知识条目构建诊断决策树
    for (const [entryId, entry] of this.knowledgeEntries) {
      if (entry.metadata.symptoms && entry.metadata.diagnosticSteps) {
        const flow = {
          entryId,
          title: entry.title,
          category_id: entry.category_id,
          symptoms: entry.metadata.symptoms,
          diagnosticSteps: entry.metadata.diagnosticSteps,
          solutions: entry.metadata.solutions,
          complexity: this.calculateComplexity(entry.metadata)
        };
        
        this.diagnosticFlows.set(entryId, flow);
      }
    }
    
    logger.info(`已构建 ${this.diagnosticFlows.size} 个诊断流程`);
  }

  /**
   * 计算诊断复杂度
   */
  calculateComplexity(metadata) {
    let complexity = 1; // 基础复杂度
    
    // 根据诊断步骤数量
    if (metadata.diagnosticSteps) {
      complexity += Math.min(metadata.diagnosticSteps.length * 0.5, 5);
    }
    
    // 根据解决方案数量
    if (metadata.solutions) {
      complexity += Math.min(metadata.solutions.length * 0.3, 3);
    }
    
    return Math.min(complexity, 10); // 最大复杂度为10
  }

  /**
   * 添加知识条目
   */
  addKnowledgeEntry(entry) {
    const validation = entry.validate();
    if (!validation.isValid) {
      logger.error('故障处置知识条目验证失败:', validation.errors);
      return false;
    }

    this.knowledgeEntries.set(entry.knowledge_id, entry);
    return true;
  }

  /**
   * 故障诊断匹配
   */
  diagnoseBySymptoms(symptoms, options = {}) {
    this.checkInitialized();

    const {
      category_id = null,
      limit = 5,
      minRelevance = 0.3
    } = options;

    const results = [];
    const symptomTerms = symptoms.toLowerCase().split(/[,;，；\s]+/).filter(term => term.trim());

    for (const [entryId, entry] of this.knowledgeEntries) {
      // 分类过滤
      if (category_id && entry.category_id !== category_id) {
        continue;
      }

      // 症状匹配
      if (!entry.metadata.symptoms || entry.metadata.symptoms.length === 0) {
        continue;
      }

      let matchScore = 0;
      let matchedSymptoms = [];
      let totalSymptoms = entry.metadata.symptoms.length;

      for (const symptom of entry.metadata.symptoms) {
        const symptomLower = symptom.toLowerCase();
        for (const term of symptomTerms) {
          if (symptomLower.includes(term) || term.includes(symptomLower.substring(0, 3))) {
            matchScore += 1;
            matchedSymptoms.push(symptom);
            break;
          }
        }
      }

      const relevance = matchScore / Math.max(symptomTerms.length, totalSymptoms);
      
      if (relevance >= minRelevance) {
        const flow = this.diagnosticFlows.get(entryId);
        results.push({
          entry: entry.toJSON(),
          relevance,
          matchScore,
          matchedSymptoms,
          diagnosticFlow: flow || null,
          confidence: this.calculateConfidence(matchScore, totalSymptoms, relevance)
        });
      }
    }

    // 按相关性和置信度排序
    results.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      return b.relevance - a.relevance;
    });

    return {
      symptoms,
      totalMatches: results.length,
      results: results.slice(0, limit)
    };
  }

  /**
   * 计算诊断置信度
   */
  calculateConfidence(matchScore, totalSymptoms, relevance) {
    // 综合考虑匹配得分、总症状数和相关性
    const scoreWeight = Math.min(matchScore / 5, 1); // 匹配得分权重
    const completenessWeight = Math.min(totalSymptoms / 3, 1); // 完整性权重
    const relevanceWeight = relevance; // 相关性权重
    
    return (scoreWeight * 0.4 + completenessWeight * 0.3 + relevanceWeight * 0.3);
  }

  /**
   * 获取推荐诊断流程
   */
  getRecommendedDiagnosticFlow(categoryId, options = {}) {
    this.checkInitialized();

    const {
      complexity = 'all', // 'simple', 'medium', 'complex', 'all'
      limit = 10
    } = options;

    const flows = Array.from(this.diagnosticFlows.values())
      .filter(flow => {
        if (categoryId && flow.category_id !== categoryId) {
          return false;
        }
        
        if (complexity !== 'all') {
          const flowComplexity = flow.complexity;
          switch (complexity) {
            case 'simple': return flowComplexity <= 3;
            case 'medium': return flowComplexity > 3 && flowComplexity <= 6;
            case 'complex': return flowComplexity > 6;
            default: return true;
          }
        }
        
        return true;
      })
      .sort((a, b) => {
        // 按复杂度和标题排序
        if (a.complexity !== b.complexity) {
          return a.complexity - b.complexity;
        }
        return a.title.localeCompare(b.title);
      })
      .slice(0, limit);

    return flows;
  }

  /**
   * 搜索故障处置知识
   */
  searchTroubleKnowledge(query, options = {}) {
    this.checkInitialized();

    const {
      category_id = null,
      searchType = 'all', // 'symptoms', 'solutions', 'all'
      limit = 10,
      minScore = 0.1
    } = options;

    const results = [];
    const searchTerms = query.toLowerCase().split(/\s+/);

    for (const entry of this.knowledgeEntries.values()) {
      // 分类过滤
      if (category_id && entry.category_id !== category_id) {
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

      // 根据搜索类型进行特定匹配
      if (searchType === 'symptoms' || searchType === 'all') {
        // 症状匹配
        if (entry.metadata.symptoms) {
          const symptomText = entry.metadata.symptoms.join(' ').toLowerCase();
          const symptomMatches = searchTerms.filter(term => symptomText.includes(term));
          if (symptomMatches.length > 0) {
            score += symptomMatches.length * 2;
            reasons.push(`症状匹配: ${symptomMatches.length} 个词条`);
          }
        }
      }

      if (searchType === 'solutions' || searchType === 'all') {
        // 解决方案匹配
        if (entry.metadata.solutions) {
          const solutionText = entry.metadata.solutions.join(' ').toLowerCase();
          const solutionMatches = searchTerms.filter(term => solutionText.includes(term));
          if (solutionMatches.length > 0) {
            score += solutionMatches.length * 2;
            reasons.push(`解决方案匹配: ${solutionMatches.length} 个词条`);
          }
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
      searchType,
      category_id,
      totalMatches: results.length,
      results: results.slice(0, limit)
    };
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    this.checkInitialized();

    const stats = {
      total_entries: this.knowledgeEntries.size,
      total_categories: this.troubleCategories.size,
      total_diagnostic_flows: this.diagnosticFlows.size,
      by_category: {},
      complexity_distribution: {
        simple: 0,
        medium: 0,
        complex: 0
      },
      coverage_analysis: {
        with_symptoms: 0,
        with_solutions: 0,
        with_diagnostic: 0,
        complete_procedures: 0
      }
    };

    // 按分类统计
    for (const entry of this.knowledgeEntries.values()) {
      const categoryId = entry.category_id || 'uncategorized';
      stats.by_category[categoryId] = (stats.by_category[categoryId] || 0) + 1;

      // 覆盖率分析
      if (entry.metadata.symptoms && entry.metadata.symptoms.length > 0) {
        stats.coverage_analysis.with_symptoms++;
      }
      if (entry.metadata.solutions && entry.metadata.solutions.length > 0) {
        stats.coverage_analysis.with_solutions++;
      }
      if (entry.metadata.diagnosticSteps && entry.metadata.diagnosticSteps.length > 0) {
        stats.coverage_analysis.with_diagnostic++;
      }
      if (entry.metadata.symptoms && entry.metadata.solutions && entry.metadata.diagnosticSteps) {
        stats.coverage_analysis.complete_procedures++;
      }
    }

    // 复杂度分布
    for (const flow of this.diagnosticFlows.values()) {
      if (flow.complexity <= 3) {
        stats.complexity_distribution.simple++;
      } else if (flow.complexity <= 6) {
        stats.complexity_distribution.medium++;
      } else {
        stats.complexity_distribution.complex++;
      }
    }

    return stats;
  }

  /**
   * 重新加载故障处置知识
   */
  async reload() {
    this.knowledgeEntries.clear();
    this.troubleCategories.clear();
    this.diagnosticFlows.clear();
    
    await this.loadTroubleCategories();
    await this.loadTroubleKnowledge();
    await this.buildDiagnosticFlows();
    
    logger.info('故障处置知识已重新加载');
  }
}

// 创建全局单例实例
export const troubleKnowledgeService = new TroubleKnowledgeService();

export default troubleKnowledgeService;