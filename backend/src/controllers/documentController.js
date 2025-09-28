/**
 * 文档管理控制器
 * 处理知识库文档的上传、编辑、删除和管理请求
 */

import express from 'express';
import { DocumentManagementService } from '../services/DocumentManagementService.js';
import { FileStorageService } from '../services/FileStorageService.js';
import { ValidationService } from '../services/ValidationService.js';
import { knowledgeBaseService } from '../services/KnowledgeBaseService.js';
import { logger } from '../utils/logger.js';
import uploadMiddleware from '../middleware/uploadMiddleware.js';

const router = express.Router();

// 初始化服务
const fileStorageService = new FileStorageService();
const validationService = new ValidationService();
const documentManagementService = new DocumentManagementService(
  knowledgeBaseService,
  fileStorageService,
  validationService
);

// 上传文档
router.post('/upload', 
  uploadMiddleware.validateUploadPermission,
  uploadMiddleware.uploadRateLimit,
  uploadMiddleware.uploadSingle,
  uploadMiddleware.handleUploadErrors,
  uploadMiddleware.preprocessFile,
  uploadMiddleware.cleanupTempFiles,
  async (req, res, next) => {
  try {
    const { category, knowledge_type, priority, status, tags, uploader } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        error: '参数验证失败',
        message: '请选择要上传的文件'
      });
    }

    const metadata = {
      category: category || 'general',
      knowledge_type: knowledge_type || 'operation-procedure',
      priority: parseInt(priority) || 0,
      status: status || 'published',
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
      uploader: uploader || 'anonymous'
    };

    logger.info('开始上传文档', { 
      filename: req.file.originalname,
      metadata 
    });

    const knowledgeEntry = await documentManagementService.uploadDocument(req.file, metadata);

    res.status(201).json({
      success: true,
      message: '文档上传成功',
      data: {
        knowledge_id: knowledgeEntry.knowledge_id,
        title: knowledgeEntry.title,
        file_name: knowledgeEntry.file_name,
        file_size: knowledgeEntry.file_size,
        upload_time: knowledgeEntry.upload_time
      }
    });
  } catch (error) {
    logger.error('文档上传失败:', error);
    next(error);
  }
});

// 更新文档
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    logger.info('开始更新文档', { id, updates: Object.keys(updates) });

    const updatedEntry = await documentManagementService.updateDocument(id, updates);

    res.json({
      success: true,
      message: '文档更新成功',
      data: updatedEntry.toJSON()
    });
  } catch (error) {
    if (error.message.includes('不存在') || error.message.includes('未找到')) {
      return res.status(404).json({
        error: '文档不存在',
        message: error.message
      });
    }
    
    if (error.message.includes('已被锁定')) {
      return res.status(423).json({
        error: '文档已锁定',
        message: error.message
      });
    }
    
    logger.error('文档更新失败:', error);
    next(error);
  }
});

// 删除文档
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;
    
    logger.info('开始删除文档', { id, permanent });

    await documentManagementService.deleteDocument(id, permanent === 'true');

    res.json({
      success: true,
      message: permanent === 'true' ? '文档已永久删除' : '文档已移至回收站'
    });
  } catch (error) {
    if (error.message.includes('不存在') || error.message.includes('未找到')) {
      return res.status(404).json({
        error: '文档不存在',
        message: error.message
      });
    }
    
    logger.error('文档删除失败:', error);
    next(error);
  }
});

// 下载文档
router.get('/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    logger.info('开始下载文档', { id });

    const knowledgeEntry = knowledgeBaseService.getKnowledgeEntry(id);
    if (!knowledgeEntry) {
      return res.status(404).json({
        error: '文档不存在',
        message: `文档 ${id} 未找到`
      });
    }

    // 更新使用计数
    knowledgeEntry.incrementUsage();

    const fileName = knowledgeEntry.file_name || `${knowledgeEntry.title}.md`;
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', Buffer.byteLength(knowledgeEntry.content, 'utf8'));
    
    res.send(knowledgeEntry.content);
  } catch (error) {
    logger.error('文档下载失败:', error);
    next(error);
  }
});

