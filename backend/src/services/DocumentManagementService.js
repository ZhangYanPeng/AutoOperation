/**
 * 文档管理服务
 * 负责知识库文档的上传、编辑、删除和管理功能
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { KnowledgeEntry } from '../models/KnowledgeEntry.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DocumentManagementService {
  constructor(knowledgeBaseService, fileStorageService, validationService) {
    this.knowledgeBaseService = knowledgeBaseService;
    this.fileStorageService = fileStorageService;
    this.validationService = validationService;
    this.knowledgeBasePath = knowledgeBaseService?.knowledgeBasePath || 
                             path.join(__dirname, '../../../knowledge-base');
  }

  /**
   * 上传文档
   */
  async uploadDocument(file, metadata = {}) {
    try {
      logger.info('开始上传文档', { fileName: file.originalname, size: file.size });

      // 验证文件
      const validationResult = await this.validationService.validateFile(file);
      if (!validationResult.isValid) {
        throw new Error(`文件验证失败: ${validationResult.errors.join(', ')}`);
      }

      // 解析文档内容
      const content = file.buffer ? file.buffer.toString('utf8') : 
                     await fs.readFile(file.path, 'utf8');
      
      // 提取元数据
      const extractedMetadata = this.extractMetadataFromMarkdown(content);
      const finalMetadata = { ...extractedMetadata, ...metadata };

      // 创建知识条目
      const knowledgeEntry = new KnowledgeEntry({
        knowledge_type: metadata.knowledge_type || 'operation-procedure',
        title: finalMetadata.title || this.extractTitleFromFilename(file.originalname),
        content: content,
        keywords: finalMetadata.keywords || [],
        category: metadata.category,
        priority: metadata.priority || 0,
        metadata: finalMetadata,
        author: metadata.uploader,
        file_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        upload_time: new Date().toISOString(),
        uploader: metadata.uploader,
        status: metadata.status || 'published',
        tags: metadata.tags || []
      });

      // 验证知识条目
      const entryValidation = knowledgeEntry.validate();
      if (!entryValidation.isValid) {
        throw new Error(`知识条目验证失败: ${entryValidation.errors.join(', ')}`);
      }

      // 保存文件
      const savedFilePath = await this.fileStorageService.saveFile(
        file, 
        metadata.category || 'general', 
        metadata.knowledge_type || 'operation-procedure'
      );

      knowledgeEntry.source_file = path.basename(savedFilePath);

      // 添加到知识库
      this.knowledgeBaseService.addKnowledgeEntry(knowledgeEntry);

      // 异步处理
      this.processDocumentAsync(knowledgeEntry);

      logger.info('文档上传成功', { 
        knowledgeId: knowledgeEntry.knowledge_id,
        filePath: savedFilePath 
      });

      return knowledgeEntry;
    } catch (error) {
      logger.error('文档上传失败:', error);
      throw error;
    }
  }

  /**
   * 更新文档
   */
  async updateDocument(knowledgeId, updates) {
    try {
      logger.info('开始更新文档', { knowledgeId, updates: Object.keys(updates) });

      const knowledgeEntry = this.knowledgeBaseService.getKnowledgeEntry(knowledgeId);
      if (!knowledgeEntry) {
        throw new Error(`知识条目不存在: ${knowledgeId}`);
      }

      if (knowledgeEntry.is_locked) {
        throw new Error('文档已被锁定，无法编辑');
      }

      // 创建版本快照
      knowledgeEntry.createVersionSnapshot('手动更新');

      // 更新字段
      if (updates.title) knowledgeEntry.title = updates.title;
      if (updates.content) knowledgeEntry.content = updates.content;
      if (updates.category) knowledgeEntry.category = updates.category;
      if (updates.keywords) knowledgeEntry.keywords = updates.keywords;
      if (updates.tags) knowledgeEntry.tags = updates.tags;
      if (updates.priority !== undefined) knowledgeEntry.priority = updates.priority;
      if (updates.status) knowledgeEntry.updateStatus(updates.status);

      // 更新元数据
      if (updates.metadata) {
        knowledgeEntry.metadata = { ...knowledgeEntry.metadata, ...updates.metadata };
      }

      // 如果内容更新，需要保存到文件
      if (updates.content) {
        await this.saveContentToFile(knowledgeEntry);
      }

      // 验证更新后的条目
      const validation = knowledgeEntry.validate();
      if (!validation.isValid) {
        throw new Error(`更新验证失败: ${validation.errors.join(', ')}`);
      }

      knowledgeEntry.last_updated = new Date().toISOString();

      logger.info('文档更新成功', { knowledgeId });
      return knowledgeEntry;
    } catch (error) {
      logger.error('文档更新失败:', error);
      throw error;
    }
  }

  /**
   * 删除文档
   */
  async deleteDocument(knowledgeId, permanent = false) {
    try {
      logger.info('开始删除文档', { knowledgeId, permanent });

      const knowledgeEntry = this.knowledgeBaseService.getKnowledgeEntry(knowledgeId);
      if (!knowledgeEntry) {
        throw new Error(`知识条目不存在: ${knowledgeId}`);
      }

      if (permanent) {
        // 硬删除
        await this.fileStorageService.deleteFile(knowledgeEntry.source_file);
        this.knowledgeBaseService.removeKnowledgeEntry(knowledgeId);
        logger.info('文档已永久删除', { knowledgeId });
      } else {
        // 软删除 - 移动到归档目录
        const archivedPath = await this.fileStorageService.moveToArchive(knowledgeEntry.source_file);
        knowledgeEntry.updateStatus('archived');
        knowledgeEntry.metadata.archived_at = new Date().toISOString();
        knowledgeEntry.metadata.archived_path = archivedPath;
        logger.info('文档已归档', { knowledgeId, archivedPath });
      }

      return true;
    } catch (error) {
      logger.error('文档删除失败:', error);
      throw error;
    }
  }

  /**
   * 移动文档到不同分类
   */
  async moveDocument(knowledgeId, targetCategory) {
    try {
      logger.info('开始移动文档', { knowledgeId, targetCategory });

      const knowledgeEntry = this.knowledgeBaseService.getKnowledgeEntry(knowledgeId);
      if (!knowledgeEntry) {
        throw new Error(`知识条目不存在: ${knowledgeId}`);
      }

      const oldCategory = knowledgeEntry.category;
      const newFilePath = await this.fileStorageService.moveFile(
        knowledgeEntry.source_file,
        oldCategory,
        targetCategory,
        knowledgeEntry.knowledge_type
      );

      knowledgeEntry.category = targetCategory;
      knowledgeEntry.source_file = path.basename(newFilePath);
      knowledgeEntry.last_updated = new Date().toISOString();

      logger.info('文档移动成功', { knowledgeId, oldCategory, targetCategory });
      return knowledgeEntry;
    } catch (error) {
      logger.error('文档移动失败:', error);
      throw error;
    }
  }

  /**
   * 复制文档
   */
  async duplicateDocument(knowledgeId, newTitle) {
    try {
      logger.info('开始复制文档', { knowledgeId, newTitle });

      const originalEntry = this.knowledgeBaseService.getKnowledgeEntry(knowledgeId);
      if (!originalEntry) {
        throw new Error(`知识条目不存在: ${knowledgeId}`);
      }

      // 创建新的知识条目
      const newEntry = new KnowledgeEntry({
        ...originalEntry.toJSON(),
        knowledge_id: uuidv4(),
        title: newTitle,
        file_name: `${newTitle}.md`,
        source_file: null,
        upload_time: new Date().toISOString(),
        version: '1.0.0',
        version_history: [],
        usage_count: 0
      });

      // 保存文件副本
      const newFilePath = await this.fileStorageService.saveContentAsFile(
        newEntry.content,
        newEntry.category,
        newEntry.knowledge_type,
        `${newTitle}.md`
      );

      newEntry.source_file = path.basename(newFilePath);

      // 添加到知识库
      this.knowledgeBaseService.addKnowledgeEntry(newEntry);

      logger.info('文档复制成功', { 
        originalId: knowledgeId, 
        newId: newEntry.knowledge_id 
      });

      return newEntry;
    } catch (error) {
      logger.error('文档复制失败:', error);
      throw error;
    }
  }

  /**
   * 批量操作
   */
  async batchOperation(operation, knowledgeIds, options = {}) {
    try {
      logger.info('开始批量操作', { operation, count: knowledgeIds.length });

      const results = [];
      const errors = [];

      for (const knowledgeId of knowledgeIds) {
        try {
          let result;
          switch (operation) {
            case 'delete':
              result = await this.deleteDocument(knowledgeId, options.permanent);
              break;
            case 'archive':
              result = await this.updateDocument(knowledgeId, { status: 'archived' });
              break;
            case 'publish':
              result = await this.updateDocument(knowledgeId, { status: 'published' });
              break;
            case 'move':
              result = await this.moveDocument(knowledgeId, options.targetCategory);
              break;
            default:
              throw new Error(`不支持的批量操作: ${operation}`);
          }
          results.push({ knowledgeId, success: true, result });
        } catch (error) {
          errors.push({ knowledgeId, error: error.message });
        }
      }

      logger.info('批量操作完成', { 
        operation, 
        total: knowledgeIds.length,
        success: results.length,
        errors: errors.length 
      });

      return {
        success: results,
        errors,
        summary: {
          total: knowledgeIds.length,
          success: results.length,
          failed: errors.length
        }
      };
    } catch (error) {
      logger.error('批量操作失败:', error);
      throw error;
    }
  }

  /**
   * 从Markdown中提取元数据
   */
  extractMetadataFromMarkdown(content) {
    const metadata = {};
    
    try {
      // 查找YAML前置元数据
      const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (yamlMatch) {
        const yamlContent = yamlMatch[1];
        // 简单解析YAML（这里使用基本的键值对解析）
        const lines = yamlContent.split('\n');
        lines.forEach(line => {
          const match = line.match(/^(\w+):\s*(.+)$/);
          if (match) {
            const [, key, value] = match;
            metadata[key] = value.trim().replace(/^["']|["']$/g, '');
          }
        });
      }

      // 查找HTML注释中的元数据
      const commentMatch = content.match(/<!--\s*metadata\s*([\s\S]*?)\s*-->/);
      if (commentMatch) {
        try {
          const commentMetadata = JSON.parse(commentMatch[1]);
          Object.assign(metadata, commentMetadata);
        } catch (error) {
          logger.warn('解析注释元数据失败:', error);
        }
      }

      // 自动提取关键词
      metadata.keywords = this.extractKeywordsFromContent(content);

    } catch (error) {
      logger.warn('提取元数据失败:', error);
    }

    return metadata;
  }

  /**
   * 从内容中提取关键词
   */
  extractKeywordsFromContent(content) {
    const keywords = new Set();
    
    // 提取标题中的关键词
    const headers = content.match(/#{1,6}\s+(.+)/g) || [];
    headers.forEach(header => {
      const text = header.replace(/#{1,6}\s+/, '');
      const words = text.split(/\s+/).filter(word => word.length > 2);
      words.forEach(word => keywords.add(word.toLowerCase()));
    });

    // 提取代码块中的技术术语
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    codeBlocks.forEach(block => {
      const techTerms = block.match(/\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b/g) || [];
      techTerms.forEach(term => keywords.add(term.toLowerCase()));
    });

    return Array.from(keywords).slice(0, 20); // 限制关键词数量
  }

  /**
   * 从文件名提取标题
   */
  extractTitleFromFilename(filename) {
    return path.basename(filename, path.extname(filename))
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * 保存内容到文件
   */
  async saveContentToFile(knowledgeEntry) {
    const filePath = await this.fileStorageService.getFilePath(
      knowledgeEntry.source_file,
      knowledgeEntry.category,
      knowledgeEntry.knowledge_type
    );
    await fs.writeFile(filePath, knowledgeEntry.content, 'utf8');
    knowledgeEntry.file_size = Buffer.byteLength(knowledgeEntry.content, 'utf8');
    knowledgeEntry.last_modified = new Date().toISOString();
  }

  /**
   * 异步处理文档
   */
  async processDocumentAsync(knowledgeEntry) {
    try {
      // 自动提取关键词
      const autoKeywords = this.extractKeywordsFromContent(knowledgeEntry.content);
      knowledgeEntry.addKeywords(autoKeywords);

      // 生成文档摘要
      const summary = this.generateDocumentSummary(knowledgeEntry.content);
      knowledgeEntry.metadata.summary = summary;

      logger.info('文档异步处理完成', { knowledgeId: knowledgeEntry.knowledge_id });
    } catch (error) {
      logger.error('文档异步处理失败:', error);
    }
  }

  /**
   * 生成文档摘要
   */
  generateDocumentSummary(content, maxLength = 200) {
    // 移除Markdown标记
    const cleanContent = content
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 提取前几个段落
    const paragraphs = cleanContent.split('\n\n').filter(p => p.trim());
    let summary = '';
    
    for (const paragraph of paragraphs) {
      if (summary.length + paragraph.length > maxLength) {
        break;
      }
      summary += (summary ? ' ' : '') + paragraph.trim();
    }

    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength) + '...';
    }

    return summary || '无摘要信息';
  }

  /**
   * 获取文档统计信息
   */
  getDocumentStatistics() {
    const allEntries = Array.from(this.knowledgeBaseService.knowledgeEntries.values());
    
    const stats = {
      total: allEntries.length,
      byType: {},
      byCategory: {},
      byStatus: {},
      recentUploads: 0,
      totalSize: 0
    };

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    allEntries.forEach(entry => {
      // 按类型统计
      stats.byType[entry.knowledge_type] = (stats.byType[entry.knowledge_type] || 0) + 1;
      
      // 按分类统计
      const category = entry.category || 'uncategorized';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      
      // 按状态统计
      stats.byStatus[entry.status] = (stats.byStatus[entry.status] || 0) + 1;
      
      // 最近上传统计
      if (entry.upload_time && new Date(entry.upload_time) > oneWeekAgo) {
        stats.recentUploads++;
      }
      
      // 总大小
      stats.totalSize += entry.file_size || 0;
    });

    return stats;
  }
}

export default DocumentManagementService;