import express from 'express';
import { toolExecutionService } from '../services/ToolExecutionService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// 执行自动化工具
router.post('/execute', async (req, res, next) => {
  try {
    const { apiId, parameters = {}, options = {} } = req.body;
    
    if (!apiId) {
      return res.status(400).json({
        error: '参数验证失败',
        message: 'API ID不能为空'
      });
    }

    logger.info('执行自动化工具请求', { apiId });

    const result = await toolExecutionService.executeAPI(apiId, parameters, options);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// 获取可用工具列表
router.get('/list', async (req, res, next) => {
  try {
    logger.info('获取工具列表请求');

    const tools = toolExecutionService.getAvailableTools();
    
    res.json({
      success: true,
      data: {
        tools,
        total: tools.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取工具详情
router.get('/:apiId', async (req, res, next) => {
  try {
    const { apiId } = req.params;
    logger.info(`获取工具详情: ${apiId}`);

    const toolDetails = toolExecutionService.getToolDetails(apiId);
    
    if (!toolDetails) {
      return res.status(404).json({
        error: '工具不存在',
        message: `工具 ${apiId} 未找到`
      });
    }
    
    res.json({
      success: true,
      data: toolDetails
    });
  } catch (error) {
    next(error);
  }
});

// 测试工具连接
router.post('/:apiId/test', async (req, res, next) => {
  try {
    const { apiId } = req.params;
    const { testParameters = {} } = req.body;
    
    logger.info(`测试工具连接: ${apiId}`);

    const result = await toolExecutionService.testTool(apiId, testParameters);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// 获取执行历史
router.get('/history/:apiId?', async (req, res, next) => {
  try {
    const { apiId } = req.params;
    const { limit = 50 } = req.query;
    
    logger.info('获取执行历史', { apiId, limit });

    const history = toolExecutionService.getExecutionHistory(apiId, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        history,
        total: history.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// 清除执行历史
router.delete('/history/:apiId?', async (req, res, next) => {
  try {
    const { apiId } = req.params;
    
    logger.info('清除执行历史', { apiId });

    toolExecutionService.clearExecutionHistory(apiId);
    
    res.json({
      success: true,
      message: apiId ? `已清除工具 ${apiId} 的执行历史` : '已清除所有执行历史'
    });
  } catch (error) {
    next(error);
  }
});

// 获取服务状态
router.get('/status/service', async (req, res, next) => {
  try {
    logger.info('获取工具服务状态');

    const status = toolExecutionService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

export default router;