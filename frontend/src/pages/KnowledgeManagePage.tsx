/**
 * 知识库管理页面
 * 提供文档的上传、管理、编辑和删除功能
 */

import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  Search,
  Grid,
  List,
  Plus,
  Tag,
  Folder,
  RefreshCw
} from 'lucide-react';

const KnowledgeManagePage = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categories = [
    'performance',
    'network', 
    'security',
    'maintenance',
    'database',
    'monitoring',
    'general'
  ];

  useEffect(() => {
    // 加载文档列表
    setLoading(true);
    // TODO: 实际API调用
    setTimeout(() => {
      setDocuments([]);
      setLoading(false);
    }, 1000);
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* 页面标题和统计 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900">知识库管理</h1>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Plus size={20} />
            上传文档
          </button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">总文档数</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">本周新增</p>
                <p className="text-2xl font-bold text-green-600">0</p>
              </div>
              <Upload className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">总大小</p>
                <p className="text-2xl font-bold text-purple-600">0 MB</p>
              </div>
              <Folder className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">分类数</p>
                <p className="text-2xl font-bold text-orange-600">{categories.length}</p>
              </div>
              <Tag className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 搜索和过滤器 */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* 搜索框 */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="搜索文档标题、内容、关键词..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>

          {/* 分类选择 */}
          <div className="w-full md:w-48">
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="">所有分类</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* 视图切换 */}
          <div className="flex gap-2">
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
            className="p-2 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
            disabled={loading}
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 文档列表 */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="animate-spin h-8 w-8 text-blue-600" />
            <span className="ml-2 text-gray-600">加载中...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center p-8">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无文档</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || selectedCategory
                ? '没有找到符合条件的文档'
                : '还没有上传任何文档'}
            </p>
            {!searchQuery && !selectedCategory && (
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                上传第一个文档
              </button>
            )}
          </div>
        ) : (
          <div className="p-6">
            <div className="text-center text-gray-500">
              文档列表功能开发中...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeManagePage;