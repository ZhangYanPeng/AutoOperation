/**
 * 文档管理集成测试
 * 测试完整的文档管理流程
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../../src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Document Management Integration Tests', () => {
  const testKnowledgeBasePath = path.join(__dirname, '../fixtures/test-knowledge-base');
  const testUploadsPath = path.join(testKnowledgeBasePath, 'uploads');
  const testDocumentsPath = path.join(testKnowledgeBasePath, 'operation-procedures');
  
  let uploadedDocumentId;
  let testFilePath;

  beforeAll(async () => {
    // 创建测试目录结构
    await fs.mkdir(testKnowledgeBasePath, { recursive: true });
    await fs.mkdir(testUploadsPath, { recursive: true });
    await fs.mkdir(testDocumentsPath, { recursive: true });
    
    // 创建测试文件
    testFilePath = path.join(__dirname, '../fixtures/test-document.md');
    const testContent = `# 网络故障处理规程

## 概述

本文档描述了网络故障的诊断和处理流程。

## 步骤一：初步诊断

1. 检查网络连接状态
2. 验证IP配置
3. 测试DNS解析

## 步骤二：深度诊断

使用以下工具进行深度诊断：

\`\`\`bash
ping 8.8.8.8
nslookup google.com
traceroute google.com
\`\`\`

## 常见问题

### DNS问题
- 检查DNS服务器配置
- 清除DNS缓存

### 路由问题
- 检查路由表
- 验证网关设置

## 总结

按照以上步骤可以解决大部分网络故障问题。`;

    await fs.writeFile(testFilePath, testContent, 'utf8');
  });

  afterAll(async () => {
    // 清理测试文件和目录
    try {
      await fs.rm(testKnowledgeBasePath, { recursive: true, force: true });
      await fs.unlink(testFilePath);
    } catch (error) {
      console.warn('清理测试文件失败:', error);
    }
  });

  beforeEach(async () => {
    // 重置测试环境
    uploadedDocumentId = null;
  });

  describe('Document Upload Flow', () => {
    test('should upload document successfully with complete metadata', async () => {
      // Arrange
      const testBuffer = await fs.readFile(testFilePath);
      
      // Act
      const response = await request(app)
        .post('/api/v1/documents/upload')
        .attach('file', testBuffer, 'test-document.md')
        .field('title', '网络故障处理规程')
        .field('category', 'network')
        .field('knowledge_type', 'operation-procedure')
        .field('priority', '5')
        .field('status', 'published')
        .field('tags', 'network,troubleshooting,dns')
        .field('uploader', 'test-user')
        .field('description', '详细的网络故障处理指南')
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('网络故障处理规程');
      expect(response.body.data.knowledge_id).toBeDefined();
      
      uploadedDocumentId = response.body.data.knowledge_id;
    });

    test('should reject upload with invalid file type', async () => {
      // Arrange
      const invalidContent = Buffer.from('Invalid content');
      
      // Act
      const response = await request(app)
        .post('/api/v1/documents/upload')
        .attach('file', invalidContent, 'invalid.pdf')
        .field('title', 'Invalid Document')
        .field('category', 'general')
        .expect(400);

      // Assert
      expect(response.body.error).toContain('文件验证失败');
    });

    test('should reject upload with missing required fields', async () => {
      // Arrange
      const testBuffer = await fs.readFile(testFilePath);
      
      // Act
      const response = await request(app)
        .post('/api/v1/documents/upload')
        .attach('file', testBuffer, 'test.md')
        // Missing title and category
        .expect(400);

      // Assert
      expect(response.body.error).toBeDefined();
    });

    test('should handle upload with auto-extracted metadata', async () => {
      // Arrange
      const testBuffer = await fs.readFile(testFilePath);
      
      // Act
      const response = await request(app)
        .post('/api/v1/documents/upload')
        .attach('file', testBuffer, 'auto-extract-test.md')
        .field('category', 'network')
        .field('knowledge_type', 'operation-procedure')
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('网络故障处理规程'); // Auto-extracted from content
    });
  });

  describe('Document Retrieval Flow', () => {
    beforeEach(async () => {
      // 确保有文档可供测试
      if (!uploadedDocumentId) {
        const testBuffer = await fs.readFile(testFilePath);
        const uploadResponse = await request(app)
          .post('/api/v1/documents/upload')
          .attach('file', testBuffer, 'test-retrieve.md')
          .field('title', '测试检索文档')
          .field('category', 'network')
          .field('knowledge_type', 'operation-procedure');
        
        uploadedDocumentId = uploadResponse.body.data.knowledge_id;
      }
    });

    test('should retrieve document list with pagination', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/documents/list')
        .query({
          page: 1,
          limit: 10
        })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.documents).toBeInstanceOf(Array);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.current_page).toBe(1);
    });

    test('should filter documents by category', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/documents/list')
        .query({
          category: 'network'
        })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      response.body.data.documents.forEach(doc => {
        expect(doc.category).toBe('network');
      });
    });

    test('should search documents by keyword', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/documents/list')
        .query({
          search: 'network'
        })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.documents.length).toBeGreaterThan(0);
    });

    test('should get single document by ID', async () => {
      // Act
      const response = await request(app)
        .get(`/api/v1/knowledge/${uploadedDocumentId}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.knowledge_id).toBe(uploadedDocumentId);
    });

    test('should return 404 for non-existent document', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/knowledge/non-existent-id')
        .expect(404);

      // Assert
      expect(response.body.error).toContain('不存在');
    });
  });

  describe('Document Update Flow', () => {
    beforeEach(async () => {
      // 确保有文档可供测试
      if (!uploadedDocumentId) {
        const testBuffer = await fs.readFile(testFilePath);
        const uploadResponse = await request(app)
          .post('/api/v1/documents/upload')
          .attach('file', testBuffer, 'test-update.md')
          .field('title', '测试更新文档')
          .field('category', 'network')
          .field('knowledge_type', 'operation-procedure');
        
        uploadedDocumentId = uploadResponse.body.data.knowledge_id;
      }
    });

    test('should update document successfully', async () => {
      // Arrange
      const updates = {
        title: '更新后的标题',
        content: '# 更新后的内容\n\n这是更新后的文档内容。',
        priority: 8,
        tags: ['updated', 'network', 'guide']
      };

      // Act
      const response = await request(app)
        .put(`/api/v1/documents/${uploadedDocumentId}`)
        .send(updates)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('更新后的标题');
      expect(response.body.data.priority).toBe(8);
    });

    test('should reject update of non-existent document', async () => {
      // Act
      const response = await request(app)
        .put('/api/v1/documents/non-existent-id')
        .send({ title: 'New Title' })
        .expect(404);

      // Assert
      expect(response.body.error).toContain('不存在');
    });

    test('should validate update data', async () => {
      // Act
      const response = await request(app)
        .put(`/api/v1/documents/${uploadedDocumentId}`)
        .send({ 
          title: '', // Invalid: empty title
          priority: 15 // Invalid: priority out of range
        })
        .expect(400);

      // Assert
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Document Operation Flow', () => {
    beforeEach(async () => {
      // 确保有文档可供测试
      if (!uploadedDocumentId) {
        const testBuffer = await fs.readFile(testFilePath);
        const uploadResponse = await request(app)
          .post('/api/v1/documents/upload')
          .attach('file', testBuffer, 'test-operations.md')
          .field('title', '测试操作文档')
          .field('category', 'network')
          .field('knowledge_type', 'operation-procedure');
        
        uploadedDocumentId = uploadResponse.body.data.knowledge_id;
      }
    });

    test('should download document successfully', async () => {
      // Act
      const response = await request(app)
        .get(`/api/v1/documents/${uploadedDocumentId}/download`)
        .expect(200);

      // Assert
      expect(response.headers['content-type']).toContain('text/markdown');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('# 网络故障处理规程');
    });

    test('should duplicate document successfully', async () => {
      // Act
      const response = await request(app)
        .post(`/api/v1/documents/${uploadedDocumentId}/duplicate`)
        .send({ title: '文档副本' })
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('文档副本');
      expect(response.body.data.knowledge_id).not.toBe(uploadedDocumentId);
    });

    test('should move document to different category', async () => {
      // Act
      const response = await request(app)
        .post(`/api/v1/documents/${uploadedDocumentId}/move`)
        .send({ target_category: 'security' })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.new_category).toBe('security');
    });

    test('should lock and unlock document', async () => {
      // Act - Lock document
      const lockResponse = await request(app)
        .post(`/api/v1/documents/${uploadedDocumentId}/lock`)
        .send({ action: 'lock', user: 'test-user' })
        .expect(200);

      // Assert - Document locked
      expect(lockResponse.body.success).toBe(true);
      expect(lockResponse.body.data.is_locked).toBe(true);

      // Act - Unlock document
      const unlockResponse = await request(app)
        .post(`/api/v1/documents/${uploadedDocumentId}/lock`)
        .send({ action: 'unlock' })
        .expect(200);

      // Assert - Document unlocked
      expect(unlockResponse.body.success).toBe(true);
      expect(unlockResponse.body.data.is_locked).toBe(false);
    });

    test('should delete document (soft delete)', async () => {
      // Act
      const response = await request(app)
        .delete(`/api/v1/documents/${uploadedDocumentId}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('回收站');

      // Verify document is archived
      const getResponse = await request(app)
        .get(`/api/v1/knowledge/${uploadedDocumentId}`)
        .expect(200);
      
      expect(getResponse.body.data.status).toBe('archived');
    });

    test('should delete document permanently', async () => {
      // Act
      const response = await request(app)
        .delete(`/api/v1/documents/${uploadedDocumentId}`)
        .query({ permanent: true })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('永久删除');

      // Verify document no longer exists
      await request(app)
        .get(`/api/v1/knowledge/${uploadedDocumentId}`)
        .expect(404);
    });
  });

  describe('Batch Operations Flow', () => {
    let testDocumentIds = [];

    beforeEach(async () => {
      // 创建多个测试文档
      testDocumentIds = [];
      const testBuffer = await fs.readFile(testFilePath);

      for (let i = 1; i <= 3; i++) {
        const uploadResponse = await request(app)
          .post('/api/v1/documents/upload')
          .attach('file', testBuffer, `batch-test-${i}.md`)
          .field('title', `批量测试文档 ${i}`)
          .field('category', 'general')
          .field('knowledge_type', 'operation-procedure');
        
        testDocumentIds.push(uploadResponse.body.data.knowledge_id);
      }
    });

    test('should perform batch delete operation', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/documents/batch')
        .send({
          action: 'delete',
          ids: testDocumentIds,
          options: { permanent: false }
        })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.success).toBe(3);
      expect(response.body.data.summary.failed).toBe(0);
    });

    test('should perform batch move operation', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/documents/batch')
        .send({
          action: 'move',
          ids: testDocumentIds,
          options: { targetCategory: 'network' }
        })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.success).toBe(3);

      // Verify documents moved
      for (const id of testDocumentIds) {
        const getResponse = await request(app)
          .get(`/api/v1/knowledge/${id}`)
          .expect(200);
        
        expect(getResponse.body.data.category).toBe('network');
      }
    });

    test('should handle partial batch operation failures', async () => {
      // Arrange - Include non-existent ID
      const idsWithInvalid = [...testDocumentIds, 'non-existent-id'];

      // Act
      const response = await request(app)
        .post('/api/v1/documents/batch')
        .send({
          action: 'delete',
          ids: idsWithInvalid
        })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.success).toBe(3);
      expect(response.body.data.summary.failed).toBe(1);
      expect(response.body.data.errors).toHaveLength(1);
    });

    test('should validate batch operation parameters', async () => {
      // Act - Invalid operation
      const response1 = await request(app)
        .post('/api/v1/documents/batch')
        .send({
          action: 'invalid-action',
          ids: testDocumentIds
        })
        .expect(400);

      // Assert
      expect(response1.body.error).toContain('参数验证失败');

      // Act - Empty IDs
      const response2 = await request(app)
        .post('/api/v1/documents/batch')
        .send({
          action: 'delete',
          ids: []
        })
        .expect(400);

      // Assert
      expect(response2.body.error).toContain('参数验证失败');

      // Act - Move without target category
      const response3 = await request(app)
        .post('/api/v1/documents/batch')
        .send({
          action: 'move',
          ids: testDocumentIds
          // Missing options.targetCategory
        })
        .expect(400);

      // Assert
      expect(response3.body.error).toContain('参数验证失败');
    });
  });

  describe('Statistics and Management Flow', () => {
    test('should get document statistics', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/documents/stats')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.documents).toBeDefined();
      expect(response.body.data.storage).toBeDefined();
      expect(response.body.data.documents.total).toBeTypeOf('number');
      expect(response.body.data.documents.byType).toBeTypeOf('object');
      expect(response.body.data.documents.byCategory).toBeTypeOf('object');
    });

    test('should cleanup temporary files', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/documents/cleanup')
        .send({ maxAge: 24 * 60 * 60 * 1000 }) // 24 hours
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.cleaned_files).toBeTypeOf('number');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle file upload errors gracefully', async () => {
      // Act - Upload without file
      const response = await request(app)
        .post('/api/v1/documents/upload')
        .field('title', 'No File Document')
        .expect(400);

      // Assert
      expect(response.body.error).toContain('文件');
    });

    test('should handle concurrent access to same document', async () => {
      // This test would require more complex setup to simulate actual concurrency
      // For now, we test the locking mechanism
      
      const testBuffer = await fs.readFile(testFilePath);
      const uploadResponse = await request(app)
        .post('/api/v1/documents/upload')
        .attach('file', testBuffer, 'concurrent-test.md')
        .field('title', '并发测试文档')
        .field('category', 'general')
        .field('knowledge_type', 'operation-procedure');
      
      const docId = uploadResponse.body.data.knowledge_id;

      // Lock document
      await request(app)
        .post(`/api/v1/documents/${docId}/lock`)
        .send({ action: 'lock', user: 'user1' })
        .expect(200);

      // Try to update locked document
      const updateResponse = await request(app)
        .put(`/api/v1/documents/${docId}`)
        .send({ title: 'Updated Title' })
        .expect(423); // Locked

      expect(updateResponse.body.error).toContain('锁定');
    });

    test('should handle malformed requests', async () => {
      // Act - Invalid JSON
      const response = await request(app)
        .put('/api/v1/documents/some-id')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      // Assert
      expect(response.body.error).toBeDefined();
    });

    test('should handle very large content', async () => {
      // Arrange - Create large content (but within limits)
      const largeContent = '# Large Document\n\n' + 'A'.repeat(500000); // 500KB
      const largePath = path.join(__dirname, '../fixtures/large-test.md');
      await fs.writeFile(largePath, largeContent, 'utf8');

      try {
        const testBuffer = await fs.readFile(largePath);
        
        // Act
        const response = await request(app)
          .post('/api/v1/documents/upload')
          .attach('file', testBuffer, 'large-test.md')
          .field('title', '大文档测试')
          .field('category', 'general')
          .field('knowledge_type', 'operation-procedure')
          .expect(201);

        // Assert
        expect(response.body.success).toBe(true);
      } finally {
        // Cleanup
        await fs.unlink(largePath).catch(() => {});
      }
    });
  });
});