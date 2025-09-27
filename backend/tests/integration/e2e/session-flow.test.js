/**
 * 端到端测试 - 完整的会话流程
 */

const request = require('supertest');
const app = require('../../src/app');

describe('End-to-End Session Flow', () => {
  let sessionId;
  let firstStepId;
  let secondStepId;

  describe('完整的问题处置流程', () => {
    test('步骤1: 创建网络问题会话', async () => {
      const sessionData = {
        problem_category: 'network',
        problem_description: '服务器无法连接到外部API，错误信息显示连接超时。影响了用户注册和数据同步功能。'
      };

      const response = await request(app)
        .post('/api/v1/session')
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session).toBeDefined();
      
      const session = response.body.data.session;
      sessionId = session.session_id;
      
      // 验证会话基本信息
      expect(session.problem_category).toBe('network');
      expect(session.status).toBe('processing');
      expect(session.steps.length).toBeGreaterThan(0);
      
      // 记录前两个步骤的ID
      firstStepId = session.steps[0].step_id;
      if (session.steps.length > 1) {
        secondStepId = session.steps[1].step_id;
      }

      console.log(`✓ 创建会话成功: ${sessionId}`);
      console.log(`  - 生成了 ${session.steps.length} 个处置步骤`);
    });

    test('步骤2: 检查会话状态', async () => {
      const response = await request(app)
        .get(`/api/v1/session/${sessionId}/status`)
        .expect(200);

      const status = response.body.data;
      expect(status.session_id).toBe(sessionId);
      expect(status.progress.completed).toBe(0);
      expect(status.progress.total).toBeGreaterThan(0);
      expect(status.progress.percentage).toBe(0);

      console.log(`✓ 会话状态正常: ${status.progress.completed}/${status.progress.total} 完成`);
    });

    test('步骤3: 执行第一个手动步骤', async () => {
      // 获取最新会话信息
      const sessionResponse = await request(app)
        .get(`/api/v1/session/${sessionId}`);
      
      const firstStep = sessionResponse.body.data.steps.find(
        step => step.step_id === firstStepId
      );

      expect(firstStep.execution_status).toBe('pending');

      // 执行步骤
      const executionData = {
        stepId: firstStepId,
        executionType: 'manual',
        userInput: '已检查网络连接状态，ping外部DNS服务器(8.8.8.8)正常，但ping API服务器地址超时。traceroute显示在第5跳处中断。'
      };

      const response = await request(app)
        .post(`/api/v1/session/${sessionId}/step`)
        .send(executionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.execution_result).toBe(executionData.userInput);

      console.log('✓ 第一个步骤执行成功');
    });

    test('步骤4: 验证步骤状态更新', async () => {
      const response = await request(app)
        .get(`/api/v1/session/${sessionId}`)
        .expect(200);

      const session = response.body.data;
      const firstStep = session.steps.find(step => step.step_id === firstStepId);
      
      expect(firstStep.execution_status).toBe('completed');
      expect(firstStep.execution_result).toContain('ping外部DNS服务器');

      // 检查进度更新
      const statusResponse = await request(app)
        .get(`/api/v1/session/${sessionId}/status`);
      
      const status = statusResponse.body.data;
      expect(status.progress.completed).toBe(1);
      expect(status.progress.percentage).toBeGreaterThan(0);

      console.log(`✓ 进度更新: ${status.progress.percentage}% 完成`);
    });

    test('步骤5: 提交反馈以获取额外建议', async () => {
      const feedbackData = {
        stepId: firstStepId,
        feedback: '通过检查发现网络连接在第5跳中断，怀疑是路由配置问题。需要进一步诊断路由表和防火墙设置。'
      };

      const response = await request(app)
        .post(`/api/v1/session/${sessionId}/feedback`)
        .send(feedbackData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // 检查反馈是否记录
      const sessionResponse = await request(app)
        .get(`/api/v1/session/${sessionId}`);
      
      const firstStep = sessionResponse.body.data.steps.find(
        step => step.step_id === firstStepId
      );
      expect(firstStep.user_feedback).toBe(feedbackData.feedback);

      console.log('✓ 用户反馈提交成功');
    });

    test('步骤6: 执行第二个步骤（如果存在）', async () => {
      if (!secondStepId) {
        console.log('⚠ 跳过第二个步骤（不存在）');
        return;
      }

      const executionData = {
        stepId: secondStepId,
        executionType: 'manual',
        userInput: '已检查路由表，发现默认网关配置正确。检查防火墙规则，发现出站规则阻止了目标端口的连接。已临时开放端口进行测试。'
      };

      const response = await request(app)
        .post(`/api/v1/session/${sessionId}/step`)
        .send(executionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      console.log('✓ 第二个步骤执行成功');
    });

    test('步骤7: 模拟更多步骤执行', async () => {
      // 获取当前会话状态
      const sessionResponse = await request(app)
        .get(`/api/v1/session/${sessionId}`);
      
      const session = sessionResponse.body.data;
      const pendingSteps = session.steps.filter(
        step => step.execution_status === 'pending'
      );

      // 执行剩余的手动步骤
      for (const step of pendingSteps.slice(0, 2)) { // 最多执行2个步骤
        if (step.step_type === 'manual') {
          const executionData = {
            stepId: step.step_id,
            executionType: 'manual',
            userInput: `步骤${step.step_order}已完成。${step.step_content.includes('重启') ? '服务重启成功，连接已恢复正常。' : '检查完成，未发现异常。'}`
          };

          await request(app)
            .post(`/api/v1/session/${sessionId}/step`)
            .send(executionData)
            .expect(200);

          console.log(`✓ 步骤${step.step_order}执行完成`);
        }
      }
    });

    test('步骤8: 检查最终进度', async () => {
      const statusResponse = await request(app)
        .get(`/api/v1/session/${sessionId}/status`)
        .expect(200);

      const status = statusResponse.body.data;
      console.log(`✓ 最终进度: ${status.progress.completed}/${status.progress.total} (${status.progress.percentage}%)`);
      
      expect(status.progress.completed).toBeGreaterThan(0);
      expect(status.progress.percentage).toBeGreaterThan(0);
    });

    test('步骤9: 完成会话', async () => {
      const completionData = {
        summary: '网络连接问题已解决。根本原因是防火墙规则阻止了出站连接。已更新防火墙配置，允许必要的端口访问。现在服务器可以正常连接外部API，用户注册和数据同步功能已恢复正常。'
      };

      const response = await request(app)
        .post(`/api/v1/session/${sessionId}/complete`)
        .send(completionData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // 验证会话状态
      const sessionResponse = await request(app)
        .get(`/api/v1/session/${sessionId}`);
      
      const session = sessionResponse.body.data;
      expect(session.status).toBe('completed');
      expect(session.summary).toBe(completionData.summary);

      console.log('✓ 会话已成功完成');
    });

    test('步骤10: 验证会话历史记录', async () => {
      const response = await request(app)
        .get('/api/v1/session')
        .query({ 
          search: '网络',
          status: 'completed'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const completedSessions = response.body.data.results.filter(
        session => session.status === 'completed' && session.session_id === sessionId
      );
      
      expect(completedSessions.length).toBe(1);
      expect(completedSessions[0].problem_category).toBe('network');

      console.log('✓ 会话已正确记录在历史中');
    });
  });

  describe('性能问题处置流程', () => {
    let perfSessionId;

    test('创建性能问题会话', async () => {
      const sessionData = {
        problem_category: 'performance',
        problem_description: 'Web应用响应时间显著增加，页面加载超过10秒。数据库查询日志显示某些查询执行时间异常长。CPU使用率持续在80%以上。'
      };

      const response = await request(app)
        .post('/api/v1/session')
        .send(sessionData)
        .expect(201);

      perfSessionId = response.body.data.session.session_id;
      expect(response.body.data.session.problem_category).toBe('performance');

      console.log(`✓ 性能问题会话创建成功: ${perfSessionId}`);
    });

    test('快速执行性能问题处置步骤', async () => {
      // 获取会话步骤
      const sessionResponse = await request(app)
        .get(`/api/v1/session/${perfSessionId}`);
      
      const session = sessionResponse.body.data;
      
      // 执行前几个步骤
      for (let i = 0; i < Math.min(3, session.steps.length); i++) {
        const step = session.steps[i];
        
        if (step.step_type === 'manual') {
          const userInputs = [
            'CPU使用率检查完成，发现Java进程占用70%，MySQL占用15%。',
            '内存使用率85%，发现内存泄漏迹象。已获取堆转储文件。',
            '数据库慢查询分析完成，发现缺少索引的表查询占用大量时间。'
          ];

          await request(app)
            .post(`/api/v1/session/${perfSessionId}/step`)
            .send({
              stepId: step.step_id,
              executionType: 'manual',
              userInput: userInputs[i] || `步骤${step.step_order}执行完成`
            })
            .expect(200);
        }
      }

      console.log('✓ 性能问题处置步骤执行完成');
    });

    test('完成性能问题会话', async () => {
      await request(app)
        .post(`/api/v1/session/${perfSessionId}/complete`)
        .send({
          summary: '性能问题已解决。通过添加数据库索引和优化JVM参数，应用响应时间恢复正常，CPU使用率降至35%。'
        })
        .expect(200);

      console.log('✓ 性能问题会话完成');
    });
  });

  describe('并发会话处理', () => {
    test('应该支持多个并发会话', async () => {
      const sessionRequests = [
        {
          problem_category: 'security',
          problem_description: '发现可疑的登录尝试，来自多个异常IP地址。'
        },
        {
          problem_category: 'service',
          problem_description: '微服务A无响应，健康检查失败。'
        },
        {
          problem_category: 'storage',
          problem_description: '磁盘空间使用率达到95%，需要紧急清理。'
        }
      ];

      // 并发创建会话
      const promises = sessionRequests.map(data =>
        request(app)
          .post('/api/v1/session')
          .send(data)
      );

      const responses = await Promise.all(promises);
      
      // 验证所有会话都创建成功
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      const sessionIds = responses.map(res => res.body.data.session.session_id);
      
      // 验证所有会话都可以独立访问
      const statusPromises = sessionIds.map(id =>
        request(app).get(`/api/v1/session/${id}/status`)
      );

      const statusResponses = await Promise.all(statusPromises);
      statusResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      console.log(`✓ 成功处理 ${sessionIds.length} 个并发会话`);
    });
  });

  describe('系统状态和健康检查', () => {
    test('健康检查应该正常', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.services).toBeDefined();
      
      // 验证所有核心服务都已初始化
      const services = response.body.services;
      expect(services.llm).toBe(true);
      expect(services.knowledge).toBe(true);
      expect(services.tools).toBe(true);
      expect(services.sessions).toBe(true);

      console.log('✓ 系统健康检查通过');
    });

    test('系统状态应该正常', async () => {
      const response = await request(app)
        .get('/status')
        .expect(200);

      expect(response.body.services).toBeDefined();
      expect(response.body.services.llm).toBeDefined();
      expect(response.body.services.knowledge).toBeDefined();
      expect(response.body.services.tools).toBeDefined();
      expect(response.body.services.sessions).toBeDefined();

      console.log('✓ 系统状态检查正常');
    });
  });

  afterAll(async () => {
    console.log('\n📊 端到端测试完成');
    console.log('✅ 所有测试场景已验证');
    console.log('🚀 智能运维助手系统功能正常');
  });
});