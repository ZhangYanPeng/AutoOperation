/**
 * 核心处置引擎
 * 负责问题解析、方案规划、执行协调和监控评估
 */

import { Session } from '../models/Session.js';
import { Step } from '../models/Step.js';
import { llmService } from './LLMService.js';
import { knowledgeBaseService } from './KnowledgeBaseService.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class ProcessingEngine {
  constructor() {
    this.initialized = false;
  }

  /**
   * 初始化处置引擎
   */
  async initialize() {
    try {
      // 确保依赖服务已初始化
      if (!llmService.initialized) {
        await llmService.initialize();
      }
      if (!knowledgeBaseService.initialized) {
        await knowledgeBaseService.initialize();
      }

      this.initialized = true;
      logger.info('核心处置引擎初始化成功');
    } catch (error) {
      logger.error('核心处置引擎初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检查初始化状态
   */
  checkInitialized() {
    if (!this.initialized) {
      throw new Error('核心处置引擎未初始化，请先调用 initialize()');
    }
  }

  /**
   * 创建新的处置会话
   */
  async createSession(problemCategory, problemDescription, userId = null) {
    this.checkInitialized();

    try {
      logger.info('开始创建处置会话', {
        category: problemCategory,
        description: problemDescription.substring(0, 100) + '...',
        userId
      });

      // 创建会话对象
      const session = new Session({
        problem_category: problemCategory,
        problem_description: problemDescription,
        user_id: userId,
        status: 'processing'
      });

      // 验证会话数据
      const validation = session.validate();
      if (!validation.isValid) {
        throw new Error(`会话验证失败: ${validation.errors.join(', ')}`);
      }

      // 分析问题并生成初始处置方案
      const processingPlan = await this.analyzeProblemAndCreatePlan(session);

      logger.info('处置会话创建成功', {
        sessionId: session.session_id,
        stepsCount: session.steps.length
      });

      return {
        session: session.toJSON(),
        initialPlan: processingPlan
      };
    } catch (error) {
      logger.error('创建处置会话失败:', error);
      throw error;
    }
  }

  /**
   * 分析问题并创建处置计划
   */
  async analyzeProblemAndCreatePlan(session) {
    try {
      // 1. 使用大模型分析问题
      const analysisResult = await llmService.analyzeProblem(
        session.problem_category,
        session.problem_description
      );

      // 2. 搜索相关知识库
      const knowledgeResults = await knowledgeBaseService.search(
        `${session.problem_category} ${session.problem_description}`,
        {
          type: 'operation-procedure',
          limit: 5
        }
      );

      // 3. 获取推荐知识条目
      const recommendations = knowledgeBaseService.getRecommendations(
        session.problem_category,
        3
      );

      // 4. 基于分析结果和知识库生成处置步骤
      const steps = await this.generateProcessingSteps(
        session,
        analysisResult,
        knowledgeResults,
        recommendations
      );

      // 5. 将步骤添加到会话中
      steps.forEach(step => session.addStep(step));

      return {
        analysis: analysisResult,
        knowledgeMatches: knowledgeResults,
        recommendations,
        stepsGenerated: steps.length,
        firstStep: steps[0]?.toJSON() || null
      };
    } catch (error) {
      logger.error('分析问题并创建处置计划失败:', error);
      throw error;
    }
  }

  /**
   * 生成处置步骤
   */
  async generateProcessingSteps(session, analysisResult, knowledgeResults, recommendations) {
    try {
      // 构建上下文信息
      const context = {
        problemCategory: session.problem_category,
        problemDescription: session.problem_description,
        analysis: analysisResult.analysis,
        knowledgeBase: knowledgeResults.results.map(r => ({
          title: r.title,
          summary: r.summary,
          type: r.type
        })),
        recommendations: recommendations.map(r => ({
          title: r.title,
          category: r.category
        }))
      };

      // 使用大模型生成详细的处置步骤
      const stepsResult = await llmService.generateSteps(
        '问题分析完成，需要生成具体的处置步骤',
        [],
        '',
        context
      );

      // 解析生成的步骤文本为结构化步骤
      const parsedSteps = this.parseStepsFromText(stepsResult.steps, session.session_id);

      // 查找可自动执行的步骤（匹配设备API）
      await this.identifyAutomatableSteps(parsedSteps);

      logger.info('处置步骤生成完成', {
        sessionId: session.session_id,
        totalSteps: parsedSteps.length,
        autoSteps: parsedSteps.filter(s => s.step_type === 'auto').length
      });

      return parsedSteps;
    } catch (error) {
      logger.error('生成处置步骤失败:', error);
      throw error;
    }
  }

  /**
   * 从文本解析步骤
   */
  parseStepsFromText(stepsText, sessionId) {
    const steps = [];
    const lines = stepsText.split('\n').filter(line => line.trim());
    
    let currentOrder = 1;
    let currentStep = null;
    let stepContent = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 检测步骤开始标记（数字开头或特定格式）
      const stepMatch = trimmedLine.match(/^(\d+)[\.\)]\s*(.+)$/) || 
                      trimmedLine.match(/^步骤\s*(\d+)[\:\：]\s*(.+)$/) ||
                      trimmedLine.match(/^第\s*(\d+)\s*步[\:\：]\s*(.+)$/);

      if (stepMatch) {
        // 保存上一个步骤
        if (currentStep && stepContent.trim()) {
          currentStep.step_content = stepContent.trim();
          steps.push(currentStep);
        }

        // 开始新步骤
        const stepNumber = parseInt(stepMatch[1]);
        const stepTitle = stepMatch[2].trim();
        
        currentStep = new Step({
          session_id: sessionId,
          step_order: currentOrder++,
          step_type: 'manual', // 默认为手动，后续会识别自动步骤
          step_content: stepTitle
        });
        
        stepContent = stepTitle;
      } else if (currentStep && trimmedLine) {
        // 添加到当前步骤内容
        stepContent += '\n' + trimmedLine;
      } else if (!currentStep && trimmedLine) {
        // 如果还没有步骤，可能是描述性文本，创建一个通用步骤
        currentStep = new Step({
          session_id: sessionId,
          step_order: currentOrder++,
          step_type: 'manual',
          step_content: ''
        });
        stepContent = trimmedLine;
      }
    }

    // 保存最后一个步骤
    if (currentStep && stepContent.trim()) {
      currentStep.step_content = stepContent.trim();
      steps.push(currentStep);
    }

    // 如果没有解析到步骤，创建一个默认步骤
    if (steps.length === 0) {
      steps.push(new Step({
        session_id: sessionId,
        step_order: 1,
        step_type: 'manual',
        step_content: stepsText.trim() || '请根据问题分析结果进行相应处置'
      }));
    }

    return steps;
  }

  /**
   * 识别可自动执行的步骤
   */
  async identifyAutomatableSteps(steps) {
    for (const step of steps) {
      try {
        // 在设备API知识库中搜索匹配的API
        const apiResults = await knowledgeBaseService.search(
          step.step_content,
          {
            type: 'device-api',
            limit: 3,
            minScore: 0.3
          }
        );

        if (apiResults.results.length > 0) {
          const bestMatch = apiResults.results[0];
          
          // 如果找到匹配度较高的API，标记为自动步骤
          if (bestMatch.relevance > 0.5) {
            step.step_type = 'auto';
            step.tool_api = bestMatch.knowledge_id;
            
            logger.info('识别到可自动执行步骤', {
              stepId: step.step_id,
              apiMatch: bestMatch.title,
              relevance: bestMatch.relevance
            });
          }
        }
      } catch (error) {
        logger.warn('识别自动步骤失败', {
          stepId: step.step_id,
          error: error.message
        });
      }
    }
  }

  /**
   * 执行处置步骤
   */
  async executeStep(session, stepId, executionType = 'auto', userInput = null) {
    this.checkInitialized();

    try {
      const step = session.steps.find(s => s.step_id === stepId);
      if (!step) {
        throw new Error(`步骤不存在: ${stepId}`);
      }

      // 检查步骤是否可以执行
      const canExecute = step.canExecute(session.steps.filter(s => s.execution_status === 'completed'));
      if (!canExecute.canExecute) {
        throw new Error(`步骤无法执行: ${canExecute.reason}`);
      }

      logger.info('开始执行处置步骤', {
        sessionId: session.session_id,
        stepId,
        stepType: step.step_type,
        executionType
      });

      // 更新步骤状态为执行中
      step.updateStatus('executing');

      let executionResult;

      if (executionType === 'auto' && step.step_type === 'auto' && step.tool_api) {
        // 自动执行
        executionResult = await this.executeAutomaticStep(step);
      } else if (executionType === 'manual') {
        // 手动执行，等待用户反馈
        executionResult = await this.executeManualStep(step, userInput);
      } else {
        throw new Error('不支持的执行类型或步骤类型不匹配');
      }

      // 更新步骤状态和结果
      step.updateStatus('completed', executionResult);

      // 评估执行结果
      const evaluation = await this.evaluateStepResult(step);

      // 更新会话状态
      session.updated_at = new Date().toISOString();

      logger.info('处置步骤执行完成', {
        sessionId: session.session_id,
        stepId,
        success: executionResult.success,
        duration: step.getExecutionDuration()
      });

      return {
        step: step.toJSON(),
        executionResult,
        evaluation,
        nextStep: this.getNextStep(session)
      };
    } catch (error) {
      // 更新步骤状态为失败
      const step = session.steps.find(s => s.step_id === stepId);
      if (step) {
        step.updateStatus('failed', { error: error.message });
      }

      logger.error('处置步骤执行失败:', error);
      throw error;
    }
  }

  /**
   * 执行自动步骤
   */
  async executeAutomaticStep(step) {
    try {
      // 获取工具API信息
      const apiInfo = knowledgeBaseService.getKnowledgeEntry(step.tool_api);
      if (!apiInfo) {
        throw new Error(`API信息不存在: ${step.tool_api}`);
      }

      // 这里应该调用工具执行服务
      // 由于工具服务还未实现，先返回模拟结果
      const mockResult = {
        success: true,
        message: '自动执行完成',
        data: {
          api: apiInfo.title,
          executedAt: new Date().toISOString(),
          mockExecution: true
        }
      };

      logger.info('自动步骤执行成功', {
        stepId: step.step_id,
        api: apiInfo.title
      });

      return mockResult;
    } catch (error) {
      logger.error('自动步骤执行失败:', error);
      throw error;
    }
  }

  /**
   * 执行手动步骤
   */
  async executeManualStep(step, userInput) {
    try {
      if (!userInput) {
        throw new Error('手动步骤需要用户输入');
      }

      // 添加用户反馈
      step.addUserFeedback(userInput);

      const result = {
        success: true,
        message: '手动执行完成',
        userFeedback: userInput,
        executedAt: new Date().toISOString()
      };

      logger.info('手动步骤执行成功', {
        stepId: step.step_id,
        hasFeedback: !!userInput
      });

      return result;
    } catch (error) {
      logger.error('手动步骤执行失败:', error);
      throw error;
    }
  }

  /**
   * 评估步骤执行结果
   */
  async evaluateStepResult(step) {
    try {
      const evaluation = await llmService.evaluateResult(
        step.step_content,
        step.execution_result
      );

      logger.info('步骤结果评估完成', {
        stepId: step.step_id,
        evaluationLength: evaluation.evaluation.length
      });

      return evaluation;
    } catch (error) {
      logger.warn('步骤结果评估失败:', error);
      return {
        evaluation: '评估失败',
        error: error.message
      };
    }
  }

  /**
   * 获取下一个待执行步骤
   */
  getNextStep(session) {
    const pendingSteps = session.steps.filter(step => step.execution_status === 'pending');
    
    if (pendingSteps.length === 0) {
      return null;
    }

    // 按步骤顺序排序，返回第一个可执行的步骤
    pendingSteps.sort((a, b) => a.step_order - b.step_order);
    
    for (const step of pendingSteps) {
      const canExecute = step.canExecute(session.steps.filter(s => s.execution_status === 'completed'));
      if (canExecute.canExecute) {
        return step.toJSON();
      }
    }

    return null;
  }

  /**
   * 处理用户反馈并更新处置方案
   */
  async processFeedback(session, stepId, feedback, adjustPlan = true) {
    this.checkInitialized();

    try {
      const step = session.steps.find(s => s.step_id === stepId);
      if (!step) {
        throw new Error(`步骤不存在: ${stepId}`);
      }

      // 添加用户反馈
      step.addUserFeedback(feedback);

      logger.info('接收用户反馈', {
        sessionId: session.session_id,
        stepId,
        feedbackLength: feedback.length
      });

      let planUpdate = null;

      if (adjustPlan) {
        // 基于反馈调整处置方案
        planUpdate = await this.adjustProcessingPlan(session, step, feedback);
      }

      // 更新会话时间戳
      session.updated_at = new Date().toISOString();

      return {
        step: step.toJSON(),
        planUpdate,
        nextStep: this.getNextStep(session)
      };
    } catch (error) {
      logger.error('处理用户反馈失败:', error);
      throw error;
    }
  }

  /**
   * 调整处置方案
   */
  async adjustProcessingPlan(session, currentStep, feedback) {
    try {
      const completedSteps = session.steps.filter(s => s.execution_status === 'completed');
      
      // 使用大模型基于反馈生成新的步骤
      const adjustmentResult = await llmService.generateSteps(
        `用户反馈: ${feedback}`,
        completedSteps.map(s => s.toJSON()),
        feedback,
        {
          currentStep: currentStep.toJSON(),
          problemCategory: session.problem_category,
          problemDescription: session.problem_description
        }
      );

      // 解析新步骤
      const newSteps = this.parseStepsFromText(adjustmentResult.steps, session.session_id);
      
      // 调整步骤序号
      const maxOrder = Math.max(...session.steps.map(s => s.step_order));
      newSteps.forEach((step, index) => {
        step.step_order = maxOrder + index + 1;
      });

      // 识别自动步骤
      await this.identifyAutomatableSteps(newSteps);

      // 添加新步骤到会话
      newSteps.forEach(step => session.addStep(step));

      logger.info('处置方案调整完成', {
        sessionId: session.session_id,
        newStepsCount: newSteps.length
      });

      return {
        adjustmentReason: feedback,
        newSteps: newSteps.map(s => s.toJSON()),
        totalSteps: session.steps.length
      };
    } catch (error) {
      logger.error('调整处置方案失败:', error);
      throw error;
    }
  }

  /**
   * 获取会话状态
   */
  getSessionStatus(session) {
    const totalSteps = session.steps.length;
    const completedSteps = session.steps.filter(s => s.execution_status === 'completed').length;
    const failedSteps = session.steps.filter(s => s.execution_status === 'failed').length;
    const currentStep = session.getCurrentStep();

    let overallStatus = session.status;
    if (totalSteps > 0 && completedSteps === totalSteps) {
      overallStatus = 'completed';
    } else if (failedSteps > 0 && !currentStep) {
      overallStatus = 'failed';
    }

    return {
      sessionId: session.session_id,
      overallStatus,
      progress: {
        total: totalSteps,
        completed: completedSteps,
        failed: failedSteps,
        percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
      },
      currentStep: currentStep?.toJSON() || null,
      nextStep: this.getNextStep(session),
      updatedAt: session.updated_at
    };
  }

  /**
   * 完成会话
   */
  async completeSession(session, summary = '') {
    try {
      session.updateStatus('completed');
      session.metadata.completionSummary = summary;
      session.metadata.completedAt = new Date().toISOString();

      logger.info('会话处置完成', {
        sessionId: session.session_id,
        totalSteps: session.steps.length,
        completedSteps: session.getCompletedStepsCount()
      });

      return session.toJSON();
    } catch (error) {
      logger.error('完成会话失败:', error);
      throw error;
    }
  }
}

// 创建全局单例实例
export const processingEngine = new ProcessingEngine();

export default processingEngine;