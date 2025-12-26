/**
 * 文档预览组件
 * 提供文档内容的只读预览功能
 */

import React from 'react';
import MDEditor from '@uiw/react-md-editor';
import {
  X,
  Edit,
  Download,
  Share2,
  Clock,
  User,
  Tag,
  Folder,
  Eye,
  Star,
  Copy,
  ExternalLink
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDocumentStore } from '../stores/documentStore';

const DocumentPreview = ({ document, onClose, onEdit }) => {
  const { downloadDocument } = useDocumentStore();

  const handleDownload = async () => {
    try {
      await downloadDocument(document.knowledge_id);
      toast.success('文档下载成功');
    } catch (error) {
      toast.error('下载失败: ' + error.message);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/documents/${document.knowledge_id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('文档链接已复制到剪贴板');
    }).catch(() => {
      toast.error('复制链接失败');
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'published':
        return '已发布';
      case 'draft':
        return '草稿';
      case 'archived':
        return '已归档';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority) => {
    if (priority >= 8) return 'bg-red-100 text-red-800';
    if (priority >= 5) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getPriorityText = (priority) => {
    if (priority >= 8) return '高优先级';
    if (priority >= 5) return '中优先级';
    return '低优先级';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-5xl h-[90vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b bg-gray-50">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{document.title}</h1>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(document.status)}`}>
                {getStatusText(document.status)}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(document.priority)}`}>
                {getPriorityText(document.priority)}
              </span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Folder size={16} />
                <span>{document.category || '未分类'}</span>
              </div>
              <div className="flex items-center gap-1">
                <User size={16} />
                <span>{document.uploader || '未知作者'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock size={16} />
                <span>更新于 {new Date(document.last_updated).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Eye size={16} />
                <span>查看 {document.usage_count || 0} 次</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="复制链接"
            >
              <Share2 size={20} />
            </button>
            
            <button
              onClick={handleDownload}
              className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="下载文档"
            >
              <Download size={20} />
            </button>
            
            <button
              onClick={onEdit}
              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="编辑文档"
            >
              <Edit size={20} />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="关闭"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 主内容区域 */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* 文档描述 */}
              {document.metadata?.description && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-900 mb-1">文档描述</h3>
                  <p className="text-sm text-blue-800">{document.metadata.description}</p>
                </div>
              )}

              {/* 标签和关键词 */}
              {((document.tags && document.tags.length > 0) || (document.keywords && document.keywords.length > 0)) && (
                <div className="mb-6">
                  {document.tags && document.tags.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Tag size={16} />
                        标签
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {document.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {document.keywords && document.keywords.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">关键词</h4>
                      <div className="flex flex-wrap gap-2">
                        {document.keywords.map((keyword, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 文档内容 */}
              <div className="prose max-w-none">
                <MDEditor.Markdown 
                  source={document.content} 
                  style={{ 
                    backgroundColor: 'transparent',
                    color: '#374151'
                  }}
                />
              </div>
            </div>
          </div>

          {/* 侧边栏 - 文档信息 */}
          <div className="w-80 border-l bg-gray-50 overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">文档信息</h3>
              
              <div className="space-y-4">
                {/* 基本信息 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">基本信息</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">文档ID:</span>
                      <span className="text-gray-900 font-mono text-xs">
                        {document.knowledge_id.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">知识类型:</span>
                      <span className="text-gray-900">
                        {document.knowledge_type === 'operation-procedure' ? '操作规程' : '设备API'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">文件名:</span>
                      <span className="text-gray-900 truncate" title={document.file_name}>
                        {document.file_name || document.title + '.md'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">文件大小:</span>
                      <span className="text-gray-900">
                        {document.file_size ? (document.file_size / 1024).toFixed(1) + ' KB' : '未知'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 时间信息 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">时间信息</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">创建时间:</span>
                      <span className="text-gray-900">
                        {new Date(document.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">最后更新:</span>
                      <span className="text-gray-900">
                        {new Date(document.last_updated).toLocaleDateString()}
                      </span>
                    </div>
                    {document.upload_time && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">上传时间:</span>
                        <span className="text-gray-900">
                          {new Date(document.upload_time).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 版本信息 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">版本信息</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">当前版本:</span>
                      <span className="text-gray-900 font-mono">{document.version || '1.0.0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">历史版本:</span>
                      <span className="text-gray-900">
                        {document.version_history ? document.version_history.length : 0} 个
                      </span>
                    </div>
                  </div>
                </div>

                {/* 统计信息 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">统计信息</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">查看次数:</span>
                      <span className="text-gray-900">{document.usage_count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">有效性评分:</span>
                      <span className="text-gray-900">
                        {document.effectiveness_score ? 
                          (document.effectiveness_score * 100).toFixed(1) + '%' : 
                          '未评分'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">字符数:</span>
                      <span className="text-gray-900">{document.content.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">行数:</span>
                      <span className="text-gray-900">{document.content.split('\n').length}</span>
                    </div>
                  </div>
                </div>

                {/* 操作历史 */}
                {document.version_history && document.version_history.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">最近修改</h4>
                    <div className="space-y-2">
                      {document.version_history.slice(-3).reverse().map((version, index) => (
                        <div key={index} className="p-2 bg-white rounded border text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-mono text-gray-600">{version.version}</span>
                            <span className="text-gray-500">
                              {new Date(version.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          {version.description && (
                            <p className="text-gray-700">{version.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="mt-6 space-y-2">
                <button
                  onClick={onEdit}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit size={16} />
                  编辑文档
                </button>
                
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download size={16} />
                  下载文档
                </button>
                
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Copy size={16} />
                  复制链接
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;