import express from 'express';
import { sessionManagementService } from '../services/SessionManagementService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// 创建新会话
router.post('/', async (req, res, next) => {
  try {
    const { problemCategory, problemDescription, userId } = req.body;
    
    // 验证请求参数
    if (!problemCategory || !problemDescription) {
      return res.status(400).json({
        error: '参数验证失败',
        message: '问题分类和问题描述不能为空'
      });
    }

    logger.info('创建新会话请求', {
      category: problemCategory,
      userId: userId || 'anonymous'
    });

    const result = await sessionManagementService.createSession(
      problemCategory,
      problemDescription,
      userId
    );

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// 执行处置步骤
router.post('/:id/step', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stepId, executionType = 'auto', userInput } = req.body;
    
    if (!stepId) {
      return res.status(400).json({
        error: '参数验证失败',
        message: '步骤ID不能为空'
      });
    }

    logger.info(`执行会话 ${id} 的处置步骤`, { stepId, executionType });

    const result = await sessionManagementService.executeStep(
      id,
      stepId,
      executionType,
      userInput
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// 反馈处置结果
router.post('/:id/feedback', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stepId, feedback } = req.body;
    
    if (!stepId || !feedback) {
      return res.status(400).json({
        error: '参数验证失败',
        message: '步骤ID和反馈内容不能为空'
      });
    }

    logger.info(`接收会话 ${id} 的反馈`, { stepId });

    const result = await sessionManagementService.processFeedback(
      id,
      stepId,
      feedback
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// 获取会话状态
router.get('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info(`获取会话 ${id} 状态`);

    const status = sessionManagementService.getSessionStatus(id);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

// 获取会话详情
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info(`获取会话 ${id} 详情`);

    const session = await sessionManagementService.getSession(id);
    
    if (!session) {
      return res.status(404).json({
        error: '会话不存在',
        message: `会话 ${id} 未找到`
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
});

// 完成会话
router.post('/:id/complete', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { summary } = req.body;
    
    logger.info(`完成会话 ${id}`);

    const result = await sessionManagementService.completeSession(id, summary);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// 删除会话
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info(`删除会话 ${id}`);

    await sessionManagementService.deleteSession(id);
    
    res.json({
      success: true,
      message: '会话删除成功'
    });
  } catch (error) {
    next(error);
  }
});

// 获取用户会话列表
router.get('/', async (req, res, next) => {
  try {
    const { userId, limit = 50, offset = 0, search, category, status } = req.query;
    
    let result;
    
    if (search) {
      // 搜索会话
      result = sessionManagementService.searchSessions(search, {
        userId,
        category,
        status,
        limit: parseInt(limit)
      });
    } else if (userId) {
      // 获取用户会话
      result = sessionManagementService.getUserSessions(
        userId,
        parseInt(limit),
        parseInt(offset)
      );
    } else {
      // 获取所有会话（管理员功能）
      result = sessionManagementService.searchSessions('', {
        category,
        status,
        limit: parseInt(limit)
      });
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// 导出会话数据
router.get('/:id/export', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;
    
    logger.info(`导出会话 ${id} 数据`, { format });

    const data = await sessionManagementService.exportSessionData(id, format);
    
    const filename = `session_${id}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
    } else if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
    }
    
    res.send(data);
  } catch (error) {
    next(error);
  }
});

// 获取统计信息
router.get('/stats/overview', async (req, res, next) => {
  try {
    logger.info('获取会话统计信息');

    const stats = sessionManagementService.getStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

export default router;