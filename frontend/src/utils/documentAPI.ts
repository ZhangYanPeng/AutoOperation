/**
 * 文档管理API服务层
 * 封装与后端API的交互逻辑
 */

import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 添加认证token（如果有）
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 添加请求ID用于追踪
    config.headers['X-Request-ID'] = generateRequestId();
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 统一错误处理
    const message = error.response?.data?.message || error.message || '请求失败';
    
    if (error.response?.status === 401) {
      // 未授权，清除token并跳转登录
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      // 权限不足
      throw new Error('权限不足，无法执行此操作');
    } else if (error.response?.status === 404) {
      // 资源不存在
      throw new Error('请求的资源不存在');
    } else if (error.response?.status >= 500) {
      // 服务器错误
      throw new Error('服务器内部错误，请稍后重试');
    }
    
    throw new Error(message);
  }
);

// 生成请求ID
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// 文档管理API接口
export const documentAPI = {
  // 获取文档列表
  async getDocuments(params: {
    page?: number;
    limit?: number;
    category?: string;
    knowledge_type?: string;
    status?: string;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  } = {}) {
    const response = await api.get('/documents/list', { params });
    return response.data;
  },

  // 获取单个文档
  async getDocument(id: string) {
    const response = await api.get(`/knowledge/${id}`);
    return response.data;
  },

  // 上传文档
  async uploadDocument(file: File, metadata: any) {
    const formData = new FormData();
    formData.append('file', file);
    
    // 添加元数据
    Object.keys(metadata).forEach(key => {
      if (Array.isArray(metadata[key])) {
        metadata[key].forEach((item: any) => {
          formData.append(`${key}[]`, item);
        });
      } else {
        formData.append(key, metadata[key]);
      }
    });

    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        // 可以在这里触发进度更新事件
        window.dispatchEvent(new CustomEvent('uploadProgress', {
          detail: { percentCompleted }
        }));
      }
    });
    
    return response.data;
  },

  // 更新文档
  async updateDocument(id: string, updates: any) {
    const response = await api.put(`/documents/${id}`, updates);
    return response.data;
  },

  // 删除文档
  async deleteDocument(id: string, permanent = false) {
    const response = await api.delete(`/documents/${id}`, {
      params: { permanent }
    });
    return response.data;
  },

  // 下载文档
  async downloadDocument(id: string): Promise<Blob> {
    const response = await api.get(`/documents/${id}/download`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // 复制文档
  async duplicateDocument(id: string, newTitle: string) {
    const response = await api.post(`/documents/${id}/duplicate`, {
      title: newTitle
    });
    return response.data;
  },

  // 移动文档
  async moveDocument(id: string, targetCategory: string) {
    const response = await api.post(`/documents/${id}/move`, {
      target_category: targetCategory
    });
    return response.data;
  },

  // 锁定/解锁文档
  async lockDocument(id: string, lock: boolean) {
    const response = await api.post(`/documents/${id}/lock`, {
      action: lock ? 'lock' : 'unlock',
      user: 'current_user' // 实际应用中应该从用户状态获取
    });
    return response.data;
  },

  // 获取文档版本历史
  async getVersionHistory(id: string) {
    const response = await api.get(`/documents/${id}/versions`);
    return response.data;
  },

  // 恢复文档版本
  async restoreVersion(id: string, versionIndex: number) {
    const response = await api.post(`/documents/${id}/versions/${versionIndex}/restore`);
    return response.data;
  },

  // 批量操作
  async batchOperation(operation: string, ids: string[], options: any = {}) {
    const response = await api.post('/documents/batch', {
      action: operation,
      ids,
      options
    });
    return response.data;
  },

  // 获取统计信息
  async getStats() {
    const response = await api.get('/documents/stats');
    return response.data;
  },

  // 清理临时文件
  async cleanupTempFiles(maxAge?: number) {
    const response = await api.post('/documents/cleanup', {
      maxAge
    });
    return response.data;
  }
};

// 知识库搜索API（复用现有的接口）
export const knowledgeAPI = {
  // 搜索知识库
  async search(params: {
    query: string;
    type?: string;
    category?: string;
    limit?: number;
    minScore?: number;
  }) {
    const response = await api.get('/knowledge/search', { params });
    return response.data;
  },

  // 获取知识条目详情
  async getKnowledgeEntry(id: string) {
    const response = await api.get(`/knowledge/${id}`);
    return response.data;
  },

  // 按分类获取知识条目
  async getByCategory(category: string, limit = 20) {
    const response = await api.get(`/knowledge/category/${category}`, {
      params: { limit }
    });
    return response.data;
  },

  // 获取推荐知识条目
  async getRecommendations(category?: string, limit = 5) {
    const url = category ? `/knowledge/recommendations/${category}` : '/knowledge/recommendations';
    const response = await api.get(url, { params: { limit } });
    return response.data;
  },

  // 更新有效性评分
  async updateEffectivenessScore(id: string, score: number) {
    const response = await api.post(`/knowledge/${id}/effectiveness`, { score });
    return response.data;
  },

  // 获取统计信息
  async getStatistics() {
    const response = await api.get('/knowledge/stats/overview');
    return response.data;
  },

  // 重新加载知识库
  async reloadKnowledgeBase() {
    const response = await api.post('/knowledge/reload');
    return response.data;
  }
};

// 文件上传工具函数
export const uploadUtils = {
  // 验证文件类型
  validateFileType(file: File): boolean {
    const allowedTypes = [
      'text/markdown',
      'text/plain',
      'application/octet-stream'
    ];
    const allowedExtensions = ['.md', '.markdown', '.txt'];
    
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    return allowedTypes.includes(file.type) || allowedExtensions.includes(extension);
  },

  // 验证文件大小
  validateFileSize(file: File, maxSizeMB = 5): boolean {
    const maxSize = maxSizeMB * 1024 * 1024;
    return file.size <= maxSize;
  },

  // 读取文件内容
  readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file, 'UTF-8');
    });
  },

  // 从文件内容提取标题
  extractTitleFromContent(content: string): string | null {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : null;
  },

  // 从文件内容提取元数据
  extractMetadataFromContent(content: string): any {
    const metadata: any = {};
    
    // 提取YAML front matter
    const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (yamlMatch) {
      const yamlContent = yamlMatch[1];
      const lines = yamlContent.split('\n');
      lines.forEach(line => {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const [, key, value] = match;
          metadata[key] = value.trim().replace(/^["']|["']$/g, '');
        }
      });
    }
    
    // 提取HTML注释中的元数据
    const commentMatch = content.match(/<!--\s*metadata\s*([\s\S]*?)\s*-->/);
    if (commentMatch) {
      try {
        const commentMetadata = JSON.parse(commentMatch[1]);
        Object.assign(metadata, commentMetadata);
      } catch (error) {
        console.warn('解析注释元数据失败:', error);
      }
    }
    
    return metadata;
  }
};

// 错误处理工具
export const errorUtils = {
  // 格式化错误信息
  formatError(error: any): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return '未知错误';
  },

  // 检查是否为网络错误
  isNetworkError(error: any): boolean {
    return !error.response && error.code === 'NETWORK_ERROR';
  },

  // 检查是否为超时错误
  isTimeoutError(error: any): boolean {
    return error.code === 'ECONNABORTED' || error.message?.includes('timeout');
  },

  // 重试逻辑
  async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (i === maxRetries) {
          break;
        }
        
        // 只对网络错误和超时错误进行重试
        if (!this.isNetworkError(error) && !this.isTimeoutError(error)) {
          break;
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
    
    throw lastError;
  }
};

export default {
  documentAPI,
  knowledgeAPI,
  uploadUtils,
  errorUtils
};