/**
 * 文档管理状态存储
 * 使用Zustand管理文档相关的状态和操作
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { toast } from 'react-hot-toast';
import { documentAPI } from '../utils/documentAPI';

interface Document {
  knowledge_id: string;
  title: string;
  content: string;
  category: string;
  knowledge_type: 'operation-procedure' | 'device-api';
  priority: number;
  status: 'draft' | 'published' | 'archived';
  tags: string[];
  keywords: string[];
  metadata: Record<string, any>;
  file_name: string;
  file_size: number;
  upload_time: string;
  uploader: string;
  created_at: string;
  last_updated: string;
  version: string;
  version_history: any[];
  usage_count: number;
  effectiveness_score: number;
  is_locked: boolean;
}

interface DocumentStats {
  total: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  recentUploads: number;
  totalSize: number;
}

interface DocumentStore {
  // 状态
  documents: Document[];
  categories: string[];
  selectedCategory: string;
  searchQuery: string;
  viewMode: 'grid' | 'list';
  loading: boolean;
  uploading: boolean;
  stats: DocumentStats | null;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
  
  // 文档操作
  loadDocuments: (page?: number, limit?: number) => Promise<void>;
  uploadDocument: (file: File, metadata: any) => Promise<void>;
  updateDocument: (id: string, updates: any) => Promise<void>;
  deleteDocument: (id: string, permanent?: boolean) => Promise<void>;
  downloadDocument: (id: string) => Promise<void>;
  duplicateDocument: (id: string, newTitle: string) => Promise<void>;
  moveDocument: (id: string, targetCategory: string) => Promise<void>;
  lockDocument: (id: string) => Promise<void>;
  unlockDocument: (id: string) => Promise<void>;
  
  // 批量操作
  batchOperation: (operation: string, ids: string[], options?: any) => Promise<void>;
  
  // 统计和搜索
  refreshStats: () => Promise<void>;
  searchDocuments: (query: string) => void;
  
  // UI状态
  setSelectedCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setLoading: (loading: boolean) => void;
}

export const useDocumentStore = create<DocumentStore>()(
  devtools(
    (set, get) => ({
      // 初始状态
      documents: [],
      categories: [
        'performance',
        'network', 
        'security',
        'maintenance',
        'database',
        'monitoring',
        'general'
      ],
      selectedCategory: '',
      searchQuery: '',
      viewMode: 'grid',
      loading: false,
      uploading: false,
      stats: null,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 20
      },

      // 加载文档列表
      loadDocuments: async (page = 1, limit = 20) => {
        set({ loading: true });
        
        try {
          const { selectedCategory, searchQuery } = get();
          const response = await documentAPI.getDocuments({
            page,
            limit,
            category: selectedCategory || undefined,
            search: searchQuery || undefined
          });
          
          set({ 
            documents: response.data.documents,
            pagination: response.data.pagination,
            loading: false
          });
        } catch (error) {
          console.error('加载文档失败:', error);
          toast.error('加载文档失败: ' + error.message);
          set({ loading: false });
        }
      },

      // 上传文档
      uploadDocument: async (file: File, metadata: any) => {
        set({ uploading: true });
        
        try {
          await documentAPI.uploadDocument(file, metadata);
          
          // 重新加载文档列表
          await get().loadDocuments();
          await get().refreshStats();
          
          set({ uploading: false });
        } catch (error) {
          console.error('上传文档失败:', error);
          set({ uploading: false });
          throw error;
        }
      },

      // 更新文档
      updateDocument: async (id: string, updates: any) => {
        try {
          await documentAPI.updateDocument(id, updates);
          
          // 更新本地状态
          set(state => ({
            documents: state.documents.map(doc => 
              doc.knowledge_id === id ? { ...doc, ...updates } : doc
            )
          }));
          
          await get().refreshStats();
        } catch (error) {
          console.error('更新文档失败:', error);
          throw error;
        }
      },

      // 删除文档
      deleteDocument: async (id: string, permanent = false) => {
        try {
          await documentAPI.deleteDocument(id, permanent);
          
          // 从本地状态移除
          set(state => ({
            documents: state.documents.filter(doc => doc.knowledge_id !== id)
          }));
          
          await get().refreshStats();
          toast.success(permanent ? '文档已永久删除' : '文档已移至回收站');
        } catch (error) {
          console.error('删除文档失败:', error);
          toast.error('删除失败: ' + error.message);
          throw error;
        }
      },

      // 下载文档
      downloadDocument: async (id: string) => {
        try {
          const blob = await documentAPI.downloadDocument(id);
          const document = get().documents.find(doc => doc.knowledge_id === id);
          const filename = document?.file_name || document?.title + '.md' || 'document.md';
          
          // 创建下载链接
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } catch (error) {
          console.error('下载文档失败:', error);
          throw error;
        }
      },

      // 复制文档
      duplicateDocument: async (id: string, newTitle: string) => {
        try {
          await documentAPI.duplicateDocument(id, newTitle);
          await get().loadDocuments();
          await get().refreshStats();
        } catch (error) {
          console.error('复制文档失败:', error);
          throw error;
        }
      },

      // 移动文档
      moveDocument: async (id: string, targetCategory: string) => {
        try {
          await documentAPI.moveDocument(id, targetCategory);
          
          // 更新本地状态
          set(state => ({
            documents: state.documents.map(doc => 
              doc.knowledge_id === id ? { ...doc, category: targetCategory } : doc
            )
          }));
          
          await get().refreshStats();
        } catch (error) {
          console.error('移动文档失败:', error);
          throw error;
        }
      },

      // 锁定文档
      lockDocument: async (id: string) => {
        try {
          await documentAPI.lockDocument(id, true);
          
          set(state => ({
            documents: state.documents.map(doc => 
              doc.knowledge_id === id ? { ...doc, is_locked: true } : doc
            )
          }));
        } catch (error) {
          console.error('锁定文档失败:', error);
          throw error;
        }
      },

      // 解锁文档
      unlockDocument: async (id: string) => {
        try {
          await documentAPI.lockDocument(id, false);
          
          set(state => ({
            documents: state.documents.map(doc => 
              doc.knowledge_id === id ? { ...doc, is_locked: false } : doc
            )
          }));
        } catch (error) {
          console.error('解锁文档失败:', error);
          throw error;
        }
      },

      // 批量操作
      batchOperation: async (operation: string, ids: string[], options = {}) => {
        try {
          await documentAPI.batchOperation(operation, ids, options);
          
          switch (operation) {
            case 'delete':
            case 'archive':
              // 重新加载文档列表
              await get().loadDocuments();
              break;
            case 'move':
              // 更新分类
              if (options.targetCategory) {
                set(state => ({
                  documents: state.documents.map(doc => 
                    ids.includes(doc.knowledge_id) 
                      ? { ...doc, category: options.targetCategory } 
                      : doc
                  )
                }));
              }
              break;
            case 'publish':
              // 更新状态
              set(state => ({
                documents: state.documents.map(doc => 
                  ids.includes(doc.knowledge_id) 
                    ? { ...doc, status: 'published' } 
                    : doc
                )
              }));
              break;
          }
          
          await get().refreshStats();
        } catch (error) {
          console.error('批量操作失败:', error);
          throw error;
        }
      },

      // 刷新统计信息
      refreshStats: async () => {
        try {
          const response = await documentAPI.getStats();
          set({ stats: response.data.documents });
        } catch (error) {
          console.error('获取统计信息失败:', error);
        }
      },

      // 搜索文档
      searchDocuments: (query: string) => {
        set({ searchQuery: query });
        // 自动触发搜索
        setTimeout(() => {
          get().loadDocuments();
        }, 300);
      },

      // UI状态设置
      setSelectedCategory: (category: string) => {
        set({ selectedCategory: category });
        get().loadDocuments();
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      setViewMode: (mode: 'grid' | 'list') => {
        set({ viewMode: mode });
        // 保存到本地存储
        localStorage.setItem('documentViewMode', mode);
      },

      setLoading: (loading: boolean) => {
        set({ loading });
      }
    }),
    {
      name: 'document-store',
      partialize: (state) => ({
        viewMode: state.viewMode,
        selectedCategory: state.selectedCategory
      })
    }
  )
);

// 初始化存储
export const initDocumentStore = () => {
  const store = useDocumentStore.getState();
  
  // 从本地存储恢复视图模式
  const savedViewMode = localStorage.getItem('documentViewMode') as 'grid' | 'list';
  if (savedViewMode) {
    store.setViewMode(savedViewMode);
  }
  
  // 初始加载
  store.loadDocuments();
  store.refreshStats();
};

export default useDocumentStore;