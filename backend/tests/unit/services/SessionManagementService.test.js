/**
 * 会话管理服务单元测试
 */

const { SessionManagementService } = require('../src/services/SessionManagementService');

// Mock依赖服务
jest.mock('../src/services/LLMService');
jest.mock('../src/services/KnowledgeBaseService');
jest.mock('../src/services/ToolExecutionService');

const mockLLMService = {
  analyzeProblem: jest.fn(),
  generateSteps: jest.fn(),
  evaluateResult: jest.fn()
};

const mockKnowledgeService = {
  searchKnowledge: jest.fn(),
  recommendDocuments: jest.fn()
};

const mockToolService = {
  executeCommand: jest.fn(),
  getAvailableTools: jest.fn()
};

describe('SessionManagementService', () => {
  let sessionService;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();
    
    // 设置默认mock返回值
    mockLLMService.analyzeProblem.mockResolvedValue({
      category: 'network',
      severity: 'medium',
      description: '网络连接问题',
      potential_causes: ['DNS解析失败']
    });

    mockLLMService.generateSteps.mockResolvedValue([
      {
        step_order: 1,
        step_content: '检查网络连接状态',
        step_type: 'manual',
        estimated_time: 5
      },
      {
        step_order: 2,
        step_content: '重启网络服务',
        step_type: 'auto',
        tool_api: 'system_restart_service',
        estimated_time: 2
      }
    ]);

    mockKnowledgeService.recommendDocuments.mockResolvedValue([
      {
        title: '网络故障处理指南',
        relevance_score: 0.9,
        content: '网络故障处理步骤...'
      }
    ]);

    sessionService = new SessionManagementService(
      mockLLMService,
      mockKnowledgeService,
      mockToolService
    );
    
    sessionService.initialize();
  });

  describe('会话创建', () => {
    test('应该成功创建会话', async () => {
      const problemCategory = 'network';
      const problemDescription = '网络连接超时';
      const userId = 'user123';

      const result = await sessionService.createSession(
        problemCategory,
        problemDescription,
        userId
      );

      expect(result).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.session.session_id).toBeDefined();
      expect(result.session.problem_category).toBe(problemCategory);
      expect(result.session.problem_description).toBe(problemDescription);
      expect(result.session.user_id).toBe(userId);
      expect(result.session.status).toBe('processing');
      expect(Array.isArray(result.session.steps)).toBe(true);

      // 验证服务调用
      expect(mockLLMService.analyzeProblem).toHaveBeenCalledWith(
        problemDescription,
        problemCategory
      );
      expect(mockLLMService.generateSteps).toHaveBeenCalled();
      expect(mockKnowledgeService.recommendDocuments).toHaveBeenCalled();
    });

    test('应该处理问题分析失败', async () => {
      mockLLMService.analyzeProblem.mockRejectedValue(new Error('分析失败'));

      await expect(sessionService.createSession(
        'network',
        '网络问题',
        'user123'
      )).rejects.toThrow('分析失败');
    });

    test('应该验证输入参数', async () => {
      await expect(sessionService.createSession(
        '',
        '网络问题',
        'user123'
      )).rejects.toThrow('问题分类不能为空');

      await expect(sessionService.createSession(
        'network',
        '',
        'user123'
      )).rejects.toThrow('问题描述不能为空');
    });
  });

  describe('步骤执行', () => {
    let session;

    beforeEach(async () => {
      const result = await sessionService.createSession(
        'network',
        '网络连接问题',
        'user123'
      );
      session = result.session;
    });

    test('应该执行手动步骤', async () => {
      const step = session.steps[0]; // 手动步骤
      const userInput = '网络连接正常';

      const result = await sessionService.executeStep(
        session.session_id,
        step.step_id,
        'manual',
        userInput
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.execution_result).toBe(userInput);

      // 验证步骤状态更新
      const updatedSession = sessionService.getSession(session.session_id);
      const updatedStep = updatedSession.steps.find(s => s.step_id === step.step_id);
      expect(updatedStep.execution_status).toBe('completed');
      expect(updatedStep.execution_result).toBe(userInput);
    });

    test('应该执行自动步骤', async () => {
      const step = session.steps[1]; // 自动步骤
      
      mockToolService.executeCommand.mockResolvedValue({
        success: true,
        output: '服务重启成功',
        exit_code: 0
      });

      const result = await sessionService.executeStep(
        session.session_id,
        step.step_id,
        'auto'
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockToolService.executeCommand).toHaveBeenCalledWith(
        step.tool_api,
        expect.any(Object)
      );
    });

    test('应该处理不存在的会话', async () => {
      await expect(sessionService.executeStep(
        'nonexistent-session',
        'step-id',
        'manual',
        'input'
      )).rejects.toThrow('会话不存在');
    });

    test('应该处理不存在的步骤', async () => {
      await expect(sessionService.executeStep(
        session.session_id,
        'nonexistent-step',
        'manual',
        'input'
      )).rejects.toThrow('步骤不存在');
    });

    test('应该验证手动步骤的用户输入', async () => {
      const step = session.steps[0]; // 手动步骤

      await expect(sessionService.executeStep(
        session.session_id,
        step.step_id,
        'manual'
      )).rejects.toThrow('手动步骤需要用户输入');
    });
  });

  describe('反馈处理', () => {
    let session;

    beforeEach(async () => {
      const result = await sessionService.createSession(
        'network',
        '网络连接问题',
        'user123'
      );
      session = result.session;

      // 执行第一个步骤
      await sessionService.executeStep(
        session.session_id,
        session.steps[0].step_id,
        'manual',
        '检查完成'
      );
    });

    test('应该处理用户反馈', async () => {
      const step = session.steps[0];
      const feedback = '步骤执行遇到问题，需要额外帮助';

      mockLLMService.evaluateResult.mockResolvedValue({
        success: false,
        analysis: '需要额外步骤',
        next_action: 'add_step',
        additional_steps: [
          {
            step_order: 1.5,
            step_content: '执行额外的诊断步骤',
            step_type: 'manual'
          }
        ]
      });

      const result = await sessionService.processFeedback(
        session.session_id,
        step.step_id,
        feedback
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockLLMService.evaluateResult).toHaveBeenCalledWith(
        step.step_content,
        step.execution_result,
        feedback
      );

      // 验证反馈记录
      const updatedSession = sessionService.getSession(session.session_id);
      const updatedStep = updatedSession.steps.find(s => s.step_id === step.step_id);
      expect(updatedStep.user_feedback).toBe(feedback);
    });

    test('应该根据反馈添加新步骤', async () => {
      const step = session.steps[0];
      const feedback = '需要额外的诊断步骤';

      mockLLMService.evaluateResult.mockResolvedValue({
        success: false,
        analysis: '需要额外步骤',
        next_action: 'add_step',
        additional_steps: [
          {
            step_order: 1.5,
            step_content: '执行网络诊断',
            step_type: 'auto',
            tool_api: 'network_diagnostic'
          }
        ]
      });

      await sessionService.processFeedback(
        session.session_id,
        step.step_id,
        feedback
      );

      const updatedSession = sessionService.getSession(session.session_id);
      expect(updatedSession.steps.length).toBe(session.steps.length + 1);
      
      const newStep = updatedSession.steps.find(s => s.step_order === 1.5);
      expect(newStep).toBeDefined();
      expect(newStep.step_content).toBe('执行网络诊断');
    });
  });

  describe('会话状态管理', () => {
    let session;

    beforeEach(async () => {
      const result = await sessionService.createSession(
        'network',
        '网络连接问题',
        'user123'
      );
      session = result.session;
    });

    test('应该获取会话状态', () => {
      const status = sessionService.getSessionStatus(session.session_id);

      expect(status).toBeDefined();
      expect(status.session_id).toBe(session.session_id);
      expect(status.current_step_index).toBeDefined();
      expect(status.progress).toBeDefined();
      expect(status.progress.total).toBe(session.steps.length);
      expect(status.progress.completed).toBe(0);
    });

    test('应该更新进度', async () => {
      // 执行第一个步骤
      await sessionService.executeStep(
        session.session_id,
        session.steps[0].step_id,
        'manual',
        '步骤完成'
      );

      const status = sessionService.getSessionStatus(session.session_id);
      expect(status.progress.completed).toBe(1);
      expect(status.progress.percentage).toBe(50); // 2步骤中完成1步
    });

    test('应该完成会话', async () => {
      // 执行所有步骤
      for (const step of session.steps) {
        if (step.step_type === 'manual') {
          await sessionService.executeStep(
            session.session_id,
            step.step_id,
            'manual',
            '步骤完成'
          );
        } else {
          mockToolService.executeCommand.mockResolvedValue({
            success: true,
            output: '自动步骤完成'
          });
          await sessionService.executeStep(
            session.session_id,
            step.step_id,
            'auto'
          );
        }
      }

      const result = await sessionService.completeSession(
        session.session_id,
        '问题已解决'
      );

      expect(result.success).toBe(true);
      
      const updatedSession = sessionService.getSession(session.session_id);
      expect(updatedSession.status).toBe('completed');
      expect(updatedSession.summary).toBe('问题已解决');
    });
  });

  describe('会话搜索和管理', () => {
    beforeEach(async () => {
      // 创建多个测试会话
      await sessionService.createSession('network', '网络问题1', 'user1');
      await sessionService.createSession('performance', '性能问题1', 'user1');
      await sessionService.createSession('network', '网络问题2', 'user2');
    });

    test('应该搜索会话', () => {
      const results = sessionService.searchSessions('网络', {
        userId: 'user1'
      });

      expect(Array.isArray(results.results)).toBe(true);
      expect(results.results.length).toBe(1);
      expect(results.results[0].problem_description).toContain('网络问题1');
    });

    test('应该按分类过滤会话', () => {
      const results = sessionService.searchSessions('', {
        category: 'network'
      });

      expect(results.results.length).toBe(2);
      results.results.forEach(session => {
        expect(session.problem_category).toBe('network');
      });
    });

    test('应该获取用户会话', () => {
      const results = sessionService.getUserSessions('user1', 10, 0);

      expect(results.sessions.length).toBe(2);
      results.sessions.forEach(session => {
        expect(session.user_id).toBe('user1');
      });
    });

    test('应该删除会话', () => {
      const sessions = sessionService.searchSessions('', {}).results;
      const sessionToDelete = sessions[0];

      sessionService.deleteSession(sessionToDelete.session_id);

      const updatedSessions = sessionService.searchSessions('', {}).results;
      expect(updatedSessions.length).toBe(sessions.length - 1);
      
      const deletedSession = updatedSessions.find(
        s => s.session_id === sessionToDelete.session_id
      );
      expect(deletedSession).toBeUndefined();
    });
  });

  describe('统计信息', () => {
    beforeEach(async () => {
      await sessionService.createSession('network', '网络问题', 'user1');
      await sessionService.createSession('performance', '性能问题', 'user2');
    });

    test('应该返回统计信息', () => {
      const stats = sessionService.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.total_sessions).toBe(2);
      expect(stats.active_sessions).toBe(2);
      expect(stats.completed_sessions).toBe(0);
      expect(stats.categories.network).toBe(1);
      expect(stats.categories.performance).toBe(1);
    });
  });
});