/**
 * 分类管理组件
 * 支持两类知识库的分类管理：运维处置和设备API
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Move,
  Search,
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronDown,
  Settings,
  Save,
  X,
  AlertCircle
} from 'lucide-react';

interface Category {
  category_id: string;
  knowledge_type: 'operation-procedure' | 'device-api';
  display_name_zh: string;
  display_name_en: string;
  description: string;
  parent_category?: string;
  sort_order: number;
  is_active: boolean;
  children: Category[];
  knowledge_count: number;
  level: number;
}

interface CategoryManagementProps {
  knowledgeType: 'operation-procedure' | 'device-api';
  onCategoryChange?: () => void;
}

const CategoryManagement: React.FC<CategoryManagementProps> = ({ 
  knowledgeType,
  onCategoryChange 
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCategory, setNewCategory] = useState({
    display_name_zh: '',
    display_name_en: '',
    description: '',
    parent_category: '',
    sort_order: 100
  });

  const knowledgeTypeNames = {
    'operation-procedure': '故障处置知识库',
    'device-api': '设备API知识库'
  };

  useEffect(() => {
    loadCategories();
  }, [knowledgeType]);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/v1/categories/type/${knowledgeType}?tree=true`);
      const result = await response.json();
      
      if (result.success) {
        setCategories(result.data.categories);
      } else {
        throw new Error(result.message || '加载分类失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载分类失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategory.display_name_zh.trim()) {
      setError('分类名称不能为空');
      return;
    }

    try {
      const response = await fetch('/api/v1/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newCategory,
          knowledge_type: knowledgeType,
          parent_category: newCategory.parent_category || null
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setShowCreateModal(false);
        setNewCategory({
          display_name_zh: '',
          display_name_en: '',
          description: '',
          parent_category: '',
          sort_order: 100
        });
        await loadCategories();
        onCategoryChange?.();
      } else {
        throw new Error(result.message || '创建分类失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建分类失败');
    }
  };

  const handleUpdateCategory = async (categoryId: string, updates: Partial<Category>) => {
    try {
      const response = await fetch(`/api/v1/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      
      if (result.success) {
        setEditingCategory(null);
        await loadCategories();
        onCategoryChange?.();
      } else {
        throw new Error(result.message || '更新分类失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新分类失败');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('确定要删除此分类吗？此操作不可恢复。')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/categories/${categoryId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        await loadCategories();
        onCategoryChange?.();
      } else {
        throw new Error(result.message || '删除分类失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除分类失败');
    }
  };

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const renderCategory = (category: Category) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.category_id);
    const isEditing = editingCategory?.category_id === category.category_id;

    return (
      <div key={category.category_id} className="border border-gray-200 rounded-lg mb-2">
        <div className="p-3 bg-white hover:bg-gray-50 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={() => toggleExpanded(category.category_id)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </button>
              ) : (
                <div className="w-6" />
              )}
              
              {hasChildren ? (
                <FolderOpen size={16} className="text-blue-600" />
              ) : (
                <Folder size={16} className="text-gray-600" />
              )}

              {isEditing ? (
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={editingCategory.display_name_zh}
                    onChange={(e) => setEditingCategory({
                      ...editingCategory,
                      display_name_zh: e.target.value
                    })}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="中文名称"
                  />
                  <input
                    type="text"
                    value={editingCategory.display_name_en}
                    onChange={(e) => setEditingCategory({
                      ...editingCategory,
                      display_name_en: e.target.value
                    })}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="英文名称"
                  />
                </div>
              ) : (
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {category.display_name_zh}
                  </div>
                  {category.display_name_en && (
                    <div className="text-sm text-gray-600">
                      {category.display_name_en}
                    </div>
                  )}
                  {category.description && (
                    <div className="text-sm text-gray-500 mt-1">
                      {category.description}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {category.knowledge_count > 0 && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {category.knowledge_count}
                </span>
              )}

              {isEditing ? (
                <>
                  <button
                    onClick={() => handleUpdateCategory(category.category_id, {
                      display_name_zh: editingCategory.display_name_zh,
                      display_name_en: editingCategory.display_name_en
                    })}
                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                    title="保存"
                  >
                    <Save size={16} />
                  </button>
                  <button
                    onClick={() => setEditingCategory(null)}
                    className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                    title="取消"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditingCategory(category)}
                    className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                    title="编辑"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.category_id)}
                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                    title="删除"
                    disabled={category.knowledge_count > 0 || hasChildren}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="pl-6 pb-2">
            {category.children.map(child => renderCategory(child))}
          </div>
        )}
      </div>
    );
  };

  const filteredCategories = categories.filter(category => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      category.display_name_zh.toLowerCase().includes(query) ||
      category.display_name_en.toLowerCase().includes(query) ||
      category.description.toLowerCase().includes(query)
    );
  });

  const flattenCategories = (cats: Category[]): Category[] => {
    const result: Category[] = [];
    cats.forEach(cat => {
      result.push(cat);
      if (cat.children) {
        result.push(...flattenCategories(cat.children));
      }
    });
    return result;
  };

  const allCategories = flattenCategories(categories);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          {knowledgeTypeNames[knowledgeType]} - 分类管理
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          新建分类
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="搜索分类..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">加载中...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCategories.length === 0 ? (
            <div className="text-center p-8">
              <FolderOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无分类</h3>
              <p className="text-gray-600">
                {searchQuery ? '没有找到符合条件的分类' : '还没有创建任何分类'}
              </p>
            </div>
          ) : (
            filteredCategories.map(category => renderCategory(category))
          )}
        </div>
      )}

      {/* 创建分类模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">创建新分类</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  中文名称 *
                </label>
                <input
                  type="text"
                  value={newCategory.display_name_zh}
                  onChange={(e) => setNewCategory({
                    ...newCategory,
                    display_name_zh: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入中文名称"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  英文名称
                </label>
                <input
                  type="text"
                  value={newCategory.display_name_en}
                  onChange={(e) => setNewCategory({
                    ...newCategory,
                    display_name_en: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入英文名称"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({
                    ...newCategory,
                    description: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="请输入分类描述"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  父分类
                </label>
                <select
                  value={newCategory.parent_category}
                  onChange={(e) => setNewCategory({
                    ...newCategory,
                    parent_category: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">选择父分类（可选）</option>
                  {allCategories.map(cat => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {'　'.repeat(cat.level)}{cat.display_name_zh}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  排序权重
                </label>
                <input
                  type="number"
                  value={newCategory.sort_order}
                  onChange={(e) => setNewCategory({
                    ...newCategory,
                    sort_order: parseInt(e.target.value) || 100
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                  max="999"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateCategory}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                disabled={!newCategory.display_name_zh.trim()}
              >
                创建
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManagement;