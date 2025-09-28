/**
 * 分类管理控制器
 * 提供分类的CRUD操作和层级管理功能
 */

import express from 'express';
import { categoryService } from '../services/CategoryService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// 获取指定类型的所有分类
router.get('/type/:knowledgeType', async (req, res, next) => {
  try {
    const { knowledgeType } = req.params;
    const { includeInactive = false, tree = false } = req.query;
    
    const validTypes = ['operation-procedure', 'device-api'];
    if (!validTypes.includes(knowledgeType)) {
      return res.status(400).json({
        error: '参数验证失败',
        message: `知识类型必须是以下之一: ${validTypes.join(', ')}`
      });
    }

    logger.info(`获取分类列表: ${knowledgeType}, tree=${tree}`);

    let categories;
    if (tree === 'true') {
      categories = categoryService.getCategoryTree(knowledgeType, includeInactive === 'true');
    } else {
      categories = categoryService.getCategoriesByType(knowledgeType, includeInactive === 'true');
    }
    
    res.json({
      success: true,
      data: {
        knowledge_type: knowledgeType,
        categories,
        total: categories.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取分类详情
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info(`获取分类详情: ${id}`);

    const category = categoryService.getCategory(id);
    
    if (!category) {
      return res.status(404).json({
        error: '分类不存在',
        message: `分类 ${id} 未找到`
      });
    }
    
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
});

// 获取分类路径
router.get('/:id/path', async (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info(`获取分类路径: ${id}`);

    const path = categoryService.getCategoryPath(id);
    
    res.json({
      success: true,
      data: {
        category_id: id,
        path
      }
    });
  } catch (error) {
    next(error);
  }
});

// 搜索分类
router.get('/search/:knowledgeType?', async (req, res, next) => {
  try {
    const { knowledgeType } = req.params;
    const { query } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        error: '参数验证失败',
        message: '搜索关键词不能为空'
      });
    }

    logger.info(`搜索分类: ${query}, 类型: ${knowledgeType || 'all'}`);

    const categories = categoryService.searchCategories(query, knowledgeType);
    
    res.json({
      success: true,
      data: {
        query,
        knowledge_type: knowledgeType,
        categories,
        total: categories.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// 创建分类
router.post('/', async (req, res, next) => {
  try {
    const categoryData = req.body;
    
    // 基本验证
    if (!categoryData.knowledge_type || !categoryData.display_name_zh) {
      return res.status(400).json({
        error: '参数验证失败',
        message: '知识类型和中文显示名称是必填字段'
      });
    }

    // 添加创建者信息
    categoryData.created_by = req.user?.id || 'system';
    categoryData.updated_by = req.user?.id || 'system';

    logger.info('创建分类:', categoryData);

    const category = await categoryService.createCategory(categoryData);
    
    res.status(201).json({
      success: true,
      data: category,
      message: '分类创建成功'
    });
  } catch (error) {
    next(error);
  }
});

// 更新分类
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // 添加更新者信息
    updates.updated_by = req.user?.id || 'system';

    logger.info(`更新分类: ${id}`, updates);

    const category = await categoryService.updateCategory(id, updates);
    
    res.json({
      success: true,
      data: category,
      message: '分类更新成功'
    });
  } catch (error) {
    next(error);
  }
});

// 移动分类
router.post('/:id/move', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { parent_category } = req.body;

    logger.info(`移动分类: ${id} -> ${parent_category || '根级别'}`);

    const category = await categoryService.moveCategory(id, parent_category);
    
    res.json({
      success: true,
      data: category,
      message: '分类移动成功'
    });
  } catch (error) {
    next(error);
  }
});

// 批量更新排序
router.post('/batch/reorder', async (req, res, next) => {
  try {
    const { orderUpdates } = req.body;
    
    if (!Array.isArray(orderUpdates)) {
      return res.status(400).json({
        error: '参数验证失败',
        message: 'orderUpdates 必须是数组'
      });
    }

    logger.info('批量更新分类排序:', orderUpdates);

    await categoryService.updateCategoriesOrder(orderUpdates);
    
    res.json({
      success: true,
      message: '分类排序更新成功'
    });
  } catch (error) {
    next(error);
  }
});

// 删除分类
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info(`删除分类: ${id}`);

    await categoryService.deleteCategory(id);
    
    res.json({
      success: true,
      message: '分类删除成功'
    });
  } catch (error) {
    next(error);
  }
});

// 获取分类统计信息
router.get('/stats/overview', async (req, res, next) => {
  try {
    logger.info('获取分类统计信息');

    const stats = categoryService.getStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// 重新加载分类数据
router.post('/reload', async (req, res, next) => {
  try {
    logger.info('重新加载分类数据');

    await categoryService.reload();
    
    res.json({
      success: true,
      message: '分类数据重新加载成功'
    });
  } catch (error) {
    next(error);
  }
});

export default router;