// 复制文档
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({
        error: '参数验证失败',
        message: '新文档标题不能为空'
      });
    }
    
    logger.info('开始复制文档', { id, title });

    const newEntry = await documentManagementService.duplicateDocument(id, title.trim());

    res.status(201).json({
      success: true,
      message: '文档复制成功',
      data: {
        knowledge_id: newEntry.knowledge_id,
        title: newEntry.title,
        original_id: id
      }
    });
  } catch (error) {
    if (error.message.includes('不存在') || error.message.includes('未找到')) {
      return res.status(404).json({
        error: '文档不存在',
        message: error.message
      });
    }
    
    logger.error('文档复制失败:', error);
    next(error);
  }
});

// 移动文档
router.post('/:id/move', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { target_category } = req.body;
    
    if (!target_category || target_category.trim() === '') {
      return res.status(400).json({
        error: '参数验证失败',
        message: '目标分类不能为空'
      });
    }
    
    logger.info('开始移动文档', { id, target_category });

    const updatedEntry = await documentManagementService.moveDocument(id, target_category.trim());

    res.json({
      success: true,
      message: '文档移动成功',
      data: {
        knowledge_id: updatedEntry.knowledge_id,
        old_category: req.body.old_category,
        new_category: updatedEntry.category
      }
    });
  } catch (error) {
    if (error.message.includes('不存在') || error.message.includes('未找到')) {
      return res.status(404).json({
        error: '文档不存在',
        message: error.message
      });
    }
    
    logger.error('文档移动失败:', error);
    next(error);
  }
});

// 锁定/解锁文档
router.post('/:id/lock', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, user } = req.body; // action: 'lock' | 'unlock'
    
    logger.info('文档锁定操作', { id, action, user });

    const knowledgeEntry = knowledgeBaseService.getKnowledgeEntry(id);
    if (!knowledgeEntry) {
      return res.status(404).json({
        error: '文档不存在',
        message: `文档 ${id} 未找到`
      });
    }

    if (action === 'lock') {
      knowledgeEntry.lock(user);
    } else if (action === 'unlock') {
      knowledgeEntry.unlock();
    } else {
      return res.status(400).json({
        error: '参数验证失败',
        message: 'action 必须是 lock 或 unlock'
      });
    }

    res.json({
      success: true,
      message: action === 'lock' ? '文档已锁定' : '文档已解锁',
      data: {
        knowledge_id: id,
        is_locked: knowledgeEntry.is_locked,
        locked_by: knowledgeEntry.metadata.locked_by,
        locked_at: knowledgeEntry.metadata.locked_at
      }
    });
  } catch (error) {
    logger.error('文档锁定操作失败:', error);
    next(error);
  }
});

// 批量操作
router.post('/batch', async (req, res, next) => {
  try {
    const { action, ids, options = {} } = req.body;
    
    // 验证批量操作
    const validation = validationService.validateBatchOperation(action, ids, options);
    if (!validation.isValid) {
      return res.status(400).json({
        error: '参数验证失败',
        message: validation.errors.join(', ')
      });
    }
    
    logger.info('开始批量操作', { action, count: ids.length });

    const results = await documentManagementService.batchOperation(action, ids, options);

    res.json({
      success: true,
      message: `批量${action}操作完成`,
      data: results
    });
  } catch (error) {
    logger.error('批量操作失败:', error);
    next(error);
  }
});

// 获取文档版本历史
router.get('/:id/versions', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    logger.info('获取文档版本历史', { id });

    const knowledgeEntry = knowledgeBaseService.getKnowledgeEntry(id);
    if (!knowledgeEntry) {
      return res.status(404).json({
        error: '文档不存在',
        message: `文档 ${id} 未找到`
      });
    }

    res.json({
      success: true,
      data: {
        knowledge_id: id,
        current_version: knowledgeEntry.version,
        version_history: knowledgeEntry.version_history
      }
    });
  } catch (error) {
    logger.error('获取版本历史失败:', error);
    next(error);
  }
});

// 恢复文档版本
router.post('/:id/versions/:versionIndex/restore', async (req, res, next) => {
  try {
    const { id, versionIndex } = req.params;
    
    logger.info('恢复文档版本', { id, versionIndex });

    const knowledgeEntry = knowledgeBaseService.getKnowledgeEntry(id);
    if (!knowledgeEntry) {
      return res.status(404).json({
        error: '文档不存在',
        message: `文档 ${id} 未找到`
      });
    }

    if (knowledgeEntry.is_locked) {
      return res.status(423).json({
        error: '文档已锁定',
        message: '无法恢复已锁定的文档版本'
      });
    }

    const index = parseInt(versionIndex);
    if (isNaN(index) || index < 0 || index >= knowledgeEntry.version_history.length) {
      return res.status(400).json({
        error: '参数验证失败',
        message: '无效的版本索引'
      });
    }

    const versionSnapshot = knowledgeEntry.version_history[index];
    
    // 创建当前版本快照
    knowledgeEntry.createVersionSnapshot('版本恢复前备份');
    
    // 恢复版本
    knowledgeEntry.title = versionSnapshot.title;
    knowledgeEntry.content = versionSnapshot.content;
    knowledgeEntry.keywords = [...versionSnapshot.keywords];
    knowledgeEntry.tags = [...versionSnapshot.tags];
    knowledgeEntry.category = versionSnapshot.category;
    knowledgeEntry.metadata = { ...versionSnapshot.metadata };
    
    // 更新版本号
    const versionParts = knowledgeEntry.version.split('.');
    versionParts[1] = (parseInt(versionParts[1]) + 1).toString();
    versionParts[2] = '0';
    knowledgeEntry.version = versionParts.join('.');
    
    knowledgeEntry.last_updated = new Date().toISOString();

    res.json({
      success: true,
      message: '文档版本恢复成功',
      data: {
        knowledge_id: id,
        restored_version: versionSnapshot.version,
        current_version: knowledgeEntry.version
      }
    });
  } catch (error) {
    logger.error('文档版本恢复失败:', error);
    next(error);
  }
});

// 获取文档管理统计信息
router.get('/stats', async (req, res, next) => {
  try {
    logger.info('获取文档管理统计信息');

    const docStats = documentManagementService.getDocumentStatistics();
    const storageStats = await fileStorageService.getStorageStatistics();

    res.json({
      success: true,
      data: {
        documents: docStats,
        storage: storageStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('获取统计信息失败:', error);
    next(error);
  }
});

// 清理临时文件
router.post('/cleanup', async (req, res, next) => {
  try {
    const { maxAge } = req.body; // 最大年龄（毫秒）
    
    logger.info('开始清理临时文件', { maxAge });

    const cleanedCount = await fileStorageService.cleanupTempFiles(maxAge);

    res.json({
      success: true,
      message: '临时文件清理完成',
      data: {
        cleaned_files: cleanedCount
      }
    });
  } catch (error) {
    logger.error('清理临时文件失败:', error);
    next(error);
  }
});

// 获取所有文档列表
router.get('/list', async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      knowledge_type, 
      status, 
      sort = 'last_updated',
      order = 'desc'
    } = req.query;

    logger.info('获取文档列表', { 
      page, limit, category, knowledge_type, status, sort, order 
    });

    const allEntries = Array.from(knowledgeBaseService.knowledgeEntries.values());
    
    // 过滤
    let filteredEntries = allEntries;
    
    if (category) {
      filteredEntries = filteredEntries.filter(entry => entry.category === category);
    }
    
    if (knowledge_type) {
      filteredEntries = filteredEntries.filter(entry => entry.knowledge_type === knowledge_type);
    }
    
    if (status) {
      filteredEntries = filteredEntries.filter(entry => entry.status === status);
    }

    // 排序
    filteredEntries.sort((a, b) => {
      let aValue = a[sort];
      let bValue = b[sort];
      
      if (sort === 'last_updated' || sort === 'created_at' || sort === 'upload_time') {
        aValue = new Date(aValue || 0);
        bValue = new Date(bValue || 0);
      }
      
      if (order === 'desc') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });

    // 分页
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    
    const paginatedEntries = filteredEntries.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredEntries.length / limitNum);

    res.json({
      success: true,
      data: {
        documents: paginatedEntries.map(entry => entry.toJSON()),
        pagination: {
          current_page: pageNum,
          total_pages: totalPages,
          total_items: filteredEntries.length,
          items_per_page: limitNum,
          has_next: pageNum < totalPages,
          has_prev: pageNum > 1
        }
      }
    });
  } catch (error) {
    logger.error('获取文档列表失败:', error);
    next(error);
  }
});

export default router;