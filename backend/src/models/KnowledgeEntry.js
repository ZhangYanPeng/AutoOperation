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
    source_file = null,
    // 新增文档管理相关字段
    file_name = null,
    file_size = 0,
    mime_type = 'text/markdown',
    upload_time = null,
    last_modified = null,
    uploader = null,
    status = 'published', // draft, published, archived
    version_history = [],
    tags = [],
    is_locked = false
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
    
    // 文档管理扩展字段
    this.file_name = file_name;
    this.file_size = file_size;
    this.mime_type = mime_type;
    this.upload_time = upload_time;
    this.last_modified = last_modified;
    this.uploader = uploader;
    this.status = status;
    this.version_history = Array.isArray(version_history) ? version_history : [];
    this.tags = Array.isArray(tags) ? tags : [];
    this.is_locked = is_locked;
    
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
    
    // 验证文档管理相关字段
    const validStatuses = ['draft', 'published', 'archived'];
    if (!validStatuses.includes(this.status)) {
      errors.push(`文档状态必须是以下之一: ${validStatuses.join(', ')}`);
    }
    
    if (this.file_size < 0) {
      errors.push('文件大小不能为负数');
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
   * 添加标签
   */
  addTags(newTags) {
    const tagsToAdd = Array.isArray(newTags) ? newTags : [newTags];
    tagsToAdd.forEach(tag => {
      if (tag && !this.tags.includes(tag.toLowerCase())) {
        this.tags.push(tag.toLowerCase());
      }
    });
    this.last_updated = new Date().toISOString();
  }
  
  /**
   * 移除标签
   */
  removeTags(tagsToRemove) {
    const tagsArray = Array.isArray(tagsToRemove) ? tagsToRemove : [tagsToRemove];
    tagsArray.forEach(tag => {
      const index = this.tags.indexOf(tag.toLowerCase());
      if (index !== -1) {
        this.tags.splice(index, 1);
      }
    });
    this.last_updated = new Date().toISOString();
  }
  
  /**
   * 更新文档状态
   */
  updateStatus(newStatus) {
    const validStatuses = ['draft', 'published', 'archived'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`无效的文档状态: ${newStatus}`);
    }
    this.status = newStatus;
    this.last_updated = new Date().toISOString();
  }
  
  /**
   * 锁定文档
   */
  lock(lockingUser = null) {
    this.is_locked = true;
    if (lockingUser) {
      this.metadata.locked_by = lockingUser;
      this.metadata.locked_at = new Date().toISOString();
    }
    this.last_updated = new Date().toISOString();
  }
  
  /**
   * 解锁文档
   */
  unlock() {
    this.is_locked = false;
    if (this.metadata.locked_by) {
      delete this.metadata.locked_by;
      delete this.metadata.locked_at;
    }
    this.last_updated = new Date().toISOString();
  }
  
  /**
   * 创建版本快照
   */
  createVersionSnapshot(description = '') {
    const snapshot = {
      version: this.version,
      title: this.title,
      content: this.content,
      keywords: [...this.keywords],
      tags: [...this.tags],
      category: this.category,
      metadata: { ...this.metadata },
      timestamp: new Date().toISOString(),
      description
    };
    
    this.version_history.push(snapshot);
    
    // 只保留最近10个版本
    if (this.version_history.length > 10) {
      this.version_history = this.version_history.slice(-10);
    }
    
    this.last_updated = new Date().toISOString();
    return snapshot;
  }
  
  /**
   * 更新文档内容并创建版本快照
   */
  updateContent(newContent, description = '内容更新') {
    if (this.is_locked) {
      throw new Error('文档已被锁定，无法编辑');
    }
    
    // 创建当前版本快照
    this.createVersionSnapshot(description);
    
    // 更新内容
    this.content = newContent;
    
    // 更新版本号
    const versionParts = this.version.split('.');
    versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
    this.version = versionParts.join('.');
    
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
      // 新增字段
      file_name: this.file_name,
      file_size: this.file_size,
      mime_type: this.mime_type,
      upload_time: this.upload_time,
      last_modified: this.last_modified,
      uploader: this.uploader,
      status: this.status,
      version_history: this.version_history,
      tags: this.tags,
      is_locked: this.is_locked,
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