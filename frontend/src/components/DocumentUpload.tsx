/**
 * 文档上传组件
 * 支持拖拽上传和文件选择，包含元数据编辑
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  File,
  X,
  AlertCircle,
  CheckCircle,
  Loader,
  Plus,
  Minus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDocumentStore } from '../stores/documentStore';

const DocumentUpload = ({ onClose, onSuccess }) => {
  const { uploadDocument, categories } = useDocumentStore();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [metadata, setMetadata] = useState({
    title: '',
    category: '',
    knowledge_type: 'operation-procedure',
    priority: 0,
    status: 'published',
    tags: [],
    description: '',
    uploader: 'current_user' // 在实际应用中应该从用户状态获取
  });
  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState({});

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setErrors({});
    
    if (rejectedFiles.length > 0) {
      const error = rejectedFiles[0].errors[0];
      if (error.code === 'file-too-large') {
        setErrors({ file: '文件大小超过5MB限制' });
      } else if (error.code === 'file-invalid-type') {
        setErrors({ file: '只支持 .md, .markdown, .txt 格式的文件' });
      } else {
        setErrors({ file: '文件格式不支持' });
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const uploadedFile = acceptedFiles[0];
      setFile(uploadedFile);
      
      // 自动填充标题
      if (!metadata.title) {
        const fileName = uploadedFile.name.replace(/\.(md|markdown|txt)$/i, '');
        setMetadata(prev => ({
          ...prev,
          title: fileName.replace(/[-_]/g, ' ')
        }));
      }

      // 读取文件内容预览
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        // 尝试从内容中提取标题
        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (titleMatch && !metadata.title) {
          setMetadata(prev => ({
            ...prev,
            title: titleMatch[1].trim()
          }));
        }
      };
      reader.readAsText(uploadedFile);
    }
  }, [metadata.title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/markdown': ['.md', '.markdown'],
      'text/plain': ['.txt']
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: false
  });

  const validateForm = () => {
    const newErrors = {};
    
    if (!file) {
      newErrors.file = '请选择要上传的文件';
    }
    
    if (!metadata.title.trim()) {
      newErrors.title = '文档标题不能为空';
    }
    
    if (!metadata.category.trim()) {
      newErrors.category = '请选择文档分类';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setUploading(true);
    
    try {
      await uploadDocument(file, metadata);
      toast.success('文档上传成功');
      onSuccess();
    } catch (error) {
      console.error('上传失败:', error);
      toast.error(error.message || '上传失败，请重试');
    } finally {
      setUploading(false);
    }
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

  const removeFile = () => {
    setFile(null);
    setErrors({});
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">上传文档</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* 文件上传区域 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择文件
            </label>
            
            {!file ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-blue-400 bg-blue-50'
                    : errors.file
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                {isDragActive ? (
                  <p className="text-blue-600">放下文件以上传...</p>
                ) : (
                  <div>
                    <p className="text-gray-600 mb-2">
                      拖拽文件到这里，或 <span className="text-blue-600">点击选择</span>
                    </p>
                    <p className="text-sm text-gray-500">
                      支持 .md, .markdown, .txt 格式，最大 5MB
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg p-4 flex items-center justify-between bg-green-50">
                <div className="flex items-center">
                  <File className="h-8 w-8 text-green-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="text-red-600 hover:text-red-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            )}
            
            {errors.file && (
              <div className="mt-2 flex items-center text-red-600 text-sm">
                <AlertCircle size={16} className="mr-1" />
                {errors.file}
              </div>
            )}
          </div>

          {/* 元数据表单 */}
          <div className="space-y-4">
            {/* 文档标题 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                文档标题 *
              </label>
              <input
                type="text"
                value={metadata.title}
                onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="输入文档标题"
              />
              {errors.title && (
                <div className="mt-1 flex items-center text-red-600 text-sm">
                  <AlertCircle size={16} className="mr-1" />
                  {errors.title}
                </div>
              )}
            </div>

            {/* 分类和类型 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  文档分类 *
                </label>
                <select
                  value={metadata.category}
                  onChange={(e) => setMetadata(prev => ({ ...prev, category: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
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
                {errors.category && (
                  <div className="mt-1 flex items-center text-red-600 text-sm">
                    <AlertCircle size={16} className="mr-1" />
                    {errors.category}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  知识类型
                </label>
                <select
                  value={metadata.knowledge_type}
                  onChange={(e) => setMetadata(prev => ({ ...prev, knowledge_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="operation-procedure">操作规程</option>
                  <option value="device-api">设备API</option>
                </select>
              </div>
            </div>

            {/* 优先级和状态 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  优先级
                </label>
                <select
                  value={metadata.priority}
                  onChange={(e) => setMetadata(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={0}>低</option>
                  <option value={5}>中</option>
                  <option value={10}>高</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  发布状态
                </label>
                <select
                  value={metadata.status}
                  onChange={(e) => setMetadata(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                </select>
              </div>
            </div>

            {/* 标签 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                标签
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {metadata.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="添加标签"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <Plus size={16} />
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="文档描述（可选）"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              disabled={uploading}
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader className="animate-spin" size={16} />
                  上传中...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  上传文档
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DocumentUpload;