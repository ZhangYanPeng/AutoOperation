import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger.js';

// 新的中间件系统导入
import {
  requestLogger,
  errorHandler,
  notFound,
  corsOptions,
  apiLimiter,
  sessionCreationLimiter,
  requestId,
  requestSizeLimit,
  securityHeaders,
  validateContentType,
  validateNotEmpty
} from './middleware/index.js';

// 服务导入
import { llmService } from './services/LLMService.js';
import { knowledgeBaseService } from './services/KnowledgeBaseService.js';
import { toolExecutionService } from './services/ToolExecutionService.js';
import { sessionManagementService } from './services/SessionManagementService.js';
import { categoryService } from './services/CategoryService.js';
import { troubleKnowledgeService } from './services/TroubleKnowledgeService.js';
import { deviceAPIService } from './services/DeviceAPIService.js';
import { searchRouterService } from './services/SearchRouterService.js';

// 路由导入
import sessionRoutes from './controllers/sessionController.js';
import toolRoutes from './controllers/toolController.js';
import knowledgeRoutes from './controllers/knowledgeController.js';
import documentRoutes from './controllers/documentController.js';
import categoryRoutes from './controllers/categoryController.js';
import searchRoutes from './controllers/searchController.js';

// 文档管理中间件导入
import uploadMiddleware from './middleware/uploadMiddleware.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 初始化所有服务
async function initializeServices() {
  try {
    logger.info('开始初始化后端服务...');
    
    // 按依赖顺序初始化服务
    await categoryService.initialize(); // 先初始化分类服务
    await troubleKnowledgeService.initialize(); // 初始化故障处置知识服务
    await deviceAPIService.initialize(); // 初始化设备API服务
    await searchRouterService.initialize(); // 初始化搜索路由服务
    await llmService.initialize();
    await knowledgeBaseService.initialize();
    await toolExecutionService.initialize();
    await sessionManagementService.initialize();
    
    logger.info('所有后端服务初始化完成');
  } catch (error) {
    logger.error('服务初始化失败:', error);
    process.exit(1);
  }
}

// 基础中间件配置
app.use(requestId); // 请求ID
app.use(securityHeaders); // 安全头
app.use(compression());
app.use(cors(corsOptions)); // 使用新的CORS配置
app.use(requestSizeLimit); // 请求大小限制

// API请求限制
app.use('/api/', apiLimiter);

// 内容类型和请求体验证
app.use(validateContentType());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(validateNotEmpty);

// 请求日志中间件
app.use(requestLogger);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      llm: llmService.initialized,
      categories: categoryService.initialized,
      troubleKnowledge: troubleKnowledgeService.initialized,
      deviceAPI: deviceAPIService.initialized,
      searchRouter: searchRouterService.initialized,
      knowledge: knowledgeBaseService.initialized,
      tools: toolExecutionService.initialized,
      sessions: sessionManagementService.initialized
    }
  });
});

// 系统状态端点
app.get('/status', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    services: {
      llm: llmService.getStatus(),
      categories: categoryService.getStatistics(),
      troubleKnowledge: troubleKnowledgeService.getStatistics(),
      deviceAPI: deviceAPIService.getStatistics(),
      searchRouter: searchRouterService.getStatistics(),
      knowledge: knowledgeBaseService.getStatistics(),
      tools: toolExecutionService.getStatus(),
      sessions: sessionManagementService.getServiceStatus()
    }
  });
});

// API路由
app.use('/api/v1/session', sessionRoutes);
app.use('/api/v1/tools', toolRoutes);
app.use('/api/v1/knowledge', knowledgeRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/search', searchRoutes);

// 404处理
app.use(notFound);

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
async function startServer() {
  try {
    // 初始化所有服务
    await initializeServices();
    
    // 启动HTTP服务器
    app.listen(PORT, () => {
      logger.info(`智能运维助手后端服务已启动，端口: ${PORT}`);
      logger.info(`健康检查地址: http://localhost:${PORT}/health`);
      logger.info(`系统状态地址: http://localhost:${PORT}/status`);
      logger.info(`API基础地址: http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    logger.error('启动服务器失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('收到SIGTERM信号，正在关闭服务器...');
  await sessionManagementService.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('收到SIGINT信号，正在关闭服务器...');
  await sessionManagementService.shutdown();
  process.exit(0);
});

// 启动应用
startServer();

export default app;