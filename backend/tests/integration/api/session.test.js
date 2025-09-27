/**
 * API集成测试 - 会话管理
 */

const request = require('supertest');
const app = require('../../src/app');

describe('Session API Integration Tests', () => {
  let sessionId;

  describe('POST /api/v1/session', () => {
    test('应该成功创建新会话', async () => {
      const sessionData = {
        problem_category: 'network',
        problem_description: '网络连接超时，无法访问外部服务器'
      };

      const response = await request(app)
        .post('/api/v1/session')
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.session).toBeDefined();
      expect(response.body.data.session.session_id).toBeDefined();
      expect(response.body.data.session.problem_category).toBe(sessionData.problem_category);
      expect(response.body.data.session.problem_description).toBe(sessionData.problem_description);
      expect(response.body.data.session.status).toBe('processing');
      expect(Array.isArray(response.body.data.session.steps)).toBe(true);

      sessionId = response.body.data.session.session_id;
    });

    test('应该验证必需字段', async () => {
      const response = await request(app)
        .post('/api/v1/session')
        .send({
          problem_category: 'network'
          // 缺少 problem_description
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('problem_description');
    });

    test('应该验证问题分类', async () => {
      const response = await request(app)
        .post('/api/v1/session')
        .send({
          problem_category: 'invalid_category',
          problem_description: '测试问题描述'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('problem_category');
    });

    test('应该验证问题描述长度', async () => {
      const response = await request(app)
        .post('/api/v1/session')
        .send({
          problem_category: 'network',
          problem_description: '短' // 太短的描述
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('长度');
    });

    test('应该应用请求限制', async () => {
      const sessionData = {
        problem_category: 'network',
        problem_description: '网络连接问题测试'
      };

      // 快速发送多个请求以触发限制
      const promises = Array(12).fill().map(() =>
        request(app)
          .post('/api/v1/session')
          .send(sessionData)
      );

      const responses = await Promise.all(promises);
      
      // 检查是否有请求被限制
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/session/:id', () => {
    test('应该获取会话详情', async () => {
      const response = await request(app)
        .get(`/api/v1/session/${sessionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.session_id).toBe(sessionId);
      expect(response.body.data.problem_category).toBe('network');
    });

    test('应该处理不存在的会话', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .get(`/api/v1/session/${nonExistentId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('未找到');
    });

    test('应该验证会话ID格式', async () => {
      const response = await request(app)
        .get('/api/v1/session/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('格式');
    });
  });

  describe('GET /api/v1/session/:id/status', () => {
    test('应该获取会话状态', async () => {
      const response = await request(app)
        .get(`/api/v1/session/${sessionId}/status`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.session_id).toBe(sessionId);
      expect(response.body.data.progress).toBeDefined();
      expect(response.body.data.progress.total).toBeGreaterThan(0);
      expect(response.body.data.progress.completed).toBeGreaterThanOrEqual(0);
      expect(response.body.data.progress.percentage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/v1/session/:id/step', () => {
    let stepId;

    beforeAll(async () => {
      // 获取会话中的第一个步骤
      const sessionResponse = await request(app)
        .get(`/api/v1/session/${sessionId}`);
      
      stepId = sessionResponse.body.data.steps[0].step_id;
    });

    test('应该执行手动步骤', async () => {
      const stepData = {
        stepId: stepId,
        executionType: 'manual',
        userInput: '已检查网络连接，发现DNS解析异常'
      };

      const response = await request(app)
        .post(`/api/v1/session/${sessionId}/step`)
        .send(stepData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.execution_result).toBe(stepData.userInput);
    });

    test('应该验证步骤执行参数', async () => {
      const response = await request(app)
        .post(`/api/v1/session/${sessionId}/step`)
        .send({
          stepId: stepId,
          executionType: 'manual'
          // 缺少 userInput
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('userInput');
    });

    test('应该处理不存在的步骤', async () => {
      const response = await request(app)
        .post(`/api/v1/session/${sessionId}/step`)
        .send({
          stepId: 'nonexistent-step-id',
          executionType: 'manual',
          userInput: '测试输入'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/session/:id/feedback', () => {
    let stepId;

    beforeAll(async () => {
      // 获取已执行的步骤
      const sessionResponse = await request(app)
        .get(`/api/v1/session/${sessionId}`);
      
      stepId = sessionResponse.body.data.steps[0].step_id;
    });

    test('应该提交用户反馈', async () => {
      const feedbackData = {
        stepId: stepId,
        feedback: '这个步骤执行后问题仍然存在，需要进一步诊断'
      };

      const response = await request(app)
        .post(`/api/v1/session/${sessionId}/feedback`)
        .send(feedbackData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    test('应该验证反馈参数', async () => {
      const response = await request(app)
        .post(`/api/v1/session/${sessionId}/feedback`)
        .send({
          stepId: stepId
          // 缺少 feedback
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('feedback');
    });

    test('应该验证反馈长度', async () => {
      const response = await request(app)
        .post(`/api/v1/session/${sessionId}/feedback`)
        .send({
          stepId: stepId,
          feedback: 'x'.repeat(3000) // 超长反馈
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('长度');
    });
  });

  describe('GET /api/v1/session', () => {
    test('应该获取会话列表', async () => {
      const response = await request(app)
        .get('/api/v1/session')
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.results)).toBe(true);
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    test('应该支持会话搜索', async () => {
      const response = await request(app)
        .get('/api/v1/session')
        .query({ 
          search: '网络',
          category: 'network'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.results)).toBe(true);
      
      // 搜索结果应该包含网络相关的会话
      if (response.body.data.results.length > 0) {
        const networkSession = response.body.data.results.find(
          session => session.problem_category === 'network'
        );
        expect(networkSession).toBeDefined();
      }
    });

    test('应该验证分页参数', async () => {
      const response = await request(app)
        .get('/api/v1/session')
        .query({ limit: -1 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('limit');
    });
  });

  describe('POST /api/v1/session/:id/complete', () => {
    test('应该完成会话', async () => {
      const response = await request(app)
        .post(`/api/v1/session/${sessionId}/complete`)
        .send({
          summary: '网络问题已通过重启DNS服务解决'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // 验证会话状态已更新
      const sessionResponse = await request(app)
        .get(`/api/v1/session/${sessionId}`);
      
      expect(sessionResponse.body.data.status).toBe('completed');
      expect(sessionResponse.body.data.summary).toBe('网络问题已通过重启DNS服务解决');
    });
  });

  describe('DELETE /api/v1/session/:id', () => {
    test('应该删除会话', async () => {
      const response = await request(app)
        .delete(`/api/v1/session/${sessionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('删除成功');

      // 验证会话已删除
      await request(app)
        .get(`/api/v1/session/${sessionId}`)
        .expect(404);
    });
  });

  describe('错误处理', () => {
    test('应该处理内部服务器错误', async () => {
      // 发送一个可能导致内部错误的请求
      const response = await request(app)
        .post('/api/v1/session')
        .send({
          problem_category: 'network',
          problem_description: 'A'.repeat(10000) // 极长的描述可能导致处理错误
        });

      if (response.status === 500) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      }
    });

    test('应该处理无效的JSON', async () => {
      const response = await request(app)
        .post('/api/v1/session')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('应该处理不支持的HTTP方法', async () => {
      await request(app)
        .patch('/api/v1/session')
        .expect(404);
    });
  });
});