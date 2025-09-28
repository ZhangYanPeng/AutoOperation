/**
 * 统一搜索控制器
 * 提供智能搜索路由和跨知识库搜索功能
 */

import express from 'express';
import { searchRouterService } from '../services/SearchRouterService.js';
import { troubleKnowledgeService } from '../services/TroubleKnowledgeService.js';
import { deviceAPIService } from '../services/DeviceAPIService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// 统一智能搜索接口
router.get('/', async (req, res, next) => {
  try {
    const { 
      q: query, 
      limit = 10, 
      scope = 'all', 
      strategy = 'auto',
      categories = true 
    } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        error: '参数验证失败',
        message: '搜索查询不能为空'
      });
    }

    logger.info(`统一搜索: ${query}, 范围: ${scope}, 策略: ${strategy}`);

    const results = await searchRouterService.search(query, {
      limit: parseInt(limit),
      searchScope: scope,
      strategy,
      includeCategories: categories === 'true'
    });
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
});

// 故障症状诊断接口
router.post('/diagnose', async (req, res, next) => {
  try {
    const { symptoms, category_id, limit = 5 } = req.body;
    
    if (!symptoms || symptoms.trim() === '') {
      return res.status(400).json({
        error: '参数验证失败',
        message: '故障症状描述不能为空'
      });
    }

    logger.info(`故障诊断: ${symptoms}`);

    const diagnosisResults = troubleKnowledgeService.diagnoseBySymptoms(symptoms, {
      category_id,
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: diagnosisResults
    });
  } catch (error) {
    next(error);
  }
});

// API端点搜索接口
router.get('/api-endpoint', async (req, res, next) => {
  try {
    const { method, path, exact = false, limit = 10 } = req.query;
    
    if (!method || !path) {
      return res.status(400).json({
        error: '参数验证失败',
        message: 'HTTP方法和路径参数是必需的'
      });
    }

    logger.info(`API端点搜索: ${method} ${path}`);

    const results = deviceAPIService.searchByEndpoint(method, path, {
      exact: exact === 'true',
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
});

// 故障处置知识搜索
router.get('/trouble', async (req, res, next) => {
  try {
    const { 
      q: query, 
      category_id, 
      searchType = 'all', 
      limit = 10 
    } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        error: '参数验证失败',
        message: '搜索查询不能为空'
      });
    }

    logger.info(`故障处置知识搜索: ${query}`);

    const results = troubleKnowledgeService.searchTroubleKnowledge(query, {
      category_id,
      searchType,
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
});

// 设备API知识搜索
router.get('/device-api', async (req, res, next) => {
  try {
    const { 
      q: query, 
      category_id, 
      apiType, 
      method, 
      limit = 10 
    } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        error: '参数验证失败',
        message: '搜索查询不能为空'
      });
    }

    logger.info(`设备API知识搜索: ${query}`);

    const results = deviceAPIService.searchAPIKnowledge(query, {
      category_id,
      apiType,
      method,
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
});

// 获取推荐的诊断流程
router.get('/trouble/diagnostic-flows/:categoryId?', async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { complexity = 'all', limit = 10 } = req.query;

    logger.info(`获取诊断流程: 分类=${categoryId || 'all'}, 复杂度=${complexity}`);

    const flows = troubleKnowledgeService.getRecommendedDiagnosticFlow(categoryId, {
      complexity,
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: {
        categoryId,
        complexity,
        flows,
        total: flows.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取API版本信息
router.get('/device-api/versions', async (req, res, next) => {
  try {
    const { category_id, groupBy = 'category' } = req.query;

    logger.info(`获取API版本信息: 分类=${category_id || 'all'}, 分组=${groupBy}`);

    const versions = deviceAPIService.getAPIVersions({
      category_id,
      groupBy
    });
    
    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    next(error);
  }
});

// 生成API集成代码
router.post('/device-api/generate-code', async (req, res, next) => {
  try {
    const { 
      entryId, 
      language = 'javascript', 
      includeAuth = true, 
      includeErrorHandling = true,
      style = 'modern'
    } = req.body;
    
    if (!entryId) {
      return res.status(400).json({
        error: '参数验证失败',
        message: 'API条目ID是必需的'
      });
    }

    logger.info(`生成API集成代码: ${entryId}, 语言: ${language}`);

    const code = deviceAPIService.generateIntegrationCode(entryId, language, {
      includeAuth,
      includeErrorHandling,
      style
    });
    
    res.json({
      success: true,
      data: {
        entryId,
        language,
        code,
        options: {
          includeAuth,
          includeErrorHandling,
          style
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// 搜索统计和分析
router.get('/stats', async (req, res, next) => {
  try {
    logger.info('获取搜索服务统计信息');

    const searchStats = searchRouterService.getStatistics();
    const troubleStats = troubleKnowledgeService.getStatistics();
    const deviceStats = deviceAPIService.getStatistics();
    
    res.json({
      success: true,
      data: {
        searchRouter: searchStats,
        troubleKnowledge: troubleStats,
        deviceAPI: deviceStats,
        summary: {
          totalKnowledge: troubleStats.total_entries + deviceStats.total_apis,
          totalCategories: troubleStats.total_categories + deviceStats.total_categories,
          searchStrategies: searchStats.strategiesCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// 清除搜索缓存
router.post('/cache/clear', async (req, res, next) => {
  try {
    logger.info('清除搜索缓存');

    searchRouterService.clearCache();
    
    res.json({
      success: true,
      message: '搜索缓存已清除'
    });
  } catch (error) {
    next(error);
  }
});

export default router;