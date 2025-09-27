/**
 * 知识库服务单元测试
 */

const { KnowledgeBaseService } = require('../src/services/KnowledgeBaseService');
const fs = require('fs').promises;
const path = require('path');

describe('KnowledgeBaseService', () => {
  let knowledgeService;
  const testKnowledgeDir = path.join(__dirname, '../../temp/knowledge');

  beforeAll(async () => {
    // 创建测试知识库目录
    await fs.mkdir(testKnowledgeDir, { recursive: true });
    
    // 创建测试文档
    const testDoc1 = `# 网络故障处理

## 问题类型
网络连接问题

## 处置步骤
1. 检查网络连接状态
2. 检查DNS配置
3. 重启网络服务

## 相关工具
- ping
- nslookup
- networkctl`;

    const testDoc2 = `# 服务器性能优化

## 问题类型
性能问题

## 处置步骤
1. 检查CPU使用率
2. 检查内存使用情况
3. 分析进程状态

## 相关工具
- top
- htop
- ps`;

    await fs.writeFile(path.join(testKnowledgeDir, 'network-troubleshooting.md'), testDoc1);
    await fs.writeFile(path.join(testKnowledgeDir, 'performance-optimization.md'), testDoc2);
  });

  beforeEach(() => {
    const config = {
      knowledgeBasePath: testKnowledgeDir,
      apiDocsPath: path.join(testKnowledgeDir, 'apis')
    };
    knowledgeService = new KnowledgeBaseService(config);
  });

  afterAll(async () => {
    // 清理测试目录
    await fs.rmdir(testKnowledgeDir, { recursive: true });
  });

  describe('初始化', () => {
    test('应该成功初始化知识库服务', async () => {
      await expect(knowledgeService.initialize()).resolves.not.toThrow();
      expect(knowledgeService.initialized).toBe(true);
    });

    test('应该加载知识库文档', async () => {
      await knowledgeService.initialize();
      
      const stats = knowledgeService.getStatistics();
      expect(stats.total_entries).toBeGreaterThan(0);
      expect(stats.categories).toContain('network');
      expect(stats.categories).toContain('performance');
    });
  });

  describe('文档搜索', () => {
    beforeEach(async () => {
      await knowledgeService.initialize();
    });

    test('应该搜索网络相关文档', async () => {
      const results = await knowledgeService.searchKnowledge('网络连接');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      const networkDoc = results.find(doc => doc.title.includes('网络'));
      expect(networkDoc).toBeDefined();
      expect(networkDoc.relevance_score).toBeGreaterThan(0);
    });

    test('应该搜索性能相关文档', async () => {
      const results = await knowledgeService.searchKnowledge('CPU 性能');
      
      expect(Array.isArray(results)).toBe(true);
      
      const perfDoc = results.find(doc => doc.title.includes('性能'));
      expect(perfDoc).toBeDefined();
    });

    test('应该处理空搜索查询', async () => {
      const results = await knowledgeService.searchKnowledge('');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    test('应该处理不存在的内容', async () => {
      const results = await knowledgeService.searchKnowledge('不存在的内容xyz123');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('分类搜索', () => {
    beforeEach(async () => {
      await knowledgeService.initialize();
    });

    test('应该按分类获取文档', async () => {
      const networkDocs = await knowledgeService.getDocumentsByCategory('network');
      
      expect(Array.isArray(networkDocs)).toBe(true);
      expect(networkDocs.length).toBeGreaterThan(0);
      
      networkDocs.forEach(doc => {
        expect(doc.category).toBe('network');
      });
    });

    test('应该处理不存在的分类', async () => {
      const docs = await knowledgeService.getDocumentsByCategory('nonexistent');
      
      expect(Array.isArray(docs)).toBe(true);
      expect(docs.length).toBe(0);
    });
  });

  describe('相关文档推荐', () => {
    beforeEach(async () => {
      await knowledgeService.initialize();
    });

    test('应该根据问题推荐相关文档', async () => {
      const problem = '网络连接超时，无法访问外部服务';
      
      const recommendations = await knowledgeService.recommendDocuments(problem, 'network');
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      
      recommendations.forEach(doc => {
        expect(doc).toHaveProperty('title');
        expect(doc).toHaveProperty('relevance_score');
        expect(doc).toHaveProperty('reason');
      });
    });

    test('应该限制推荐数量', async () => {
      const problem = '服务器性能问题';
      const limit = 2;
      
      const recommendations = await knowledgeService.recommendDocuments(
        problem, 
        'performance', 
        limit
      );
      
      expect(recommendations.length).toBeLessThanOrEqual(limit);
    });
  });

  describe('文档内容提取', () => {
    beforeEach(async () => {
      await knowledgeService.initialize();
    });

    test('应该提取文档步骤', async () => {
      const docs = await knowledgeService.searchKnowledge('网络');
      const doc = docs[0];
      
      const steps = knowledgeService.extractStepsFromDocument(doc);
      
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
      
      steps.forEach(step => {
        expect(typeof step).toBe('string');
        expect(step.length).toBeGreaterThan(0);
      });
    });

    test('应该提取相关工具', async () => {
      const docs = await knowledgeService.searchKnowledge('网络');
      const doc = docs[0];
      
      const tools = knowledgeService.extractToolsFromDocument(doc);
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      tools.forEach(tool => {
        expect(typeof tool).toBe('string');
        expect(tool.length).toBeGreaterThan(0);
      });
    });
  });

  describe('统计信息', () => {
    beforeEach(async () => {
      await knowledgeService.initialize();
    });

    test('应该返回正确的统计信息', () => {
      const stats = knowledgeService.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('total_entries');
      expect(stats).toHaveProperty('categories');
      expect(stats).toHaveProperty('last_updated');
      
      expect(typeof stats.total_entries).toBe('number');
      expect(Array.isArray(stats.categories)).toBe(true);
      expect(stats.total_entries).toBeGreaterThan(0);
    });

    test('应该跟踪搜索统计', async () => {
      const initialStats = knowledgeService.getStatistics();
      
      await knowledgeService.searchKnowledge('测试查询');
      
      const updatedStats = knowledgeService.getStatistics();
      expect(updatedStats.search_count).toBe(initialStats.search_count + 1);
    });
  });

  describe('知识库更新', () => {
    test('应该重新加载知识库', async () => {
      await knowledgeService.initialize();
      
      const initialStats = knowledgeService.getStatistics();
      
      // 添加新文档
      const newDoc = `# 安全问题处理

## 问题类型
安全问题

## 处置步骤
1. 检查安全日志
2. 分析威胁
3. 实施防护措施`;

      await fs.writeFile(path.join(testKnowledgeDir, 'security-handling.md'), newDoc);
      
      await knowledgeService.reloadKnowledge();
      
      const updatedStats = knowledgeService.getStatistics();
      expect(updatedStats.total_entries).toBe(initialStats.total_entries + 1);
      expect(updatedStats.categories).toContain('security');
    });
  });
});