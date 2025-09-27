import express from 'express';
import { knowledgeBaseService } from '../services/KnowledgeBaseService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// 搜索知识库
router.get('/search', async (req, res, next) => {
  try {
    const { query, type = 'all', category, limit = 10, minScore = 0.1 } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        error: '参数验证失败',
        message: '查询关键词不能为空'
      });
    }

    logger.info(`搜索知识库: ${query}, 类型: ${type}`);

    const results = knowledgeBaseService.search(query, {
      type,
      category,
      limit: parseInt(limit),
      minScore: parseFloat(minScore)
    });
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
});

// 获取知识条目详情
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info(`获取知识条目详情: ${id}`);

    const knowledgeEntry = knowledgeBaseService.getKnowledgeEntry(id);
    
    if (!knowledgeEntry) {
      return res.status(404).json({
        error: '知识条目不存在',
        message: `知识条目 ${id} 未找到`
      });
    }
    
    res.json({
      success: true,
      data: knowledgeEntry
    });
  } catch (error) {
    next(error);
  }
});

// 按分类获取知识条目
router.get('/category/:category', async (req, res, next) => {
  try {
    const { category } = req.params;
    const { limit = 20 } = req.query;
    
    logger.info(`按分类获取知识条目: ${category}`);

    const entries = knowledgeBaseService.getByCategory(category, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        category,
        entries,
        total: entries.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取推荐知识条目
router.get('/recommendations/:category?', async (req, res, next) => {
  try {
    const { category } = req.params;
    const { limit = 5 } = req.query;
    
    logger.info('获取推荐知识条目', { category });

    const recommendations = knowledgeBaseService.getRecommendations(
      category || 'general',
      parseInt(limit)
    );
    
    res.json({
      success: true,
      data: {
        recommendations,
        total: recommendations.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// 更新知识条目有效性评分
router.post('/:id/effectiveness', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { score } = req.body;
    
    if (score === undefined || score < 0 || score > 1) {
      return res.status(400).json({
        error: '参数验证失败',
        message: '有效性评分必须在0-1之间'
      });
    }
    
    logger.info(`更新知识条目有效性评分: ${id} -> ${score}`);

    knowledgeBaseService.updateEffectivenessScore(id, score);
    
    res.json({
      success: true,
      message: '有效性评分更新成功'
    });
  } catch (error) {
    next(error);
  }
});

// 获取知识库统计信息
router.get('/stats/overview', async (req, res, next) => {
  try {
    logger.info('获取知识库统计信息');

    const stats = knowledgeBaseService.getStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// 重新加载知识库
router.post('/reload', async (req, res, next) => {
  try {
    logger.info('重新加载知识库');

    await knowledgeBaseService.reload();
    
    res.json({
      success: true,
      message: '知识库重新加载成功'
    });
  } catch (error) {
    next(error);
  }
});

export default router;