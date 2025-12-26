/**
 * 会话管理服务
 * 负责管理处置会话的生命周期，支持内存和文件存储
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Session } from '../models/Session.js';
import { Step } from '../models/Step.js';
import { processingEngine } from './ProcessingEngine.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SessionManagementService {
  constructor() {
    this.sessions = new Map(); // 内存存储
    this.initialized = false;
    this.config = {
      enableFileStorage: true,
      dataPath: null,
      autoSave: true,
      saveInterval: 30000, // 30秒自动保存
      maxSessionsInMemory: 1000,
      sessionTTL: 24 * 60 * 60 * 1000 // 24小时
    };
    this.saveTimer = null;
  }

  /**
   * 初始化会话管理服务
   */
  async initialize(config = {}) {
    try {
      this.config = { ...this.config, ...config };
      
      // 设置数据存储路径
      this.config.dataPath = this.config.dataPath || this.getDefaultDataPath();
      
      // 创建数据目录
      if (this.config.enableFileStorage) {
        await this.ensureDataDirectory();
        await this.loadSessionsFromFile();
      }

      // 确保处置引擎已初始化
      if (!processingEngine.initialized) {
        await processingEngine.initialize();
      }

      // 启动自动保存定时器
      if (this.config.autoSave && this.config.enableFileStorage) {
        this.startAutoSave();
      }

      // 启动清理定时器
      this.startCleanupTimer();

      this.initialized = true;
      logger.info('会话管理服务初始化成功', {
        sessionsLoaded: this.sessions.size,
        fileStorage: this.config.enableFileStorage,
        autoSave: this.config.autoSave
      });
    } catch (error) {
      logger.error('会话管理服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检查初始化状态
   */
  checkInitialized() {
    if (!this.initialized) {
      throw new Error('会话管理服务未初始化，请先调用 initialize()');
    }
  }

  /**
   * 获取默认数据路径
   */
  getDefaultDataPath() {
    return path.join(__dirname, '../../data/sessions');
  }

  /**
   * 确保数据目录存在
   */
  async ensureDataDirectory() {
    const dataPath = this.config.dataPath;
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
      logger.info(`已创建会话数据目录: ${dataPath}`);
    }
  }

  /**
   * 从文件加载会话
   */
  async loadSessionsFromFile() {
    try {
      const dataPath = this.config.dataPath;
      if (!fs.existsSync(dataPath)) {
        return;
      }

      const files = fs.readdirSync(dataPath);
      const sessionFiles = files.filter(file => file.endsWith('.json'));

      for (const file of sessionFiles) {
        try {
          const filePath = path.join(dataPath, file);
          const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          // 重建会话对象
          const session = Session.fromJSON(sessionData);
          session.steps = sessionData.steps.map(stepData => Step.fromJSON(stepData));
          
          this.sessions.set(session.session_id, session);
        } catch (error) {
          logger.error(`加载会话文件失败: ${file}`, error);
        }
      }

      logger.info(`从文件加载了 ${this.sessions.size} 个会话`);
    } catch (error) {
      logger.error('从文件加载会话失败:', error);
    }
  }

  /**
   * 保存会话到文件
   */
  async saveSessionToFile(session) {
    if (!this.config.enableFileStorage) {
      return;
    }

    try {
      const filePath = path.join(this.config.dataPath, `${session.session_id}.json`);
      const sessionData = session.toJSON();
      
      fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
    } catch (error) {
      logger.error(`保存会话文件失败: ${session.session_id}`, error);
    }
  }

  /**
   * 保存所有会话到文件
   */
  async saveAllSessionsToFile() {
    if (!this.config.enableFileStorage) {
      return;
    }

    try {
      let savedCount = 0;
      for (const session of this.sessions.values()) {
        await this.saveSessionToFile(session);
        savedCount++;
      }
      
      logger.info(`已保存 ${savedCount} 个会话到文件`);
    } catch (error) {
      logger.error('保存所有会话失败:', error);
    }
  }

  /**
   * 启动自动保存
   */
  startAutoSave() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }

    this.saveTimer = setInterval(() => {
      this.saveAllSessionsToFile();
    }, this.config.saveInterval);

    logger.info(`已启动自动保存，间隔: ${this.config.saveInterval}ms`);
  }

  /**
   * 启动清理定时器
   */
  startCleanupTimer() {
    // 每小时清理一次过期会话
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];

    for (const [sessionId, session] of this.sessions) {
      const sessionAge = now - new Date(session.created_at).getTime();
      if (sessionAge > this.config.sessionTTL) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.deleteSession(sessionId);
    }

    if (expiredSessions.length > 0) {
      logger.info(`已清理 ${expiredSessions.length} 个过期会话`);
    }
  }

  /**
   * 创建新会话
   */
  async createSession(problemCategory, problemDescription, userId = null) {
    this.checkInitialized();

    try {
      // 检查内存使用量
      if (this.sessions.size >= this.config.maxSessionsInMemory) {
        await this.evictOldestSessions();
      }

      // 使用处置引擎创建会话
      const result = await processingEngine.createSession(problemCategory, problemDescription, userId);
      const session = Session.fromJSON(result.session);
      session.steps = result.session.steps.map(stepData => Step.fromJSON(stepData));

      // 存储到内存
      this.sessions.set(session.session_id, session);

      // 保存到文件
      await this.saveSessionToFile(session);

      logger.info('会话创建成功', {
        sessionId: session.session_id,
        userId,
        category: problemCategory
      });

      return {
        session: session.toJSON(),
        initialPlan: result.initialPlan
      };
    } catch (error) {
      logger.error('创建会话失败:', error);
      throw error;
    }
  }

  /**
   * 驱逐最旧的会话
   */
  async evictOldestSessions() {
    const sessionArray = Array.from(this.sessions.values());
    sessionArray.sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
    
    const toRemove = Math.floor(this.config.maxSessionsInMemory * 0.1); // 移除10%
    for (let i = 0; i < toRemove && i < sessionArray.length; i++) {
      const session = sessionArray[i];
      await this.saveSessionToFile(session); // 确保保存到文件
      this.sessions.delete(session.session_id);
    }

    logger.info(`已驱逐 ${toRemove} 个最旧的会话`);
  }

  /**
   * 获取会话
   */
  async getSession(sessionId) {
    this.checkInitialized();

    // 先从内存查找
    let session = this.sessions.get(sessionId);
    
    if (!session && this.config.enableFileStorage) {
      // 从文件加载
      session = await this.loadSessionFromFile(sessionId);
      if (session) {
        this.sessions.set(sessionId, session);
      }
    }

    if (!session) {
      return null;
    }

    return session.toJSON();
  }

  /**
   * 从文件加载单个会话
   */
  async loadSessionFromFile(sessionId) {
    try {
      const filePath = path.join(this.config.dataPath, `${sessionId}.json`);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const session = Session.fromJSON(sessionData);
      session.steps = sessionData.steps.map(stepData => Step.fromJSON(stepData));

      return session;
    } catch (error) {
      logger.error(`从文件加载会话失败: ${sessionId}`, error);
      return null;
    }
  }

  /**
   * 更新会话
   */
  async updateSession(sessionId, updates) {
    this.checkInitialized();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    // 更新会话属性
    Object.assign(session, updates);
    session.updated_at = new Date().toISOString();

    // 保存到文件
    await this.saveSessionToFile(session);

    logger.info('会话更新成功', { sessionId });

    return session.toJSON();
  }

  /**
   * 执行步骤
   */
  async executeStep(sessionId, stepId, executionType = 'auto', userInput = null) {
    this.checkInitialized();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    try {
      const result = await processingEngine.executeStep(session, stepId, executionType, userInput);
      
      // 保存更新后的会话
      await this.saveSessionToFile(session);

      return result;
    } catch (error) {
      // 保存错误状态
      await this.saveSessionToFile(session);
      throw error;
    }
  }

  /**
   * 处理用户反馈
   */
  async processFeedback(sessionId, stepId, feedback) {
    this.checkInitialized();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    try {
      const result = await processingEngine.processFeedback(session, stepId, feedback);
      
      // 保存更新后的会话
      await this.saveSessionToFile(session);

      return result;
    } catch (error) {
      await this.saveSessionToFile(session);
      throw error;
    }
  }

  /**
   * 获取会话状态
   */
  getSessionStatus(sessionId) {
    this.checkInitialized();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    return processingEngine.getSessionStatus(session);
  }

  /**
   * 完成会话
   */
  async completeSession(sessionId, summary = '') {
    this.checkInitialized();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    try {
      const result = await processingEngine.completeSession(session, summary);
      
      // 保存完成状态
      await this.saveSessionToFile(session);

      logger.info('会话完成', { sessionId });

      return result;
    } catch (error) {
      await this.saveSessionToFile(session);
      throw error;
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId) {
    this.checkInitialized();

    // 从内存删除
    this.sessions.delete(sessionId);

    // 从文件删除
    if (this.config.enableFileStorage) {
      try {
        const filePath = path.join(this.config.dataPath, `${sessionId}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        logger.error(`删除会话文件失败: ${sessionId}`, error);
      }
    }

    logger.info('会话删除成功', { sessionId });
  }

  /**
   * 获取用户的所有会话
   */
  getUserSessions(userId, limit = 50, offset = 0) {
    this.checkInitialized();

    const userSessions = [];
    
    for (const session of this.sessions.values()) {
      if (session.user_id === userId) {
        userSessions.push(session.toJSON());
      }
    }

    // 按更新时间排序
    userSessions.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    return {
      total: userSessions.length,
      sessions: userSessions.slice(offset, offset + limit)
    };
  }

  /**
   * 搜索会话
   */
  searchSessions(query, filters = {}) {
    this.checkInitialized();

    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const session of this.sessions.values()) {
      // 类别过滤
      if (filters.category && session.problem_category !== filters.category) {
        continue;
      }

      // 状态过滤
      if (filters.status && session.status !== filters.status) {
        continue;
      }

      // 用户过滤
      if (filters.userId && session.user_id !== filters.userId) {
        continue;
      }

      // 文本匹配
      if (query) {
        const matchInDescription = session.problem_description.toLowerCase().includes(lowerQuery);
        const matchInCategory = session.problem_category.toLowerCase().includes(lowerQuery);
        
        if (!matchInDescription && !matchInCategory) {
          continue;
        }
      }

      results.push(session.toJSON());
    }

    // 按相关性和时间排序
    results.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    return {
      query,
      filters,
      total: results.length,
      results: results.slice(0, filters.limit || 50)
    };
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    this.checkInitialized();

    const stats = {
      total_sessions: this.sessions.size,
      by_status: {},
      by_category: {},
      active_sessions: 0,
      completed_sessions: 0,
      failed_sessions: 0,
      average_steps: 0,
      average_duration: 0
    };

    let totalSteps = 0;
    let totalDuration = 0;
    let completedCount = 0;

    for (const session of this.sessions.values()) {
      // 按状态统计
      stats.by_status[session.status] = (stats.by_status[session.status] || 0) + 1;
      
      // 按分类统计
      stats.by_category[session.problem_category] = (stats.by_category[session.problem_category] || 0) + 1;

      // 活跃/完成/失败会话
      if (session.status === 'processing') {
        stats.active_sessions++;
      } else if (session.status === 'completed') {
        stats.completed_sessions++;
        completedCount++;
        
        // 计算持续时间
        const duration = new Date(session.updated_at) - new Date(session.created_at);
        totalDuration += duration;
      } else if (session.status === 'aborted') {
        stats.failed_sessions++;
      }

      // 步骤统计
      totalSteps += session.steps.length;
    }

    // 计算平均值
    if (this.sessions.size > 0) {
      stats.average_steps = totalSteps / this.sessions.size;
    }
    
    if (completedCount > 0) {
      stats.average_duration = totalDuration / completedCount;
    }

    return stats;
  }

  /**
   * 导出会话数据
   */
  async exportSessionData(sessionId = null, format = 'json') {
    this.checkInitialized();

    try {
      let sessions;
      
      if (sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
          throw new Error(`会话不存在: ${sessionId}`);
        }
        sessions = [session.toJSON()];
      } else {
        sessions = Array.from(this.sessions.values()).map(s => s.toJSON());
      }

      if (format === 'json') {
        return JSON.stringify(sessions, null, 2);
      } else if (format === 'csv') {
        // 简单的CSV导出
        const headers = ['session_id', 'problem_category', 'problem_description', 'status', 'created_at', 'updated_at'];
        const rows = sessions.map(s => [
          s.session_id,
          s.problem_category,
          s.problem_description.replace(/"/g, '""'),
          s.status,
          s.created_at,
          s.updated_at
        ]);
        
        return [headers, ...rows].map(row => 
          row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
      }

      throw new Error(`不支持的导出格式: ${format}`);
    } catch (error) {
      logger.error('导出会话数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取服务状态
   */
  getServiceStatus() {
    return {
      initialized: this.initialized,
      sessions_in_memory: this.sessions.size,
      file_storage_enabled: this.config.enableFileStorage,
      auto_save_enabled: this.config.autoSave,
      data_path: this.config.dataPath,
      config: this.config
    };
  }

  /**
   * 关闭服务
   */
  async shutdown() {
    try {
      // 停止定时器
      if (this.saveTimer) {
        clearInterval(this.saveTimer);
        this.saveTimer = null;
      }

      // 保存所有会话
      if (this.config.enableFileStorage) {
        await this.saveAllSessionsToFile();
      }

      logger.info('会话管理服务已关闭');
    } catch (error) {
      logger.error('关闭会话管理服务失败:', error);
    }
  }
}

// 创建全局单例实例
export const sessionManagementService = new SessionManagementService();

export default sessionManagementService;