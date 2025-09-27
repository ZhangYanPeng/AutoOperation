import express from 'express';
import { sessionManagementService } from '../services/SessionManagementService.js';
import { logger } from '../utils/logger.js';

// 导入中间件
const {
  asyncHandler,
  validateSessionCreation,
  validateStepExecution,
  validateFeedback,
  validateSessionSearch,
  validateUUID,
  sessionCreationLimiter
} = require('../middleware/index.js');

const router = express.Router();

// 创建新会话
router.post('/', 
  sessionCreationLimiter, // 会话创建频率限制
  validateSessionCreation, // 验证输入参数
  asyncHandler(async (req, res) => {
    const { problem_category, problem_description, userId } = req.body;

    logger.info('创建新会话请求', {
      category: problem_category,
      userId: userId || 'anonymous'
    });

    const result = await sessionManagementService.createSession(
      problem_category,
      problem_description,
      userId
    );

    res.status(201).json({
      success: true,
      data: result
    });
  })
);

// 执行处置步骤
router.post('/:id/step', 
  validateUUID('id'), // 验证会话 ID
  validateStepExecution, // 验证步骤执行参数
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { stepId, executionType = 'auto', userInput } = req.body;

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
  })
);

// 反馈处置结果
router.post('/:id/feedback', 
  validateUUID('id'), // 验证会话 ID
  validateFeedback, // 验证反馈参数
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { stepId, feedback } = req.body;

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
  })
);

// 获取会话状态
router.get('/:id/status', 
  validateUUID('id'), // 验证会话 ID
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    logger.info(`获取会话 ${id} 状态`);

    const status = sessionManagementService.getSessionStatus(id);
    
    res.json({
      success: true,
      data: status
    });
  })
);

// 获取会话详情
router.get('/:id', 
  validateUUID('id'), // 验证会话 ID
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    logger.info(`获取会话 ${id} 详情`);

    const session = await sessionManagementService.getSession(id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          message: `会话 ${id} 未找到`
        }
      });
    }

    res.json({
      success: true,
      data: session
    });
  })
);

// 完成会话
router.post('/:id/complete', 
  validateUUID('id'), // 验证会话 ID
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { summary } = req.body;
    
    logger.info(`完成会话 ${id}`);

    const result = await sessionManagementService.completeSession(id, summary);
    
    res.json({
      success: true,
      data: result
    });
  })
);

// 删除会话
router.delete('/:id', 
  validateUUID('id'), // 验证会话 ID
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    logger.info(`删除会话 ${id}`);

    await sessionManagementService.deleteSession(id);
    
    res.json({
      success: true,
      message: '会话删除成功'
    });
  })
);

// 获取用户会话列表
router.get('/', 
  validateSessionSearch, // 验证搜索参数
  asyncHandler(async (req, res) => {
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
  })
);

// 导出会话数据
router.get('/:id/export', 
  validateUUID('id'), // 验证会话 ID
  asyncHandler(async (req, res) => {
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
  })
);

// 获取统计信息
router.get('/stats/overview', 
  asyncHandler(async (req, res) => {
    logger.info('获取会话统计信息');

    const stats = sessionManagementService.getStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  })
);

export default router;