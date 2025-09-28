/**
 * 验证服务单元测试
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ValidationService } from '../src/services/ValidationService.js';
import fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises');

describe('ValidationService', () => {
  let validationService;

  beforeEach(() => {
    validationService = new ValidationService();
    vi.clearAllMocks();
  });

  describe('validateFile', () => {
    test('should validate a correct markdown file', async () => {
      // Arrange
      const mockFile = {
        originalname: 'test-document.md',
        size: 1024,
        mimetype: 'text/markdown',
        buffer: Buffer.from('# Test Document\n\nThis is a test document.')
      };

      // Act
      const result = await validationService.validateFile(mockFile);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject file with invalid extension', async () => {
      // Arrange
      const mockFile = {
        originalname: 'test-document.pdf',
        size: 1024,
        mimetype: 'application/pdf',
        buffer: Buffer.from('PDF content')
      };

      // Act
      const result = await validationService.validateFile(mockFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('不支持的文件类型: .pdf。支持的格式: .md, .markdown, .txt');
    });

    test('should reject oversized file', async () => {
      // Arrange
      const mockFile = {
        originalname: 'large-document.md',
        size: 6 * 1024 * 1024, // 6MB
        mimetype: 'text/markdown',
        buffer: Buffer.alloc(6 * 1024 * 1024)
      };

      // Act
      const result = await validationService.validateFile(mockFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('文件大小超过限制，最大允许5.0MB');
    });

    test('should reject empty file', async () => {
      // Arrange
      const mockFile = {
        originalname: 'empty-document.md',
        size: 0,
        mimetype: 'text/markdown',
        buffer: Buffer.from('')
      };

      // Act
      const result = await validationService.validateFile(mockFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('文件不能为空');
    });
  });

  describe('validateFilename', () => {
    test('should validate correct filename', () => {
      // Act
      const result = validationService.validateFilename('valid-document.md');

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject filename with dangerous characters', () => {
      // Act
      const result = validationService.validateFilename('bad<file>name.md');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('文件名包含非法字符');
    });

    test('should reject overly long filename', () => {
      // Arrange
      const longFilename = 'a'.repeat(250) + '.md';

      // Act
      const result = validationService.validateFilename(longFilename);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('文件名过长，最大长度为255个字符');
    });

    test('should reject reserved filename', () => {
      // Act
      const result = validationService.validateFilename('CON.md');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('文件名不能使用系统保留名称');
    });
  });

  describe('validateFileSize', () => {
    test('should validate correct file size', () => {
      // Act
      const result = validationService.validateFileSize(1024);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject oversized file', () => {
      // Act
      const result = validationService.validateFileSize(6 * 1024 * 1024);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('文件大小超过限制，最大允许5.0MB');
    });

    test('should reject invalid size', () => {
      // Act
      const result = validationService.validateFileSize(-1);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('无效的文件大小');
    });
  });

  describe('validateMarkdownStructure', () => {
    test('should validate well-formed markdown', () => {
      // Arrange
      const content = `# Title

## Section 1

This is a paragraph.

\`\`\`javascript
console.log('code block');
\`\`\`

[Link](http://example.com)

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |`;

      // Act
      const result = validationService.validateMarkdownStructure(content);

      // Assert
      expect(result.isValid).toBe(true);
    });

    test('should detect unclosed code blocks', () => {
      // Arrange
      const content = `# Title

\`\`\`javascript
console.log('unclosed code block');

More content here.`;

      // Act
      const result = validationService.validateMarkdownStructure(content);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('代码块未正确闭合，请检查 ``` 标记');
    });

    test('should warn about empty links', () => {
      // Arrange
      const content = `# Title

[Empty link]()

More content.`;

      // Act
      const result = validationService.validateMarkdownStructure(content);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('发现空链接，请检查链接格式');
    });

    test('should warn about missing title', () => {
      // Arrange
      const content = `This document has no title.

Just some content.`;

      // Act
      const result = validationService.validateMarkdownStructure(content);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('建议添加标题（# 标题）');
    });
  });

  describe('checkMaliciousContent', () => {
    test('should pass clean content', () => {
      // Arrange
      const content = `# Safe Document

This is a safe document with no malicious content.

\`\`\`bash
ls -la
\`\`\``;

      // Act
      const result = validationService.checkMaliciousContent(content);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect script tags', () => {
      // Arrange
      const content = `# Document

<script>alert('malicious');</script>

Some content.`;

      // Act
      const result = validationService.checkMaliciousContent(content);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('文档包含可能的恶意脚本内容');
    });

    test('should detect iframe tags', () => {
      // Arrange
      const content = `# Document

<iframe src="http://malicious.com"></iframe>

Some content.`;

      // Act
      const result = validationService.checkMaliciousContent(content);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('文档包含可能的恶意脚本内容');
    });

    test('should detect SQL injection patterns', () => {
      // Arrange
      const content = `# Database Guide

SELECT * FROM users WHERE id = 1 OR 1=1;

This is suspicious.`;

      // Act
      const result = validationService.checkMaliciousContent(content);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('文档包含可能的SQL注入模式');
    });

    test('should detect excessive repetition', () => {
      // Arrange
      const spamContent = 'spam content '.repeat(10);
      const content = `# Document

${spamContent}

End of document.`;

      // Act
      const result = validationService.checkMaliciousContent(content);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('文档包含大量重复内容，可能是垃圾内容');
    });
  });

  describe('validateMetadata', () => {
    test('should validate complete metadata', () => {
      // Arrange
      const metadata = {
        title: 'Test Document',
        knowledge_type: 'operation-procedure',
        category: 'network',
        priority: 5,
        tags: ['test', 'network'],
        keywords: ['network', 'troubleshooting']
      };

      // Act
      const result = validationService.validateMetadata(metadata);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject missing required fields', () => {
      // Arrange
      const metadata = {
        category: 'network'
        // Missing title and knowledge_type
      };

      // Act
      const result = validationService.validateMetadata(metadata);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('缺少必需字段: title');
      expect(result.errors).toContain('缺少必需字段: knowledge_type');
    });

    test('should reject invalid knowledge type', () => {
      // Arrange
      const metadata = {
        title: 'Test Document',
        knowledge_type: 'invalid-type'
      };

      // Act
      const result = validationService.validateMetadata(metadata);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('无效的知识类型: invalid-type');
    });

    test('should reject invalid priority', () => {
      // Arrange
      const metadata = {
        title: 'Test Document',
        knowledge_type: 'operation-procedure',
        priority: 15 // Invalid: should be 0-10
      };

      // Act
      const result = validationService.validateMetadata(metadata);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('优先级必须是0-10之间的数字');
    });

    test('should reject too many tags', () => {
      // Arrange
      const metadata = {
        title: 'Test Document',
        knowledge_type: 'operation-procedure',
        tags: Array(25).fill('tag') // Too many tags
      };

      // Act
      const result = validationService.validateMetadata(metadata);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('标签数量不能超过20个');
    });

    test('should reject oversized tags', () => {
      // Arrange
      const metadata = {
        title: 'Test Document',
        knowledge_type: 'operation-procedure',
        tags: ['a'.repeat(100)] // Tag too long
      };

      // Act
      const result = validationService.validateMetadata(metadata);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('标签必须是字符串且长度不超过50个字符');
    });
  });

  describe('sanitizeContent', () => {
    test('should remove dangerous scripts', () => {
      // Arrange
      const content = `# Document

<script>alert('dangerous');</script>

Normal content here.

<iframe src="http://bad.com"></iframe>`;

      // Act
      const sanitized = validationService.sanitizeContent(content);

      // Assert
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<iframe>');
      expect(sanitized).toContain('# Document');
      expect(sanitized).toContain('Normal content here.');
    });

    test('should clean control characters', () => {
      // Arrange
      const content = `Document\x00with\x01control\x02characters`;

      // Act
      const sanitized = validationService.sanitizeContent(content);

      // Assert
      expect(sanitized).toBe('Documentwithcontrolcharacters');
    });

    test('should limit consecutive newlines', () => {
      // Arrange
      const content = `Title





Too many newlines`;

      // Act
      const sanitized = validationService.sanitizeContent(content);

      // Assert
      expect(sanitized).toBe('Title\n\n\nToo many newlines');
    });

    test('should remove trailing spaces', () => {
      // Arrange
      const content = `Line with trailing spaces   \nAnother line   `;

      // Act
      const sanitized = validationService.sanitizeContent(content);

      // Assert
      expect(sanitized).toBe('Line with trailing spaces\nAnother line');
    });
  });

  describe('extractKeywordsAutomatically', () => {
    test('should extract keywords from headers', () => {
      // Arrange
      const content = `# Network Troubleshooting Guide

## Connectivity Issues

### DNS Resolution Problems`;

      // Act
      const keywords = validationService.extractKeywordsAutomatically(content);

      // Assert
      expect(keywords).toContain('network');
      expect(keywords).toContain('troubleshooting');
      expect(keywords).toContain('connectivity');
      expect(keywords).toContain('dns');
      expect(keywords).toContain('resolution');
    });

    test('should extract keywords from code blocks', () => {
      // Arrange
      const content = `# Guide

Use the \`ping\` command:

\`tcpdump\` and \`netstat\` are useful tools.`;

      // Act
      const keywords = validationService.extractKeywordsAutomatically(content);

      // Assert
      expect(keywords).toContain('ping');
      expect(keywords).toContain('tcpdump');
      expect(keywords).toContain('netstat');
    });

    test('should extract keywords from bold text', () => {
      // Arrange
      const content = `# Guide

**Important**: Use **firewall** rules for **security**.`;

      // Act
      const keywords = validationService.extractKeywordsAutomatically(content);

      // Assert
      expect(keywords).toContain('important');
      expect(keywords).toContain('firewall');
      expect(keywords).toContain('security');
    });

    test('should limit keyword count', () => {
      // Arrange
      const content = `# Guide

${Array(50).fill(0).map((_, i) => `**keyword${i}**`).join(' ')}`;

      // Act
      const keywords = validationService.extractKeywordsAutomatically(content);

      // Assert
      expect(keywords.length).toBeLessThanOrEqual(20);
    });

    test('should handle empty content', () => {
      // Act
      const keywords = validationService.extractKeywordsAutomatically('');

      // Assert
      expect(keywords).toEqual([]);
    });
  });

  describe('validateBatchOperation', () => {
    test('should validate correct batch operation', () => {
      // Arrange
      const operation = 'delete';
      const ids = ['doc1', 'doc2', 'doc3'];

      // Act
      const result = validationService.validateBatchOperation(operation, ids);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid operation', () => {
      // Arrange
      const operation = 'invalid';
      const ids = ['doc1'];

      // Act
      const result = validationService.validateBatchOperation(operation, ids);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('无效的批量操作类型: invalid');
    });

    test('should reject empty ID array', () => {
      // Arrange
      const operation = 'delete';
      const ids = [];

      // Act
      const result = validationService.validateBatchOperation(operation, ids);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('知识条目ID数组不能为空');
    });

    test('should reject too many IDs', () => {
      // Arrange
      const operation = 'delete';
      const ids = Array(150).fill(0).map((_, i) => `doc${i}`);

      // Act
      const result = validationService.validateBatchOperation(operation, ids);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('单次批量操作不能超过100个条目');
    });

    test('should require target category for move operation', () => {
      // Arrange
      const operation = 'move';
      const ids = ['doc1'];
      const options = {}; // Missing targetCategory

      // Act
      const result = validationService.validateBatchOperation(operation, ids, options);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('移动操作需要指定目标分类');
    });

    test('should accept move operation with target category', () => {
      // Arrange
      const operation = 'move';
      const ids = ['doc1'];
      const options = { targetCategory: 'network' };

      // Act
      const result = validationService.validateBatchOperation(operation, ids, options);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});