/**
 * 会话管理模型
 * 管理问题处置会话的完整生命周期
 */

import { v4 as uuidv4 } from 'uuid';

export class Session {
  constructor({
    session_id = null,
    problem_category,
    problem_description,
    status = 'processing',
    user_id = null,
    metadata = {}
  }) {
    this.session_id = session_id || uuidv4();
    this.problem_category = problem_category;
    this.problem_description = problem_description;
    this.status = status; // processing, completed, aborted
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
    this.user_id = user_id;
    this.metadata = metadata;
    this.steps = []; // 关联的步骤列表
  }

  /**
   * 验证会话数据
   */
  validate() {
    const errors = [];

    if (!this.problem_category || this.problem_category.trim() === '') {
      errors.push('问题分类不能为空');
    }

    if (!this.problem_description || this.problem_description.trim() === '') {
      errors.push('问题描述不能为空');
    }

    const validStatuses = ['processing', 'completed', 'aborted'];
    if (!validStatuses.includes(this.status)) {
      errors.push(`状态必须是以下之一: ${validStatuses.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 更新会话状态
   */
  updateStatus(newStatus) {
    const validStatuses = ['processing', 'completed', 'aborted'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`无效的状态: ${newStatus}`);
    }
    
    this.status = newStatus;
    this.updated_at = new Date().toISOString();
  }

  /**
   * 添加步骤到会话
   */
  addStep(step) {
    this.steps.push(step);
    this.updated_at = new Date().toISOString();
  }

  /**
   * 获取当前活跃步骤
   */
  getCurrentStep() {
    return this.steps.find(step => 
      step.execution_status === 'pending' || step.execution_status === 'executing'
    );
  }

  /**
   * 获取已完成的步骤数量
   */
  getCompletedStepsCount() {
    return this.steps.filter(step => step.execution_status === 'completed').length;
  }

  /**
   * 转换为JSON对象
   */
  toJSON() {
    return {
      session_id: this.session_id,
      problem_category: this.problem_category,
      problem_description: this.problem_description,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at,
      user_id: this.user_id,
      metadata: this.metadata,
      steps: this.steps,
      progress: {
        total_steps: this.steps.length,
        completed_steps: this.getCompletedStepsCount(),
        current_step: this.getCurrentStep()?.step_id || null
      }
    };
  }

  /**
   * 从JSON对象创建会话实例
   */
  static fromJSON(json) {
    const session = new Session(json);
    session.steps = json.steps || [];
    return session;
  }
}

export default Session;