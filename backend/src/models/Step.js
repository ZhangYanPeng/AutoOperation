/**
 * 处置步骤模型
 * 管理单个处置步骤的执行状态和结果
 */

import { v4 as uuidv4 } from 'uuid';

export class Step {
  constructor({
    step_id = null,
    session_id,
    step_order,
    step_type = 'manual',
    step_content,
    tool_api = null,
    execution_status = 'pending',
    execution_result = null,
    user_feedback = null,
    dependencies = [],
    timeout = 30000,
    retry_count = 0,
    max_retries = 3
  }) {
    this.step_id = step_id || uuidv4();
    this.session_id = session_id;
    this.step_order = step_order;
    this.step_type = step_type; // auto, manual, branch, conditional
    this.step_content = step_content;
    this.tool_api = tool_api;
    this.execution_status = execution_status; // pending, executing, completed, failed, skipped
    this.execution_result = execution_result;
    this.user_feedback = user_feedback;
    this.dependencies = dependencies; // 依赖的步骤ID列表
    this.timeout = timeout;
    this.retry_count = retry_count;
    this.max_retries = max_retries;
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
    this.started_at = null;
    this.completed_at = null;
  }

  /**
   * 验证步骤数据
   */
  validate() {
    const errors = [];

    if (!this.session_id) {
      errors.push('会话ID不能为空');
    }

    if (this.step_order === undefined || this.step_order === null) {
      errors.push('步骤序号不能为空');
    }

    if (!this.step_content || this.step_content.trim() === '') {
      errors.push('步骤内容不能为空');
    }

    const validTypes = ['auto', 'manual', 'branch', 'conditional'];
    if (!validTypes.includes(this.step_type)) {
      errors.push(`步骤类型必须是以下之一: ${validTypes.join(', ')}`);
    }

    const validStatuses = ['pending', 'executing', 'completed', 'failed', 'skipped'];
    if (!validStatuses.includes(this.execution_status)) {
      errors.push(`执行状态必须是以下之一: ${validStatuses.join(', ')}`);
    }

    // 自动步骤必须有工具API
    if (this.step_type === 'auto' && !this.tool_api) {
      errors.push('自动执行步骤必须指定工具API');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 更新执行状态
   */
  updateStatus(newStatus, result = null) {
    const validStatuses = ['pending', 'executing', 'completed', 'failed', 'skipped'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`无效的执行状态: ${newStatus}`);
    }

    const previousStatus = this.execution_status;
    this.execution_status = newStatus;
    this.updated_at = new Date().toISOString();

    // 设置时间戳
    if (newStatus === 'executing' && previousStatus === 'pending') {
      this.started_at = new Date().toISOString();
    } else if (['completed', 'failed', 'skipped'].includes(newStatus)) {
      this.completed_at = new Date().toISOString();
    }

    // 设置执行结果
    if (result !== null) {
      this.execution_result = result;
    }
  }

  /**
   * 添加用户反馈
   */
  addUserFeedback(feedback) {
    this.user_feedback = feedback;
    this.updated_at = new Date().toISOString();
  }

  /**
   * 检查是否可以执行
   */
  canExecute(completedSteps = []) {
    // 检查依赖步骤是否都已完成
    if (this.dependencies.length > 0) {
      const completedStepIds = completedSteps.map(step => step.step_id);
      const allDependenciesMet = this.dependencies.every(depId => 
        completedStepIds.includes(depId)
      );
      
      if (!allDependenciesMet) {
        return { canExecute: false, reason: '依赖步骤未完成' };
      }
    }

    // 检查状态
    if (this.execution_status !== 'pending') {
      return { canExecute: false, reason: `步骤状态为 ${this.execution_status}` };
    }

    return { canExecute: true };
  }

  /**
   * 检查是否需要重试
   */
  shouldRetry() {
    return this.execution_status === 'failed' && 
           this.retry_count < this.max_retries;
  }

  /**
   * 增加重试次数
   */
  incrementRetry() {
    this.retry_count++;
    this.updated_at = new Date().toISOString();
  }

  /**
   * 获取执行耗时（毫秒）
   */
  getExecutionDuration() {
    if (!this.started_at || !this.completed_at) {
      return null;
    }
    return new Date(this.completed_at) - new Date(this.started_at);
  }

  /**
   * 转换为JSON对象
   */
  toJSON() {
    return {
      step_id: this.step_id,
      session_id: this.session_id,
      step_order: this.step_order,
      step_type: this.step_type,
      step_content: this.step_content,
      tool_api: this.tool_api,
      execution_status: this.execution_status,
      execution_result: this.execution_result,
      user_feedback: this.user_feedback,
      dependencies: this.dependencies,
      timeout: this.timeout,
      retry_count: this.retry_count,
      max_retries: this.max_retries,
      created_at: this.created_at,
      updated_at: this.updated_at,
      started_at: this.started_at,
      completed_at: this.completed_at,
      duration: this.getExecutionDuration()
    };
  }

  /**
   * 从JSON对象创建步骤实例
   */
  static fromJSON(json) {
    const step = new Step(json);
    step.started_at = json.started_at;
    step.completed_at = json.completed_at;
    return step;
  }
}

export default Step;