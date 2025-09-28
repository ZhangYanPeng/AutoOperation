/**
 * 分类管理服务
 * 统一管理运维处置知识库和设备API知识库的分类体系
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Category } from '../models/Category.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CategoryService {
  constructor() {
    this.categories = new Map(); // category_id -> Category对象
    this.categoriesByType = new Map(); // knowledge_type -> Set<category_id>
    this.categoryHierarchy = new Map(); // parent_id -> Set<child_id>
    this.initialized = false;
    this.dataPath = null;
  }

  /**
   * 初始化分类服务
   */
  async initialize(dataPath = null) {
    try {
      this.dataPath = dataPath || this.getDefaultDataPath();
      await this.loadCategories();
      this.buildHierarchy();
      this.initialized = true;
      
      logger.info('分类服务初始化成功', {
        totalCategories: this.categories.size,
        operationCategories: this.categoriesByType.get('operation-procedure')?.size || 0,
        deviceAPICategories: this.categoriesByType.get('device-api')?.size || 0
      });
    } catch (error) {
      logger.error('分类服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取默认数据路径
   */
  getDefaultDataPath() {
    return path.join(__dirname, '../../../data/categories.json');
  }

  /**
   * 检查初始化状态
   */
  checkInitialized() {
    if (!this.initialized) {
      throw new Error('分类服务未初始化，请先调用 initialize()');
    }
  }

  /**
   * 加载分类数据
   */
  async loadCategories() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, 'utf8');
        const categoriesData = JSON.parse(data);
        
        // 恢复分类对象
        categoriesData.forEach(categoryData => {
          const category = Category.fromJSON(categoryData);
          this.addCategoryToMaps(category);
        });
        
        logger.info(`已加载 ${this.categories.size} 个分类`);
      } else {
        // 创建默认分类
        await this.createDefaultCategories();
      }
    } catch (error) {
      logger.error('加载分类数据失败:', error);
      throw error;
    }
  }

  /**
   * 创建默认分类
   */
  async createDefaultCategories() {
    logger.info('创建默认分类...');

    // 创建运维处置分类
    const operationCategories = Category.createDefaultOperationCategories();
    operationCategories.forEach(category => {
      this.addCategoryToMaps(category);
    });

    // 创建设备API分类
    const deviceAPICategories = Category.createDefaultDeviceAPICategories();
    deviceAPICategories.forEach(category => {
      this.addCategoryToMaps(category);
    });

    // 保存到文件
    await this.saveCategories();
    
    logger.info(`已创建 ${this.categories.size} 个默认分类`);
  }

  /**
   * 将分类添加到内存映射中
   */
  addCategoryToMaps(category) {
    this.categories.set(category.category_id, category);
    
    // 按类型分组
    if (!this.categoriesByType.has(category.knowledge_type)) {
      this.categoriesByType.set(category.knowledge_type, new Set());
    }
    this.categoriesByType.get(category.knowledge_type).add(category.category_id);
  }

  /**
   * 从内存映射中移除分类
   */
  removeCategoryFromMaps(categoryId) {
    const category = this.categories.get(categoryId);
    if (category) {
      this.categories.delete(categoryId);
      this.categoriesByType.get(category.knowledge_type)?.delete(categoryId);
    }
  }

  /**
   * 构建层级关系
   */
  buildHierarchy() {
    this.categoryHierarchy.clear();
    
    for (const category of this.categories.values()) {
      if (category.parent_category) {
        if (!this.categoryHierarchy.has(category.parent_category)) {
          this.categoryHierarchy.set(category.parent_category, new Set());
        }
        this.categoryHierarchy.get(category.parent_category).add(category.category_id);
      }
    }

    // 构建树形结构
    this.buildCategoryTree();
  }

  /**
   * 构建分类树形结构
   */
  buildCategoryTree() {
    // 重置所有分类的子分类
    for (const category of this.categories.values()) {
      category.children = [];
      category.level = 0;
    }

    // 构建树形结构
    const rootCategories = Array.from(this.categories.values())
      .filter(category => !category.parent_category);

    const buildTree = (parentCategory, level = 0) => {
      parentCategory.level = level;
      const childrenIds = this.categoryHierarchy.get(parentCategory.category_id) || new Set();
      
      for (const childId of childrenIds) {
        const childCategory = this.categories.get(childId);
        if (childCategory) {
          parentCategory.addChild(childCategory);
          buildTree(childCategory, level + 1);
        }
      }
    };

    rootCategories.forEach(category => buildTree(category));
  }

  /**
   * 创建新分类
   */
  async createCategory(categoryData) {
    this.checkInitialized();

    const category = new Category(categoryData);
    const validation = category.validate();
    
    if (!validation.isValid) {
      throw new Error(`分类数据验证失败: ${validation.errors.join(', ')}`);
    }

    // 检查分类ID是否已存在
    if (this.categories.has(category.category_id)) {
      throw new Error(`分类ID已存在: ${category.category_id}`);
    }

    // 验证父分类
    if (category.parent_category) {
      const parentCategory = this.categories.get(category.parent_category);
      if (!parentCategory) {
        throw new Error(`父分类不存在: ${category.parent_category}`);
      }
      
      if (!parentCategory.canBeParentOf(category)) {
        throw new Error('无法设置该父分类');
      }
    }

    // 添加到内存映射
    this.addCategoryToMaps(category);
    
    // 重建层级关系
    this.buildHierarchy();
    
    // 保存到文件
    await this.saveCategories();
    
    logger.info(`已创建分类: ${category.category_id} - ${category.display_name_zh}`);
    return category.toJSON();
  }

  /**
   * 更新分类
   */
  async updateCategory(categoryId, updates) {
    this.checkInitialized();

    const category = this.categories.get(categoryId);
    if (!category) {
      throw new Error(`分类不存在: ${categoryId}`);
    }

    // 验证父分类更新
    if (updates.parent_category !== undefined) {
      if (updates.parent_category && updates.parent_category !== category.parent_category) {
        const newParent = this.categories.get(updates.parent_category);
        if (!newParent) {
          throw new Error(`父分类不存在: ${updates.parent_category}`);
        }
        
        if (!newParent.canBeParentOf(category)) {
          throw new Error('无法设置该父分类');
        }
      }
    }

    category.update(updates);
    
    const validation = category.validate();
    if (!validation.isValid) {
      throw new Error(`分类数据验证失败: ${validation.errors.join(', ')}`);
    }

    // 重建层级关系
    this.buildHierarchy();
    
    // 保存到文件
    await this.saveCategories();
    
    logger.info(`已更新分类: ${categoryId} - ${category.display_name_zh}`);
    return category.toJSON();
  }

  /**
   * 删除分类
   */
  async deleteCategory(categoryId) {
    this.checkInitialized();

    const category = this.categories.get(categoryId);
    if (!category) {
      throw new Error(`分类不存在: ${categoryId}`);
    }

    // 检查是否有子分类
    const hasChildren = this.categoryHierarchy.has(categoryId);
    if (hasChildren) {
      throw new Error('无法删除包含子分类的分类，请先删除所有子分类');
    }

    // TODO: 检查是否有知识条目使用该分类
    // const knowledgeCount = await this.getKnowledgeCountByCategory(categoryId);
    // if (knowledgeCount > 0) {
    //   throw new Error(`无法删除包含 ${knowledgeCount} 个知识条目的分类`);
    // }

    // 从内存映射中移除
    this.removeCategoryFromMaps(categoryId);
    
    // 重建层级关系
    this.buildHierarchy();
    
    // 保存到文件
    await this.saveCategories();
    
    logger.info(`已删除分类: ${categoryId} - ${category.display_name_zh}`);
    return true;
  }

  /**
   * 获取分类详情
   */
  getCategory(categoryId) {
    this.checkInitialized();

    const category = this.categories.get(categoryId);
    if (!category) {
      return null;
    }

    return category.toJSON();
  }

  /**
   * 获取指定类型的所有分类
   */
  getCategoriesByType(knowledgeType, includeInactive = false) {
    this.checkInitialized();

    const categoryIds = this.categoriesByType.get(knowledgeType) || new Set();
    const categories = [];

    for (const categoryId of categoryIds) {
      const category = this.categories.get(categoryId);
      if (category && (includeInactive || category.is_active)) {
        categories.push(category.toJSON());
      }
    }

    // 按排序权重和名称排序
    categories.sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.display_name_zh.localeCompare(b.display_name_zh);
    });

    return categories;
  }

  /**
   * 获取层级结构的分类树
   */
  getCategoryTree(knowledgeType, includeInactive = false) {
    this.checkInitialized();

    const allCategories = this.getCategoriesByType(knowledgeType, includeInactive);
    const rootCategories = allCategories.filter(cat => !cat.parent_category);

    return rootCategories;
  }

  /**
   * 获取分类的层级路径
   */
  getCategoryPath(categoryId) {
    this.checkInitialized();

    const category = this.categories.get(categoryId);
    if (!category) {
      return [];
    }

    const path = [];
    let current = category;

    while (current) {
      path.unshift({
        id: current.category_id,
        name_zh: current.display_name_zh,
        name_en: current.display_name_en
      });

      if (current.parent_category) {
        current = this.categories.get(current.parent_category);
      } else {
        current = null;
      }
    }

    return path;
  }

  /**
   * 搜索分类
   */
  searchCategories(query, knowledgeType = null) {
    this.checkInitialized();

    const searchTerms = query.toLowerCase().split(/\s+/);
    const results = [];

    for (const category of this.categories.values()) {
      // 类型过滤
      if (knowledgeType && category.knowledge_type !== knowledgeType) {
        continue;
      }

      // 只搜索活跃分类
      if (!category.is_active) {
        continue;
      }

      // 搜索匹配
      const searchText = `${category.display_name_zh} ${category.display_name_en} ${category.description}`.toLowerCase();
      const matchedTerms = searchTerms.filter(term => searchText.includes(term));
      
      if (matchedTerms.length > 0) {
        const score = matchedTerms.length / searchTerms.length;
        results.push({
          category: category.toJSON(),
          score,
          matchedTerms
        });
      }
    }

    // 按匹配度排序
    results.sort((a, b) => b.score - a.score);

    return results.map(result => result.category);
  }

  /**
   * 移动分类到新的父分类
   */
  async moveCategory(categoryId, newParentId) {
    this.checkInitialized();

    const category = this.categories.get(categoryId);
    if (!category) {
      throw new Error(`分类不存在: ${categoryId}`);
    }

    let newParent = null;
    if (newParentId) {
      newParent = this.categories.get(newParentId);
      if (!newParent) {
        throw new Error(`目标父分类不存在: ${newParentId}`);
      }

      if (!newParent.canBeParentOf(category)) {
        throw new Error('无法移动到该父分类');
      }
    }

    // 更新父分类
    await this.updateCategory(categoryId, { parent_category: newParentId });
    
    logger.info(`已移动分类 ${categoryId} 到 ${newParentId || '根级别'}`);
    return category.toJSON();
  }

  /**
   * 批量更新分类排序
   */
  async updateCategoriesOrder(orderUpdates) {
    this.checkInitialized();

    for (const update of orderUpdates) {
      const { categoryId, sortOrder } = update;
      const category = this.categories.get(categoryId);
      
      if (category) {
        category.update({ sort_order: sortOrder });
      }
    }

    // 重建层级关系
    this.buildHierarchy();
    
    // 保存到文件
    await this.saveCategories();
    
    logger.info(`已批量更新 ${orderUpdates.length} 个分类的排序`);
  }

  /**
   * 获取分类统计信息
   */
  getStatistics() {
    this.checkInitialized();

    const stats = {
      total: this.categories.size,
      by_type: {},
      by_level: {},
      active_count: 0,
      inactive_count: 0
    };

    for (const category of this.categories.values()) {
      // 按类型统计
      const type = category.knowledge_type;
      stats.by_type[type] = (stats.by_type[type] || 0) + 1;

      // 按层级统计
      const level = category.level;
      stats.by_level[level] = (stats.by_level[level] || 0) + 1;

      // 活跃状态统计
      if (category.is_active) {
        stats.active_count++;
      } else {
        stats.inactive_count++;
      }
    }

    return stats;
  }

  /**
   * 保存分类数据到文件
   */
  async saveCategories() {
    try {
      const categoriesData = Array.from(this.categories.values()).map(cat => cat.toJSON());
      
      // 确保数据目录存在
      const dataDir = path.dirname(this.dataPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(this.dataPath, JSON.stringify(categoriesData, null, 2), 'utf8');
      logger.debug(`已保存分类数据到: ${this.dataPath}`);
    } catch (error) {
      logger.error('保存分类数据失败:', error);
      throw error;
    }
  }

  /**
   * 重新加载分类数据
   */
  async reload() {
    this.categories.clear();
    this.categoriesByType.clear();
    this.categoryHierarchy.clear();
    
    await this.loadCategories();
    this.buildHierarchy();
    
    logger.info('分类数据已重新加载');
  }
}

// 创建全局单例实例
export const categoryService = new CategoryService();

export default categoryService;