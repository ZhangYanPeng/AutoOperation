/**
 * 文档编辑器组件
 * 支持Markdown编辑、实时预览和元数据管理
 */

import React, { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import {
  Save,
  X,
  Eye,
  Edit3,
  Clock,
  Tag,
  Folder,
  AlertCircle,
  CheckCircle,
  Loader,
  Plus,
  History,
  Lock,
  Unlock
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDocumentStore } from '../stores/documentStore';

const DocumentEditor = ({ document, onClose, onSuccess }) => {
  const { updateDocument, lockDocument, unlockDocument } = useDocumentStore();
  const [content, setContent] = useState(document?.content || '');
  const [metadata, setMetadata] = useState({
    title: document?.title || '',
    category: document?.category || '',
    knowledge_type: document?.knowledge_type || 'operation-procedure',
    priority: document?.priority || 0,
    status: document?.status || 'published',
    tags: document?.tags || [],
    keywords: document?.keywords || [],
    description: document?.metadata?.description || ''
  });
  
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isLocked, setIsLocked] = useState(document?.is_locked || false);

  useEffect(() => {
    // 检查是否有未保存的更改
    const hasContentChanges = content !== document?.content;
    const hasMetadataChanges = JSON.stringify(metadata) !== JSON.stringify({
      title: document?.title || '',
      category: document?.category || '',
      knowledge_type: document?.knowledge_type || 'operation-procedure',
      priority: document?.priority || 0,
      status: document?.status || 'published',
      tags: document?.tags || [],
      keywords: document?.keywords || [],
      description: document?.metadata?.description || ''
    });
    
    setHasChanges(hasContentChanges || hasMetadataChanges);
  }, [content, metadata, document]);

  useEffect(() => {
    // 自动锁定文档
    if (document && !document.is_locked) {
      handleLockDocument();
    }

    // 组件卸载时解锁文档
    return () => {
      if (document && isLocked) {
        handleUnlockDocument();
      }
    };
  }, []);

  const handleLockDocument = async () => {
    try {
      await lockDocument(document.knowledge_id);
      setIsLocked(true);
    } catch (error) {
      console.error('锁定文档失败:', error);
      toast.error('无法锁定文档，可能已被其他用户编辑');
    }
  };

  const handleUnlockDocument = async () => {
    try {
      await unlockDocument(document.knowledge_id);
      setIsLocked(false);
    } catch (error) {
      console.error('解锁文档失败:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!metadata.title.trim()) {
      newErrors.title = '文档标题不能为空';
    }
    
    if (!metadata.category.trim()) {
      newErrors.category = '请选择文档分类';
    }
    
    if (!content.trim()) {
      newErrors.content = '文档内容不能为空';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    
    try {
      const updates = {
        ...metadata,
        content: content.trim()
      };
      
      await updateDocument(document.knowledge_id, updates);
      toast.success('文档保存成功');
      setHasChanges(false);
      onSuccess();
    } catch (error) {
      console.error('保存失败:', error);
      toast.error(error.message || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (hasChanges) {
      const confirmed = window.confirm('您有未保存的更改，确定要关闭吗？');
      if (!confirmed) {
        return;
      }
    }
    
    if (isLocked) {
      await handleUnlockDocument();
    }
    
    onClose();
  };

  const addTag = () => {
    if (newTag.trim() && !metadata.tags.includes(newTag.trim())) {
      setMetadata(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setMetadata(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !metadata.keywords.includes(newKeyword.trim())) {
      setMetadata(prev => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim()]
      }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (keywordToRemove) => {
    setMetadata(prev => ({
      ...prev,
      keywords: prev.keywords.filter(keyword => keyword !== keywordToRemove)
    }));
  };

  const autoExtractKeywords = () => {
    const text = content.toLowerCase();
    const words = text.match(/\b\w{3,}\b/g) || [];
    const frequency = {};
    
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    const topWords = Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word)
      .filter(word => !metadata.keywords.includes(word));
    
    setMetadata(prev => ({
      ...prev,
      keywords: [...prev.keywords, ...topWords.slice(0, 5)]
    }));
    
    toast.success('已自动提取关键词');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              编辑文档: {document?.title}
            </h2>
            {isLocked && (
              <div className="flex items-center text-orange-600 text-sm">
                <Lock size={16} className="mr-1" />
                已锁定编辑
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {hasChanges && (
              <div className="flex items-center text-orange-600 text-sm mr-4">
                <AlertCircle size={16} className="mr-1" />
                有未保存的更改
              </div>
            )}
            
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={`p-2 rounded-lg transition-colors ${
                previewMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {previewMode ? <Edit3 size={20} /> : <Eye size={20} />}
            </button>
            
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="p-2 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
            >
              <History size={20} />
            </button>
            
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 主编辑区域 */}
          <div className="flex-1 flex flex-col">
            {/* 内容编辑器 */}
            <div className="flex-1 p-4">
              {previewMode ? (
                <div className="h-full overflow-y-auto prose max-w-none">
                  <MDEditor.Markdown source={content} />
                </div>
              ) : (
                <MDEditor
                  value={content}
                  onChange={setContent}
                  height="100%"
                  preview="edit"
                  hideToolbar={false}
                  data-color-mode="light"
                />
              )}
            </div>
          </div>

          {/* 侧边栏 - 元数据编辑 */}
          <div className="w-80 border-l bg-gray-50 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">文档信息</h3>
              
              <div className="space-y-4">
                {/* 标题 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    标题 *
                  </label>
                  <input
                    type="text"
                    value={metadata.title}
                    onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      errors.title ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="文档标题"
                  />
                  {errors.title && (
                    <div className="mt-1 flex items-center text-red-600 text-xs">
                      <AlertCircle size={14} className="mr-1" />
                      {errors.title}
                    </div>
                  )}
                </div>

                {/* 分类 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    分类 *
                  </label>
                  <select
                    value={metadata.category}
                    onChange={(e) => setMetadata(prev => ({ ...prev, category: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      errors.category ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">选择分类</option>
                    <option value="performance">性能优化</option>
                    <option value="network">网络管理</option>
                    <option value="security">安全管理</option>
                    <option value="maintenance">维护保养</option>
                    <option value="database">数据库</option>
                    <option value="monitoring">监控告警</option>
                    <option value="general">通用</option>
                  </select>
                </div>

                {/* 知识类型 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    知识类型
                  </label>
                  <select
                    value={metadata.knowledge_type}
                    onChange={(e) => setMetadata(prev => ({ ...prev, knowledge_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="operation-procedure">操作规程</option>
                    <option value="device-api">设备API</option>
                  </select>
                </div>

                {/* 优先级和状态 */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      优先级
                    </label>
                    <select
                      value={metadata.priority}
                      onChange={(e) => setMetadata(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value={0}>低</option>
                      <option value={5}>中</option>
                      <option value={10}>高</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      状态
                    </label>
                    <select
                      value={metadata.status}
                      onChange={(e) => setMetadata(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="draft">草稿</option>
                      <option value="published">已发布</option>
                      <option value="archived">已归档</option>
                    </select>
                  </div>
                </div>

                {/* 标签 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    标签
                  </label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {metadata.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center gap-1"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                      placeholder="添加标签"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* 关键词 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      关键词
                    </label>
                    <button
                      type="button"
                      onClick={autoExtractKeywords}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      自动提取
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {metadata.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs flex items-center gap-1"
                      >
                        {keyword}
                        <button
                          type="button"
                          onClick={() => removeKeyword(keyword)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                      placeholder="添加关键词"
                    />
                    <button
                      type="button"
                      onClick={addKeyword}
                      className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* 描述 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    描述
                  </label>
                  <textarea
                    value={metadata.description}
                    onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="文档描述（可选）"
                  />
                </div>

                {/* 文档信息 */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">文档信息</h4>
                  <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>创建时间:</span>
                      <span>{new Date(document?.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>最后更新:</span>
                      <span>{new Date(document?.last_updated).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>版本:</span>
                      <span>{document?.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>文件大小:</span>
                      <span>{(document?.file_size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            字数: {content.length} | 行数: {content.split('\n').length}
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              disabled={saving}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <>
                  <Loader className="animate-spin" size={16} />
                  保存中...
                </>
              ) : (
                <>
                  <Save size={16} />
                  保存文档
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentEditor;