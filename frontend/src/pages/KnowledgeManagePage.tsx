/**
 * 知识库管理页面
 * 提供文档的上传、管理、编辑和删除功能
 */

import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  Search,
  Filter,
  Grid,
  List,
  Plus,
  Settings,
  Download,
  Edit,
  Trash2,
  Eye,
  Clock,
  Tag,
  Folder,
  Users,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDocumentStore } from '../stores/documentStore';
import DocumentUpload from '../components/DocumentUpload';
import DocumentEditor from '../components/DocumentEditor';
import DocumentList from '../components/DocumentList';
import DocumentPreview from '../components/DocumentPreview';

const KnowledgeManagePage = () => {
  const {
    documents,
    categories,
    selectedCategory,
    searchQuery,
    viewMode,
    loading,
    stats,
    loadDocuments,
    setSelectedCategory,
    setSearchQuery,
    setViewMode,
    refreshStats
  } = useDocumentStore();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    knowledge_type: '',
    uploader: ''
  });

  useEffect(() => {
    loadDocuments();
    refreshStats();
  }, []);

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
  };

  const handleViewDocument = (document) => {
    setSelectedDocument(document);
    setShowPreviewModal(true);
  };

  const handleEditDocument = (document) => {
    setSelectedDocument(document);
    setShowEditorModal(true);
  };

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    loadDocuments();
    refreshStats();
    toast.success('文档上传成功');
  };

  const handleUpdateSuccess = () => {
    setShowEditorModal(false);
    setSelectedDocument(null);
    loadDocuments();
    toast.success('文档更新成功');
  };

  const filteredDocuments = documents.filter(doc => {
    if (selectedCategory && doc.category !== selectedCategory) return false;
    if (filters.status && doc.status !== filters.status) return false;
    if (filters.knowledge_type && doc.knowledge_type !== filters.knowledge_type) return false;
    if (filters.uploader && doc.uploader !== filters.uploader) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        doc.title.toLowerCase().includes(query) ||
        doc.content.toLowerCase().includes(query) ||
        doc.keywords.some(keyword => keyword.toLowerCase().includes(query)) ||
        doc.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    return true;
  });

  return (
    <div className=\"p-6 bg-gray-50 min-h-screen\">
      {/* 页面标题和统计 */}
      <div className=\"mb-8\">
        <div className=\"flex items-center justify-between mb-4\">
          <h1 className=\"text-3xl font-bold text-gray-900\">知识库管理</h1>
          <button
            onClick={() => setShowUploadModal(true)}
            className=\"bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2\"
          >
            <Plus size={20} />
            上传文档
          </button>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className=\"grid grid-cols-1 md:grid-cols-4 gap-4 mb-6\">
            <div className=\"bg-white p-4 rounded-lg shadow\">
              <div className=\"flex items-center justify-between\">
                <div>
                  <p className=\"text-sm text-gray-600\">总文档数</p>
                  <p className=\"text-2xl font-bold text-gray-900\">{stats.total}</p>
                </div>
                <FileText className=\"h-8 w-8 text-blue-600\" />
              </div>
            </div>

            <div className=\"bg-white p-4 rounded-lg shadow\">
              <div className=\"flex items-center justify-between\">
                <div>
                  <p className=\"text-sm text-gray-600\">本周新增</p>
                  <p className=\"text-2xl font-bold text-green-600\">{stats.recentUploads}</p>
                </div>
                <Upload className=\"h-8 w-8 text-green-600\" />
              </div>
            </div>

            <div className=\"bg-white p-4 rounded-lg shadow\">
              <div className=\"flex items-center justify-between\">
                <div>
                  <p className=\"text-sm text-gray-600\">总大小</p>
                  <p className=\"text-2xl font-bold text-purple-600\">
                    {(stats.totalSize / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <Folder className=\"h-8 w-8 text-purple-600\" />
              </div>
            </div>

            <div className=\"bg-white p-4 rounded-lg shadow\">
              <div className=\"flex items-center justify-between\">
                <div>
                  <p className=\"text-sm text-gray-600\">分类数</p>
                  <p className=\"text-2xl font-bold text-orange-600\">
                    {Object.keys(stats.byCategory || {}).length}
                  </p>
                </div>
                <Tag className=\"h-8 w-8 text-orange-600\" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 搜索和过滤器 */}
      <div className=\"bg-white p-6 rounded-lg shadow mb-6\">
        <div className=\"flex flex-col md:flex-row gap-4\">
          {/* 搜索框 */}
          <div className=\"flex-1\">
            <div className=\"relative\">
              <Search className=\"absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400\" size={20} />
              <input
                type=\"text\"
                placeholder=\"搜索文档标题、内容、关键词...\"
                className=\"w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent\"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>

          {/* 分类选择 */}
          <div className=\"w-full md:w-48\">
            <select
              className=\"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent\"
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value=\"\">所有分类</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* 状态过滤 */}
          <div className=\"w-full md:w-32\">
            <select
              className=\"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent\"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value=\"\">所有状态</option>
              <option value=\"published\">已发布</option>
              <option value=\"draft\">草稿</option>
              <option value=\"archived\">已归档</option>
            </select>
          </div>

          {/* 类型过滤 */}
          <div className=\"w-full md:w-40\">
            <select
              className=\"w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent\"
              value={filters.knowledge_type}
              onChange={(e) => setFilters({ ...filters, knowledge_type: e.target.value })}
            >
              <option value=\"\">所有类型</option>
              <option value=\"operation-procedure\">操作规程</option>
              <option value=\"device-api\">设备API</option>
            </select>
          </div>

          {/* 视图切换 */}
          <div className=\"flex gap-2\">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              <Grid size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              <List size={20} />
            </button>
          </div>

          {/* 刷新按钮 */}
          <button
            onClick={() => {
              loadDocuments();
              refreshStats();
            }}
            className=\"p-2 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors\"
            disabled={loading}
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 文档列表 */}
      <div className=\"bg-white rounded-lg shadow\">
        {loading ? (
          <div className=\"flex items-center justify-center p-8\">
            <RefreshCw className=\"animate-spin h-8 w-8 text-blue-600\" />
            <span className=\"ml-2 text-gray-600\">加载中...</span>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className=\"text-center p-8\">
            <FileText className=\"h-16 w-16 text-gray-400 mx-auto mb-4\" />
            <h3 className=\"text-lg font-medium text-gray-900 mb-2\">暂无文档</h3>
            <p className=\"text-gray-600 mb-4\">
              {searchQuery || selectedCategory || filters.status || filters.knowledge_type
                ? '没有找到符合条件的文档'
                : '还没有上传任何文档'}
            </p>
            {!searchQuery && !selectedCategory && !filters.status && !filters.knowledge_type && (
              <button
                onClick={() => setShowUploadModal(true)}
                className=\"bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors\"
              >
                上传第一个文档
              </button>
            )}
          </div>
        ) : (
          <DocumentList
            documents={filteredDocuments}
            viewMode={viewMode}
            onView={handleViewDocument}
            onEdit={handleEditDocument}
          />
        )}
      </div>

      {/* 上传模态框 */}
      {showUploadModal && (
        <DocumentUpload
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleUploadSuccess}
        />
      )}

      {/* 编辑模态框 */}
      {showEditorModal && selectedDocument && (
        <DocumentEditor
          document={selectedDocument}
          onClose={() => {
            setShowEditorModal(false);
            setSelectedDocument(null);
          }}
          onSuccess={handleUpdateSuccess}
        />
      )}

      {/* 预览模态框 */}
      {showPreviewModal && selectedDocument && (
        <DocumentPreview
          document={selectedDocument}
          onClose={() => {
            setShowPreviewModal(false);
            setSelectedDocument(null);
          }}
          onEdit={() => {
            setShowPreviewModal(false);
            setShowEditorModal(true);
          }}
        />
      )}
    </div>
  );
};

export default KnowledgeManagePage;