/**
 * 文件存储服务
 * 负责知识库文件的保存、移动、删除和管理
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FileStorageService {
  constructor(basePath = null) {
    this.basePath = basePath || path.join(__dirname, '../../../knowledge-base');
    this.uploadsPath = path.join(this.basePath, 'uploads');
    this.tempPath = path.join(this.uploadsPath, 'temp');
    this.archivedPath = path.join(this.basePath, 'archived');
    
    // 确保目录存在
    this.ensureDirectories();
  }

  /**
   * 确保必要的目录存在
   */
  async ensureDirectories() {
    try {
      const directories = [
        this.uploadsPath,
        this.tempPath,
        this.archivedPath,
        path.join(this.basePath, 'operation-procedures'),
        path.join(this.basePath, 'device-apis')
      ];

      for (const dir of directories) {
        try {
          await fs.access(dir);
        } catch {
          await fs.mkdir(dir, { recursive: true });
          logger.info(`创建目录: ${dir}`);
        }
      }
    } catch (error) {
      logger.error('创建目录失败:', error);
    }
  }

  /**
   * 保存文件
   */
  async saveFile(file, category = 'general', knowledgeType = 'operation-procedure') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileExtension = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, fileExtension);
      const safeFileName = this.sanitizeFileName(`${baseName}_${timestamp}${fileExtension}`);
      
      const targetDir = this.getTargetDirectory(category, knowledgeType);
      await this.ensureDirectoryExists(targetDir);
      
      const targetPath = path.join(targetDir, safeFileName);

      // 保存文件
      if (file.buffer) {
        await fs.writeFile(targetPath, file.buffer);
      } else if (file.path) {
        await fs.copyFile(file.path, targetPath);
        // 删除临时文件
        try {
          await fs.unlink(file.path);
        } catch (error) {
          logger.warn('删除临时文件失败:', error);
        }
      } else {
        throw new Error('文件数据不可用');
      }

      logger.info('文件保存成功', { 
        originalName: file.originalname,
        savedPath: targetPath,
        size: file.size 
      });

      return targetPath;
    } catch (error) {
      logger.error('文件保存失败:', error);
      throw error;
    }
  }

  /**
   * 保存内容为文件
   */
  async saveContentAsFile(content, category = 'general', knowledgeType = 'operation-procedure', filename = null) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeFileName = filename ? this.sanitizeFileName(filename) : 
                          `document_${timestamp}.md`;
      
      const targetDir = this.getTargetDirectory(category, knowledgeType);
      await this.ensureDirectoryExists(targetDir);
      
      const targetPath = path.join(targetDir, safeFileName);

      await fs.writeFile(targetPath, content, 'utf8');

      logger.info('内容保存为文件成功', { 
        filename: safeFileName,
        savedPath: targetPath,
        size: Buffer.byteLength(content, 'utf8')
      });

      return targetPath;
    } catch (error) {
      logger.error('内容保存为文件失败:', error);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(filename, category = null, knowledgeType = null) {
    try {
      let filePath;
      
      if (category && knowledgeType) {
        filePath = path.join(this.getTargetDirectory(category, knowledgeType), filename);
      } else {
        // 搜索文件位置
        filePath = await this.findFile(filename);
      }

      if (!filePath) {
        throw new Error(`文件不存在: ${filename}`);
      }

      await fs.unlink(filePath);
      
      logger.info('文件删除成功', { filePath });
      return true;
    } catch (error) {
      logger.error('文件删除失败:', error);
      throw error;
    }
  }

  /**
   * 移动文件到归档目录
   */
  async moveToArchive(filename, category = null, knowledgeType = null) {
    try {
      let sourcePath;
      
      if (category && knowledgeType) {
        sourcePath = path.join(this.getTargetDirectory(category, knowledgeType), filename);
      } else {
        sourcePath = await this.findFile(filename);
      }

      if (!sourcePath) {
        throw new Error(`文件不存在: ${filename}`);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivedFileName = `${timestamp}_${filename}`;
      const targetPath = path.join(this.archivedPath, archivedFileName);

      await this.ensureDirectoryExists(this.archivedPath);
      await fs.rename(sourcePath, targetPath);

      logger.info('文件归档成功', { 
        sourcePath,
        targetPath 
      });

      return targetPath;
    } catch (error) {
      logger.error('文件归档失败:', error);
      throw error;
    }
  }

  /**
   * 移动文件到不同分类
   */
  async moveFile(filename, oldCategory, newCategory, knowledgeType) {
    try {
      const oldDir = this.getTargetDirectory(oldCategory, knowledgeType);
      const newDir = this.getTargetDirectory(newCategory, knowledgeType);
      
      const sourcePath = path.join(oldDir, filename);
      const targetPath = path.join(newDir, filename);

      // 检查源文件是否存在
      try {
        await fs.access(sourcePath);
      } catch {
        throw new Error(`源文件不存在: ${sourcePath}`);
      }

      // 确保目标目录存在
      await this.ensureDirectoryExists(newDir);

      // 检查目标文件是否已存在
      try {
        await fs.access(targetPath);
        throw new Error(`目标文件已存在: ${targetPath}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      await fs.rename(sourcePath, targetPath);

      logger.info('文件移动成功', { 
        sourcePath,
        targetPath,
        oldCategory,
        newCategory 
      });

      return targetPath;
    } catch (error) {
      logger.error('文件移动失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(filename, category = null, knowledgeType = null) {
    try {
      let filePath;
      
      if (category && knowledgeType) {
        filePath = path.join(this.getTargetDirectory(category, knowledgeType), filename);
      } else {
        filePath = await this.findFile(filename);
      }

      if (!filePath) {
        throw new Error(`文件不存在: ${filename}`);
      }

      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');

      return {
        filename,
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isFile: stats.isFile(),
        content: content,
        contentLength: Buffer.byteLength(content, 'utf8')
      };
    } catch (error) {
      logger.error('获取文件信息失败:', error);
      throw error;
    }
  }

  /**
   * 创建文件备份
   */
  async createBackup(filename, category = null, knowledgeType = null) {
    try {
      let filePath;
      
      if (category && knowledgeType) {
        filePath = path.join(this.getTargetDirectory(category, knowledgeType), filename);
      } else {
        filePath = await this.findFile(filename);
      }

      if (!filePath) {
        throw new Error(`文件不存在: ${filename}`);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(this.basePath, 'backups');
      await this.ensureDirectoryExists(backupDir);
      
      const backupFileName = `${timestamp}_${filename}`;
      const backupPath = path.join(backupDir, backupFileName);

      await fs.copyFile(filePath, backupPath);

      logger.info('文件备份成功', { 
        originalPath: filePath,
        backupPath 
      });

      return backupPath;
    } catch (error) {
      logger.error('文件备份失败:', error);
      throw error;
    }
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles(maxAge = 24 * 60 * 60 * 1000) { // 默认24小时
    try {
      const tempFiles = await fs.readdir(this.tempPath);
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of tempFiles) {
        const filePath = path.join(this.tempPath, file);
        try {
          const stats = await fs.stat(filePath);
          const age = now - stats.mtime.getTime();
          
          if (age > maxAge) {
            await fs.unlink(filePath);
            cleanedCount++;
          }
        } catch (error) {
          logger.warn(`清理临时文件失败: ${file}`, error);
        }
      }

      logger.info(`临时文件清理完成，删除了 ${cleanedCount} 个文件`);
      return cleanedCount;
    } catch (error) {
      logger.error('临时文件清理失败:', error);
      throw error;
    }
  }

  /**
   * 获取目录使用情况统计
   */
  async getStorageStatistics() {
    try {
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        byType: {},
        byCategory: {},
        tempFiles: 0,
        tempSize: 0,
        archivedFiles: 0,
        archivedSize: 0
      };

      // 统计主目录
      await this.calculateDirectoryStats(this.basePath, stats, '');

      // 统计临时文件
      const tempStats = await this.calculateDirectorySize(this.tempPath);
      stats.tempFiles = tempStats.fileCount;
      stats.tempSize = tempStats.totalSize;

      // 统计归档文件
      const archivedStats = await this.calculateDirectorySize(this.archivedPath);
      stats.archivedFiles = archivedStats.fileCount;
      stats.archivedSize = archivedStats.totalSize;

      return stats;
    } catch (error) {
      logger.error('获取存储统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件路径
   */
  getFilePath(filename, category, knowledgeType) {
    return path.join(this.getTargetDirectory(category, knowledgeType), filename);
  }

  /**
   * 获取目标目录
   */
  getTargetDirectory(category, knowledgeType) {
    const typeDir = knowledgeType === 'device-api' ? 'device-apis' : 'operation-procedures';
    return category ? path.join(this.basePath, typeDir, category) : 
                     path.join(this.basePath, typeDir);
  }

  /**
   * 净化文件名
   */
  sanitizeFileName(filename) {
    return filename
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 255);
  }

  /**
   * 确保目录存在
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 查找文件
   */
  async findFile(filename) {
    const searchDirs = [
      path.join(this.basePath, 'operation-procedures'),
      path.join(this.basePath, 'device-apis'),
      this.uploadsPath,
      this.archivedPath
    ];

    for (const dir of searchDirs) {
      try {
        const result = await this.searchInDirectory(dir, filename);
        if (result) return result;
      } catch (error) {
        // 忽略目录不存在的错误
        if (error.code !== 'ENOENT') {
          logger.warn(`搜索目录失败: ${dir}`, error);
        }
      }
    }

    return null;
  }

  /**
   * 在目录中搜索文件
   */
  async searchInDirectory(dirPath, filename) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isFile() && entry.name === filename) {
          return fullPath;
        } else if (entry.isDirectory()) {
          const result = await this.searchInDirectory(fullPath, filename);
          if (result) return result;
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    
    return null;
  }

  /**
   * 计算目录大小
   */
  async calculateDirectorySize(dirPath) {
    let totalSize = 0;
    let fileCount = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
          fileCount++;
        } else if (entry.isDirectory()) {
          const subStats = await this.calculateDirectorySize(fullPath);
          totalSize += subStats.totalSize;
          fileCount += subStats.fileCount;
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn(`计算目录大小失败: ${dirPath}`, error);
      }
    }

    return { totalSize, fileCount };
  }

  /**
   * 计算目录统计信息
   */
  async calculateDirectoryStats(dirPath, stats, prefix) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const fileStats = await fs.stat(fullPath);
          stats.totalFiles++;
          stats.totalSize += fileStats.size;
          
          // 按类型分类
          const pathParts = relativePath.split('/');
          if (pathParts.length > 1) {
            const type = pathParts[0];
            if (!stats.byType[type]) {
              stats.byType[type] = { files: 0, size: 0 };
            }
            stats.byType[type].files++;
            stats.byType[type].size += fileStats.size;
            
            // 按分类统计
            if (pathParts.length > 2) {
              const category = pathParts[1];
              if (!stats.byCategory[category]) {
                stats.byCategory[category] = { files: 0, size: 0 };
              }
              stats.byCategory[category].files++;
              stats.byCategory[category].size += fileStats.size;
            }
          }
        } else if (entry.isDirectory() && !['uploads', 'archived', 'backups'].includes(entry.name)) {
          await this.calculateDirectoryStats(fullPath, stats, relativePath);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn(`计算目录统计失败: ${dirPath}`, error);
      }
    }
  }
}

export default FileStorageService;