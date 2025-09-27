/**
 * 知识库索引模型
 * 管理运维处置和设备操作知识库的索引和检索
 */

import { v4 as uuidv4 } from 'uuid';

export class KnowledgeEntry {
  constructor({
    knowledge_id = null,
    knowledge_type,
    title,
    content,
    keywords = [],
    category = null,
    priority = 0,
    usage_count = 0,
    effectiveness_score = 0,
    metadata = {},
    version = '1.0.0',
    author = null,
    source_file = null
  }) {
    this.knowledge_id = knowledge_id || uuidv4();
    this.knowledge_type = knowledge_type; // operation-procedure, device-api
    this.title = title;
    this.content = content;
    this.keywords = Array.isArray(keywords) ? keywords : [];
    this.category = category;
    this.priority = priority;
    this.usage_count = usage_count;
    this.effectiveness_score = effectiveness_score;
    this.metadata = metadata;
    this.version = version;
    this.author = author;
    this.source_file = source_file;
    this.created_at = new Date().toISOString();
    this.last_updated = new Date().toISOString();
  }

  /**
   * 验证知识条目数据
   */
  validate() {
    const errors = [];

    if (!this.title || this.title.trim() === '') {
      errors.push('知识标题不能为空');
    }

    if (!this.content || this.content.trim() === '') {
      errors.push('知识内容不能为空');
    }

    const validTypes = ['operation-procedure', 'device-api'];
    if (!validTypes.includes(this.knowledge_type)) {
      errors.push(`知识类型必须是以下之一: ${validTypes.join(', ')}`);
    }

    if (this.priority < 0 || this.priority > 10) {
      errors.push('优先级必须在0-10之间');
    }

    if (this.effectiveness_score < 0 || this.effectiveness_score > 1) {
      errors.push('有效性评分必须在0-1之间');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 更新使用次数
   */
  incrementUsage() {
    this.usage_count++;
    this.last_updated = new Date().toISOString();
  }

  /**
   * 更新有效性评分
   */
  updateEffectivenessScore(score) {
    if (score < 0 || score > 1) {
      throw new Error('有效性评分必须在0-1之间');
    }
    this.effectiveness_score = score;
    this.last_updated = new Date().toISOString();
  }

  /**
   * 添加关键词
   */
  addKeywords(newKeywords) {
    const keywordsToAdd = Array.isArray(newKeywords) ? newKeywords : [newKeywords];
    keywordsToAdd.forEach(keyword => {
      if (keyword && !this.keywords.includes(keyword.toLowerCase())) {
        this.keywords.push(keyword.toLowerCase());
      }
    });
    this.last_updated = new Date().toISOString();
  }

  /**
   * 检查是否匹配搜索条件
   */
  matchesSearch(query, searchType = 'all') {
    if (!query || query.trim() === '') {
      return { matches: true, score: 0, reasons: [] };
    }

    const searchTerms = query.toLowerCase().split(/\s+/);
    const reasons = [];
    let score = 0;

    // 标题匹配（权重最高）
    const titleLower = this.title.toLowerCase();
    const titleMatches = searchTerms.filter(term => titleLower.includes(term));
    if (titleMatches.length > 0) {
      score += titleMatches.length * 3;
      reasons.push(`标题匹配: ${titleMatches.join(', ')}`);
    }

    // 关键词匹配（高权重）
    const keywordMatches = searchTerms.filter(term => 
      this.keywords.some(keyword => keyword.includes(term))
    );
    if (keywordMatches.length > 0) {
      score += keywordMatches.length * 2;
      reasons.push(`关键词匹配: ${keywordMatches.join(', ')}`);
    }

    // 内容匹配（中等权重）
    const contentLower = this.content.toLowerCase();
    const contentMatches = searchTerms.filter(term => contentLower.includes(term));
    if (contentMatches.length > 0) {
      score += contentMatches.length * 1;
      reasons.push(`内容匹配: ${contentMatches.length} 个词条`);
    }

    // 分类匹配（低权重）
    if (this.category && searchTerms.includes(this.category.toLowerCase())) {
      score += 0.5;
      reasons.push(`分类匹配: ${this.category}`);
    }

    // 类型过滤
    if (searchType !== 'all' && this.knowledge_type !== searchType) {
      return { matches: false, score: 0, reasons: ['类型不匹配'] };
    }

    // 添加优先级和有效性加权
    score = score * (1 + this.priority / 10) * (1 + this.effectiveness_score);

    return {
      matches: score > 0,
      score,
      reasons,
      relevance: this.calculateRelevance(searchTerms)
    };
  }

  /**
   * 计算相关性得分
   */
  calculateRelevance(searchTerms) {
    const totalTerms = searchTerms.length;
    let matchedTerms = 0;

    searchTerms.forEach(term => {
      if (this.title.toLowerCase().includes(term) ||
          this.keywords.some(keyword => keyword.includes(term)) ||
          this.content.toLowerCase().includes(term)) {
        matchedTerms++;
      }
    });

    return totalTerms > 0 ? matchedTerms / totalTerms : 0;
  }

  /**
   * 转换为JSON对象
   */
  toJSON() {
    return {
      knowledge_id: this.knowledge_id,
      knowledge_type: this.knowledge_type,
      title: this.title,
      content: this.content,
      keywords: this.keywords,
      category: this.category,
      priority: this.priority,
      usage_count: this.usage_count,
      effectiveness_score: this.effectiveness_score,
      metadata: this.metadata,
      version: this.version,
      author: this.author,
      source_file: this.source_file,
      created_at: this.created_at,
      last_updated: this.last_updated
    };
  }

  /**
   * 从JSON对象创建知识条目实例
   */
  static fromJSON(json) {
    const entry = new KnowledgeEntry(json);
    entry.created_at = json.created_at;
    entry.last_updated = json.last_updated;
    return entry;
  }

  /**
   * 创建搜索摘要
   */
  createSearchSummary(query = '', maxLength = 200) {
    let summary = this.content;
    
    if (query.trim() !== '') {
      const searchTerms = query.toLowerCase().split(/\s+/);
      const contentLower = this.content.toLowerCase();
      
      // 寻找第一个匹配的词条位置
      let firstMatchIndex = -1;
      for (const term of searchTerms) {
        const index = contentLower.indexOf(term);
        if (index !== -1 && (firstMatchIndex === -1 || index < firstMatchIndex)) {
          firstMatchIndex = index;
        }
      }
      
      if (firstMatchIndex !== -1) {
        // 从匹配位置前后截取内容
        const start = Math.max(0, firstMatchIndex - maxLength / 2);
        const end = Math.min(this.content.length, start + maxLength);
        summary = this.content.substring(start, end);
        
        if (start > 0) summary = '...' + summary;
        if (end < this.content.length) summary = summary + '...';
      }
    }
    
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength) + '...';
    }
    
    return summary;
  }
}

export default KnowledgeEntry;