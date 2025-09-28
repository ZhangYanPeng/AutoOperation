/**
 * 文档列表组件
 * 支持网格和列表视图，包含文档操作功能
 */

import React, { useState } from 'react';
import {
  FileText,
  Eye,
  Edit,
  Download,
  Trash2,
  Copy,
  Move,
  Lock,
  Calendar,
  User,
  Tag,
  Folder,
  Clock,
  MoreHorizontal,
  CheckSquare,
  Square,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDocumentStore } from '../stores/documentStore';

const DocumentList = ({ documents, viewMode, onView, onEdit }) => {
  const { deleteDocument, downloadDocument, duplicateDocument, moveDocument } = useDocumentStore();
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [targetCategory, setTargetCategory] = useState('');
  const [deleteMode, setDeleteMode] = useState('soft'); // 'soft' | 'permanent'

  const handleSelectDocument = (docId) => {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocs(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(documents.map(doc => doc.knowledge_id)));
    }
  };

  const handleDownload = async (document) => {
    try {
      await downloadDocument(document.knowledge_id);
      toast.success('文档下载成功');
    } catch (error) {
      toast.error('下载失败: ' + error.message);
    }
  };

  const handleDuplicate = async (document) => {
    try {
      const newTitle = prompt('请输入新文档标题:', document.title + ' (副本)');
      if (newTitle) {
        await duplicateDocument(document.knowledge_id, newTitle);
        toast.success('文档复制成功');
      }
    } catch (error) {
      toast.error('复制失败: ' + error.message);
    }
  };

  const handleBatchMove = async () => {
    if (!targetCategory) {
      toast.error('请选择目标分类');
      return;
    }

    try {
      for (const docId of selectedDocs) {
        await moveDocument(docId, targetCategory);
      }
      toast.success(`已移动 ${selectedDocs.size} 个文档`);
      setSelectedDocs(new Set());
      setShowMoveModal(false);
      setTargetCategory('');
    } catch (error) {
      toast.error('移动失败: ' + error.message);
    }
  };

  const handleBatchDelete = async () => {
    try {
      for (const docId of selectedDocs) {
        await deleteDocument(docId, deleteMode === 'permanent');
      }
      toast.success(`已${deleteMode === 'permanent' ? '永久删除' : '移至回收站'} ${selectedDocs.size} 个文档`);
      setSelectedDocs(new Set());
      setShowDeleteModal(false);
    } catch (error) {
      toast.error('删除失败: ' + error.message);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'published':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'draft':
        return <AlertCircle size={16} className="text-yellow-600" />;
      case 'archived':
        return <Clock size={16} className="text-gray-600" />;
      default:
        return <FileText size={16} className="text-gray-600" />;
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
    if (priority >= 8) return 'text-red-600 bg-red-100';
    if (priority >= 5) return 'text-orange-600 bg-orange-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getPriorityText = (priority) => {
    if (priority >= 8) return '高';
    if (priority >= 5) return '中';
    return '低';
  };

  if (viewMode === 'grid') {
    return (
      <div className="p-6">
        {/* 批量操作工具栏 */}
        {selectedDocs.size > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-blue-700">
                已选择 {selectedDocs.size} 个文档
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowMoveModal(true)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  移动
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
            <button
              onClick={() => setSelectedDocs(new Set())}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              取消选择
            </button>
          </div>
        )}

        {/* 网格视图 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {documents.map((document) => (
            <div
              key={document.knowledge_id}
              className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow border ${
                selectedDocs.has(document.knowledge_id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              {/* 文档卡片头部 */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSelectDocument(document.knowledge_id)}
                      className="text-gray-400 hover:text-blue-600"
                    >
                      {selectedDocs.has(document.knowledge_id) ? 
                        <CheckSquare size={16} className="text-blue-600" /> : 
                        <Square size={16} />
                      }
                    </button>
                    {document.is_locked && <Lock size={14} className="text-orange-600" />}
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(document.status)}
                  </div>
                </div>

                <h3 
                  className="font-medium text-gray-900 mb-2 line-clamp-2 cursor-pointer hover:text-blue-600"
                  onClick={() => onView(document)}
                  title={document.title}
                >
                  {document.title}
                </h3>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Folder size={12} />
                    <span>{document.category || '未分类'}</span>
                    <span className={`px-2 py-0.5 rounded-full ${getPriorityColor(document.priority)}`}>
                      {getPriorityText(document.priority)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <User size={12} />
                    <span>{document.uploader || '未知'}</span>
                    <Clock size={12} />
                    <span>{new Date(document.last_updated).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* 标签 */}
                {document.tags && document.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {document.tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {document.tags.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                        +{document.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="px-4 pb-4 flex justify-between items-center border-t border-gray-100 pt-3">
                <div className="flex gap-1">
                  <button
                    onClick={() => onView(document)}
                    className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="查看"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => onEdit(document)}
                    className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                    title="编辑"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDownload(document)}
                    className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                    title="下载"
                  >
                    <Download size={16} />
                  </button>
                </div>
                
                <div className="flex gap-1">
                  <button
                    onClick={() => handleDuplicate(document)}
                    className="p-1.5 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                    title="复制"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => deleteDocument(document.knowledge_id, false)}
                    className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="删除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 列表视图
  return (
    <div className="p-6">
      {/* 批量操作工具栏 */}
      {selectedDocs.size > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-blue-700">
              已选择 {selectedDocs.size} 个文档
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowMoveModal(true)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                移动
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
          <button
            onClick={() => setSelectedDocs(new Set())}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            取消选择
          </button>
        </div>
      )}

      {/* 表格头部 */}
      <div className="bg-gray-50 border border-gray-200 rounded-t-lg">
        <div className="grid grid-cols-12 gap-4 p-4 text-sm font-medium text-gray-700">
          <div className="col-span-1 flex items-center">
            <button
              onClick={handleSelectAll}
              className="text-gray-400 hover:text-blue-600"
            >
              {selectedDocs.size === documents.length ? 
                <CheckSquare size={16} className="text-blue-600" /> : 
                <Square size={16} />
              }
            </button>
          </div>
          <div className="col-span-4">标题</div>
          <div className="col-span-2">分类</div>
          <div className="col-span-1">状态</div>
          <div className="col-span-1">优先级</div>
          <div className="col-span-2">更新时间</div>
          <div className="col-span-1">操作</div>
        </div>
      </div>

      {/* 表格内容 */}
      <div className="bg-white border-l border-r border-b border-gray-200 rounded-b-lg">
        {documents.map((document, index) => (
          <div
            key={document.knowledge_id}
            className={`grid grid-cols-12 gap-4 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              selectedDocs.has(document.knowledge_id) ? 'bg-blue-50' : ''
            } ${index === documents.length - 1 ? 'border-b-0' : ''}`}
          >
            <div className="col-span-1 flex items-center">
              <button
                onClick={() => handleSelectDocument(document.knowledge_id)}
                className="text-gray-400 hover:text-blue-600"
              >
                {selectedDocs.has(document.knowledge_id) ? 
                  <CheckSquare size={16} className="text-blue-600" /> : 
                  <Square size={16} />
                }
              </button>
            </div>

            <div className="col-span-4">
              <div className="flex items-start gap-2">
                {document.is_locked && <Lock size={14} className="text-orange-600 mt-0.5" />}
                <div>
                  <h3 
                    className="font-medium text-gray-900 hover:text-blue-600 cursor-pointer line-clamp-1"
                    onClick={() => onView(document)}
                    title={document.title}
                  >
                    {document.title}
                  </h3>
                  {document.tags && document.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {document.tags.slice(0, 2).map((tag, index) => (
                        <span
                          key={index}
                          className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {document.tags.length > 2 && (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                          +{document.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-span-2 flex items-center text-sm text-gray-600">
              <Folder size={14} className="mr-1" />
              {document.category || '未分类'}
            </div>

            <div className="col-span-1 flex items-center">
              <div className="flex items-center gap-1">
                {getStatusIcon(document.status)}
                <span className="text-sm text-gray-600">
                  {getStatusText(document.status)}
                </span>
              </div>
            </div>

            <div className="col-span-1 flex items-center">
              <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(document.priority)}`}>
                {getPriorityText(document.priority)}
              </span>
            </div>

            <div className="col-span-2 flex items-center text-sm text-gray-600">
              <Clock size={14} className="mr-1" />
              {new Date(document.last_updated).toLocaleString()}
            </div>

            <div className="col-span-1 flex items-center justify-end">
              <div className="flex gap-1">
                <button
                  onClick={() => onView(document)}
                  className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="查看"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => onEdit(document)}
                  className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                  title="编辑"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => handleDownload(document)}
                  className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                  title="下载"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => deleteDocument(document.knowledge_id, false)}
                  className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 移动模态框 */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              移动文档到其他分类
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              将选中的 {selectedDocs.size} 个文档移动到:
            </p>
            <select
              value={targetCategory}
              onChange={(e) => setTargetCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6"
            >
              <option value="">选择目标分类</option>
              <option value="performance">性能优化</option>
              <option value="network">网络管理</option>
              <option value="security">安全管理</option>
              <option value="maintenance">维护保养</option>
              <option value="database">数据库</option>
              <option value="monitoring">监控告警</option>
              <option value="general">通用</option>
            </select>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setTargetCategory('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBatchMove}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={!targetCategory}
              >
                移动
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认模态框 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              确认删除文档
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              您要删除选中的 {selectedDocs.size} 个文档吗？
            </p>
            <div className="mb-6">
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="radio"
                  name="deleteMode"
                  value="soft"
                  checked={deleteMode === 'soft'}
                  onChange={(e) => setDeleteMode(e.target.value)}
                />
                <span className="text-sm">移至回收站（可恢复）</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="deleteMode"
                  value="permanent"
                  checked={deleteMode === 'permanent'}
                  onChange={(e) => setDeleteMode(e.target.value)}
                />
                <span className="text-sm text-red-600">永久删除（不可恢复）</span>
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteMode('soft');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBatchDelete}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${
                  deleteMode === 'permanent' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {deleteMode === 'permanent' ? '永久删除' : '移至回收站'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentList;