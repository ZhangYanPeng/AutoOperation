/**
 * 文档管理服务单元测试
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { DocumentManagementService } from '../src/services/DocumentManagementService.js';
import { FileStorageService } from '../src/services/FileStorageService.js';
import { ValidationService } from '../src/services/ValidationService.js';
import { KnowledgeEntry } from '../src/models/KnowledgeEntry.js';

// Mock dependencies
const mockKnowledgeBaseService = {
  addKnowledgeEntry: vi.fn(),
  getKnowledgeEntry: vi.fn(),
  removeKnowledgeEntry: vi.fn(),
  knowledgeEntries: new Map()
};

const mockFileStorageService = {
  saveFile: vi.fn(),
  deleteFile: vi.fn(),
  moveToArchive: vi.fn(),
  moveFile: vi.fn(),
  saveContentAsFile: vi.fn()
};

const mockValidationService = {
  validateFile: vi.fn()
};

describe('DocumentManagementService', () => {
  let documentService;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    documentService = new DocumentManagementService(
      mockKnowledgeBaseService,
      mockFileStorageService,
      mockValidationService
    );
  });

  describe('uploadDocument', () => {
    test('should successfully upload a valid document', async () => {
      // Arrange
      const mockFile = {
        originalname: 'test-document.md',
        size: 1024,
        mimetype: 'text/markdown',
        buffer: Buffer.from('# Test Document\n\nThis is a test document.')
      };
      
      const metadata = {
        category: 'general',
        knowledge_type: 'operation-procedure',
        uploader: 'test-user'
      };

      mockValidationService.validateFile.mockResolvedValue({ isValid: true, errors: [] });
      mockFileStorageService.saveFile.mockResolvedValue('/path/to/saved/file.md');

      // Act
      const result = await documentService.uploadDocument(mockFile, metadata);

      // Assert
      expect(mockValidationService.validateFile).toHaveBeenCalledWith(mockFile);
      expect(mockFileStorageService.saveFile).toHaveBeenCalled();
      expect(mockKnowledgeBaseService.addKnowledgeEntry).toHaveBeenCalled();
      expect(result).toBeInstanceOf(KnowledgeEntry);
      expect(result.title).toBe('Test Document');
    });

    test('should reject invalid file', async () => {
      // Arrange
      const mockFile = {
        originalname: 'invalid.txt',
        size: 1024,
        mimetype: 'text/plain',
        buffer: Buffer.from('')
      };

      mockValidationService.validateFile.mockResolvedValue({ 
        isValid: false, 
        errors: ['文件内容不能为空'] 
      });

      // Act & Assert
      await expect(documentService.uploadDocument(mockFile, {}))
        .rejects.toThrow('文件验证失败: 文件内容不能为空');
    });

    test('should extract title from markdown content', async () => {
      // Arrange
      const mockFile = {
        originalname: 'document.md',
        size: 1024,
        mimetype: 'text/markdown',
        buffer: Buffer.from('# 网络故障处理规程\n\n## 步骤一\n\n检查网络连接状态...')
      };

      mockValidationService.validateFile.mockResolvedValue({ isValid: true, errors: [] });
      mockFileStorageService.saveFile.mockResolvedValue('/path/to/file.md');

      // Act
      const result = await documentService.uploadDocument(mockFile, {});

      // Assert
      expect(result.title).toBe('网络故障处理规程');
    });
  });

  describe('updateDocument', () => {
    test('should successfully update document', async () => {
      // Arrange
      const documentId = 'test-doc-id';
      const mockDocument = new KnowledgeEntry({
        knowledge_id: documentId,
        knowledge_type: 'operation-procedure',
        title: 'Original Title',
        content: 'Original content',
        is_locked: false
      });

      const updates = {
        title: 'Updated Title',
        content: 'Updated content'
      };

      mockKnowledgeBaseService.getKnowledgeEntry.mockReturnValue(mockDocument);

      // Act
      const result = await documentService.updateDocument(documentId, updates);

      // Assert
      expect(result.title).toBe('Updated Title');
      expect(result.content).toBe('Updated content');
      expect(result.version_history).toHaveLength(1);
    });

    test('should reject update of locked document', async () => {
      // Arrange
      const documentId = 'locked-doc-id';
      const mockDocument = new KnowledgeEntry({
        knowledge_id: documentId,
        knowledge_type: 'operation-procedure',
        title: 'Locked Document',
        content: 'Content',
        is_locked: true
      });

      mockKnowledgeBaseService.getKnowledgeEntry.mockReturnValue(mockDocument);

      // Act & Assert
      await expect(documentService.updateDocument(documentId, { title: 'New Title' }))
        .rejects.toThrow('文档已被锁定，无法编辑');
    });

    test('should reject update of non-existent document', async () => {
      // Arrange
      const documentId = 'non-existent-id';
      mockKnowledgeBaseService.getKnowledgeEntry.mockReturnValue(null);

      // Act & Assert
      await expect(documentService.updateDocument(documentId, { title: 'New Title' }))
        .rejects.toThrow('知识条目不存在: non-existent-id');
    });
  });

  describe('deleteDocument', () => {
    test('should perform soft delete by default', async () => {
      // Arrange
      const documentId = 'test-doc-id';
      const mockDocument = new KnowledgeEntry({
        knowledge_id: documentId,
        knowledge_type: 'operation-procedure',
        title: 'Test Document',
        content: 'Content',
        source_file: 'test.md'
      });

      mockKnowledgeBaseService.getKnowledgeEntry.mockReturnValue(mockDocument);
      mockFileStorageService.moveToArchive.mockResolvedValue('/archived/test.md');

      // Act
      const result = await documentService.deleteDocument(documentId, false);

      // Assert
      expect(result).toBe(true);
      expect(mockFileStorageService.moveToArchive).toHaveBeenCalledWith('test.md');
      expect(mockDocument.status).toBe('archived');
    });

    test('should perform hard delete when permanent is true', async () => {
      // Arrange
      const documentId = 'test-doc-id';
      const mockDocument = new KnowledgeEntry({
        knowledge_id: documentId,
        knowledge_type: 'operation-procedure',
        title: 'Test Document',
        content: 'Content',
        source_file: 'test.md'
      });

      mockKnowledgeBaseService.getKnowledgeEntry.mockReturnValue(mockDocument);

      // Act
      const result = await documentService.deleteDocument(documentId, true);

      // Assert
      expect(result).toBe(true);
      expect(mockFileStorageService.deleteFile).toHaveBeenCalledWith('test.md');
      expect(mockKnowledgeBaseService.removeKnowledgeEntry).toHaveBeenCalledWith(documentId);
    });
  });

  describe('duplicateDocument', () => {
    test('should create a copy of existing document', async () => {
      // Arrange
      const originalId = 'original-doc-id';
      const newTitle = 'Copy of Original Document';
      const mockDocument = new KnowledgeEntry({
        knowledge_id: originalId,
        knowledge_type: 'operation-procedure',
        title: 'Original Document',
        content: '# Original Content',
        category: 'general'
      });

      mockKnowledgeBaseService.getKnowledgeEntry.mockReturnValue(mockDocument);
      mockFileStorageService.saveContentAsFile.mockResolvedValue('/path/to/copy.md');

      // Act
      const result = await documentService.duplicateDocument(originalId, newTitle);

      // Assert
      expect(result.title).toBe(newTitle);
      expect(result.content).toBe(mockDocument.content);
      expect(result.knowledge_id).not.toBe(originalId);
      expect(result.version_history).toHaveLength(0);
      expect(result.usage_count).toBe(0);
    });
  });

  describe('batchOperation', () => {
    test('should perform batch delete operation', async () => {
      // Arrange
      const documentIds = ['doc1', 'doc2', 'doc3'];
      const mockDocs = documentIds.map(id => new KnowledgeEntry({
        knowledge_id: id,
        knowledge_type: 'operation-procedure',
        title: `Document ${id}`,
        content: 'Content'
      }));

      mockKnowledgeBaseService.getKnowledgeEntry
        .mockReturnValueOnce(mockDocs[0])
        .mockReturnValueOnce(mockDocs[1])
        .mockReturnValueOnce(mockDocs[2]);

      // Act
      const result = await documentService.batchOperation('delete', documentIds);

      // Assert
      expect(result.success).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.total).toBe(3);
      expect(result.summary.success).toBe(3);
      expect(result.summary.failed).toBe(0);
    });

    test('should handle partial failures in batch operation', async () => {
      // Arrange
      const documentIds = ['doc1', 'non-existent', 'doc3'];
      const mockDoc1 = new KnowledgeEntry({
        knowledge_id: 'doc1',
        knowledge_type: 'operation-procedure',
        title: 'Document 1',
        content: 'Content'
      });
      const mockDoc3 = new KnowledgeEntry({
        knowledge_id: 'doc3',
        knowledge_type: 'operation-procedure',
        title: 'Document 3',
        content: 'Content'
      });

      mockKnowledgeBaseService.getKnowledgeEntry
        .mockReturnValueOnce(mockDoc1)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockDoc3);

      // Act
      const result = await documentService.batchOperation('delete', documentIds);

      // Assert
      expect(result.success).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].knowledgeId).toBe('non-existent');
    });
  });

  describe('extractMetadataFromMarkdown', () => {
    test('should extract YAML front matter', () => {
      // Arrange
      const content = `---
title: Test Document
category: network
keywords: test, network, troubleshooting
---

# Test Document

This is the content.`;

      // Act
      const metadata = documentService.extractMetadataFromMarkdown(content);

      // Assert
      expect(metadata.title).toBe('Test Document');
      expect(metadata.category).toBe('network');
      expect(metadata.keywords).toBeDefined();
    });

    test('should extract HTML comment metadata', () => {
      // Arrange
      const content = `<!-- metadata
{
  "category": "security",
  "priority": 5,
  "tags": ["security", "authentication"]
}
-->

# Security Guide

This is a security guide.`;

      // Act
      const metadata = documentService.extractMetadataFromMarkdown(content);

      // Assert
      expect(metadata.category).toBe('security');
      expect(metadata.priority).toBe(5);
      expect(metadata.tags).toEqual(['security', 'authentication']);
    });

    test('should auto-extract keywords from content', () => {
      // Arrange
      const content = `# Network Troubleshooting Guide

## Checking Network Connectivity

Use \`ping\` command to test connectivity.

### Advanced Diagnostics

Run network diagnostics tools.`;

      // Act
      const keywords = documentService.extractKeywordsFromContent(content);

      // Assert
      expect(keywords).toContain('network');
      expect(keywords).toContain('troubleshooting');
      expect(keywords).toContain('connectivity');
      expect(keywords).toContain('ping');
    });
  });

  describe('generateDocumentSummary', () => {
    test('should generate summary from content', () => {
      // Arrange
      const content = `# Network Configuration Guide

This guide explains how to configure network settings for optimal performance.

## Prerequisites

Before starting, ensure you have:
- Administrative access
- Network topology diagram
- Required IP addresses

## Configuration Steps

Follow these steps to configure the network.`;

      // Act
      const summary = documentService.generateDocumentSummary(content, 100);

      // Assert
      expect(summary).toBeDefined();
      expect(summary.length).toBeLessThanOrEqual(100);
      expect(summary).toContain('network');
      expect(summary).toContain('configuration');
    });

    test('should handle empty content', () => {
      // Arrange
      const content = '';

      // Act
      const summary = documentService.generateDocumentSummary(content);

      // Assert
      expect(summary).toBe('无摘要信息');
    });
  });
});