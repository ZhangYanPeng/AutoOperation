/**
 * 知识库管理页面
 * 提供分离式的两类知识库管理：运维处置知识库和设备API知识库
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
  RefreshCw,
  Settings,
  Database,
  Wrench,
  BarChart3
} from 'lucide-react';
import CategoryManagement from '../components/CategoryManagement';

type KnowledgeType = 'operation-procedure' | 'device-api';
type ViewMode = 'grid' | 'list';
type ActiveTab = 'overview' | 'operation-procedure' | 'device-api' | 'categories';

const KnowledgeManagePage = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [stats, setStats] = useState({
    total_entries: 0,
    by_type: {
      'operation-procedure': 0,
      'device-api': 0
    },
    total_categories: 0
  });

  const tabs = [
    {
      key: 'overview' as ActiveTab,
      label: '概览',
      icon: BarChart3,
      description: '知识库整体统计和概览'
    },
    {
      key: 'operation-procedure' as ActiveTab,
      label: '故障处置知识库',
      icon: Wrench,
      description: '运维故障处置流程管理'
    },
    {
      key: 'device-api' as ActiveTab,
      label: '设备API知识库',
      icon: Database,
      description: '设备接口文档管理'
    },
    {
      key: 'categories' as ActiveTab,
      label: '分类管理',
      icon: Folder,
      description: '知识库分类体系管理'
    }
  ];

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      const response = await fetch('/api/v1/knowledge/stats/overview');
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('加载统计信息失败:', error);
    }
  };

  const handleCategoryChange = () => {
    // 分类变更后重新加载统计信息
    loadStatistics();
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">总知识条目</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total_entries}</p>
            </div>
            <FileText className="h-12 w-12 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">故障处置知识</p>
              <p className="text-3xl font-bold text-green-600">
                {stats.by_type['operation-procedure'] || 0}
              </p>
            </div>
            <Wrench className="h-12 w-12 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">设备API文档</p>
              <p className="text-3xl font-bold text-purple-600">
                {stats.by_type['device-api'] || 0}
              </p>
            </div>
            <Database className="h-12 w-12 text-purple-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">分类数量</p>
              <p className="text-3xl font-bold text-orange-600">{stats.total_categories}</p>
            </div>
            <Tag className="h-12 w-12 text-orange-600" />
          </div>
        </div>
      </div>

      {/* 快速操作 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => setActiveTab('operation-procedure')}
            className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <Wrench className="h-8 w-8 text-green-600 mb-2" />
            <div className="font-medium text-gray-900">管理故障处置知识</div>
            <div className="text-sm text-gray-600">添加和编辑故障处置流程</div>
          </button>

          <button
            onClick={() => setActiveTab('device-api')}
            className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <Database className="h-8 w-8 text-purple-600 mb-2" />
            <div className="font-medium text-gray-900">管理设备API文档</div>
            <div className="text-sm text-gray-600">管理设备接口和集成文档</div>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <Folder className="h-8 w-8 text-orange-600 mb-2" />
            <div className="font-medium text-gray-900">分类管理</div>
            <div className="text-sm text-gray-600">管理知识库分类体系</div>
          </button>

          <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <Upload className="h-8 w-8 text-blue-600 mb-2" />
            <div className="font-medium text-gray-900">批量导入</div>
            <div className="text-sm text-gray-600">批量导入知识文档</div>
          </button>
        </div>
      </div>
    </div>
  );

  const renderKnowledgeManagement = (knowledgeType: KnowledgeType) => {
    const typeConfig = {
      'operation-procedure': {
        title: '故障处置知识库管理',
        description: '管理运维故障处置流程和解决方案',
        icon: Wrench,
        color: 'green'
      },
      'device-api': {
        title: '设备API知识库管理',
        description: '管理设备接口文档和集成规范',
        icon: Database,
        color: 'purple'
      }
    };

    const config = typeConfig[knowledgeType];
    const IconComponent = config.icon;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <IconComponent className={`h-8 w-8 text-${config.color}-600`} />
            <div>
              <h2 className="text-xl font-bold text-gray-900">{config.title}</h2>
              <p className="text-gray-600">{config.description}</p>
            </div>
          </div>

          {/* 搜索和过滤器 */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="搜索知识文档..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className={`bg-${config.color}-600 text-white px-4 py-2 rounded-lg hover:bg-${config.color}-700 transition-colors flex items-center gap-2`}
              >
                <Plus size={20} />
                新建文档
              </button>
              
              <button
                className="p-2 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                disabled={loading}
              >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* 文档列表 */}
          <div className="text-center p-8">
            <IconComponent className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">功能开发中</h3>
            <p className="text-gray-600">
              {knowledgeType === 'operation-procedure' 
                ? '故障处置知识管理功能正在开发中...'
                : '设备API文档管理功能正在开发中...'
              }
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderCategoryManagement = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryManagement 
          knowledgeType="operation-procedure" 
          onCategoryChange={handleCategoryChange}
        />
        <CategoryManagement 
          knowledgeType="device-api"
          onCategoryChange={handleCategoryChange}
        />
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'operation-procedure':
        return renderKnowledgeManagement('operation-procedure');
      case 'device-api':
        return renderKnowledgeManagement('device-api');
      case 'categories':
        return renderCategoryManagement();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">知识库管理中心</h1>
        <p className="text-gray-600 mt-2">统一管理运维处置知识库和设备API知识库</p>
      </div>

      {/* 标签页导航 */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <IconComponent 
                    className={`mr-2 h-5 w-5 ${
                      activeTab === tab.key
                        ? 'text-blue-500'
                        : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                  />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* 内容区域 */}
      {renderContent()}
    </div>
  );
};

export default KnowledgeManagePage;