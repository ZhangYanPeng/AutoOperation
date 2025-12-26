/**
 * LLM服务单元测试
 */

const { LLMService } = require('../src/services/LLMService');
const config = require('../src/config/index');

describe('LLMService', () => {
  let llmService;

  beforeEach(() => {
    llmService = new LLMService(config.llm);
  });

  describe('初始化', () => {
    test('应该成功初始化 LLM 服务', async () => {
      await expect(llmService.initialize()).resolves.not.toThrow();
      expect(llmService.initialized).toBe(true);
    });

    test('应该处理初始化错误', async () => {
      const invalidConfig = { ...config.llm, provider: 'invalid' };
      const invalidService = new LLMService(invalidConfig);
      
      await expect(invalidService.initialize()).rejects.toThrow();
    });
  });

  describe('聊天功能', () => {
    beforeEach(async () => {
      await llmService.initialize();
    });

    test('应该成功发送聊天消息', async () => {
      const messages = [
        { role: 'user', content: '你好' }
      ];

      const response = await llmService.chat(messages);
      
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });

    test('应该处理空消息', async () => {
      await expect(llmService.chat([])).rejects.toThrow('消息不能为空');
    });

    test('应该处理无效消息格式', async () => {
      const invalidMessages = [
        { role: 'invalid', content: '测试' }
      ];

      await expect(llmService.chat(invalidMessages)).rejects.toThrow();
    });
  });

  describe('问题分析', () => {
    beforeEach(async () => {
      await llmService.initialize();
    });

    test('应该分析网络问题', async () => {
      const problem = '网络连接超时，无法访问外部服务';
      
      const analysis = await llmService.analyzeProblem(problem, 'network');
      
      expect(analysis).toBeDefined();
      expect(analysis.category).toBe('network');
      expect(analysis.severity).toMatch(/^(low|medium|high|critical)$/);
      expect(analysis.description).toBeDefined();
      expect(Array.isArray(analysis.potential_causes)).toBe(true);
    });

    test('应该分析性能问题', async () => {
      const problem = 'CPU使用率达到90%，系统响应缓慢';
      
      const analysis = await llmService.analyzeProblem(problem, 'performance');
      
      expect(analysis).toBeDefined();
      expect(analysis.category).toBe('performance');
      expect(analysis.severity).toMatch(/^(low|medium|high|critical)$/);
    });
  });

  describe('步骤生成', () => {
    beforeEach(async () => {
      await llmService.initialize();
    });

    test('应该生成处置步骤', async () => {
      const analysis = {
        category: 'network',
        severity: 'high',
        description: '网络连接问题',
        potential_causes: ['DNS解析失败', '防火墙阻断']
      };

      const steps = await llmService.generateSteps(analysis);
      
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
      
      steps.forEach(step => {
        expect(step).toHaveProperty('step_order');
        expect(step).toHaveProperty('step_content');
        expect(step).toHaveProperty('step_type');
        expect(['auto', 'manual']).toContain(step.step_type);
      });
    });

    test('应该根据严重程度调整步骤数量', async () => {
      const criticalAnalysis = {
        category: 'service',
        severity: 'critical',
        description: '关键服务宕机'
      };

      const lowAnalysis = {
        category: 'performance',
        severity: 'low',
        description: '轻微性能问题'
      };

      const criticalSteps = await llmService.generateSteps(criticalAnalysis);
      const lowSteps = await llmService.generateSteps(lowAnalysis);
      
      expect(criticalSteps.length).toBeGreaterThanOrEqual(lowSteps.length);
    });
  });

  describe('结果评估', () => {
    beforeEach(async () => {
      await llmService.initialize();
    });

    test('应该评估步骤执行结果', async () => {
      const stepContent = '检查网络连接状态';
      const executionResult = 'ping 测试成功，网络连接正常';
      
      const evaluation = await llmService.evaluateResult(stepContent, executionResult);
      
      expect(evaluation).toBeDefined();
      expect(evaluation.success).toBeDefined();
      expect(typeof evaluation.success).toBe('boolean');
      expect(evaluation.analysis).toBeDefined();
      expect(evaluation.next_action).toBeDefined();
    });

    test('应该处理失败的执行结果', async () => {
      const stepContent = '重启服务';
      const executionResult = '错误: 权限不足，无法重启服务';
      
      const evaluation = await llmService.evaluateResult(stepContent, executionResult);
      
      expect(evaluation.success).toBe(false);
      expect(evaluation.next_action).toMatch(/retry|escalate|alternative/);
    });
  });

  describe('配置管理', () => {
    test('应该返回正确的配置', () => {
      const serviceConfig = llmService.getConfig();
      
      expect(serviceConfig).toBeDefined();
      expect(serviceConfig).toHaveProperty('provider');
      expect(serviceConfig).toHaveProperty('models');
    });

    test('应该更新配置', () => {
      const newConfig = {
        ...config.llm,
        maxTokens: 2000
      };

      llmService.updateConfig(newConfig);
      
      const updatedConfig = llmService.getConfig();
      expect(updatedConfig.maxTokens).toBe(2000);
    });
  });

  describe('状态管理', () => {
    test('应该返回服务状态', () => {
      const status = llmService.getStatus();
      
      expect(status).toBeDefined();
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('provider');
      expect(status).toHaveProperty('models');
    });

    test('应该跟踪请求统计', async () => {
      await llmService.initialize();
      
      const initialStats = llmService.getStatus().stats;
      
      await llmService.chat([{ role: 'user', content: '测试' }]);
      
      const updatedStats = llmService.getStatus().stats;
      expect(updatedStats.totalRequests).toBe(initialStats.totalRequests + 1);
    });
  });
});