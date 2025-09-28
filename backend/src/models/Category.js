/**
 * 知识库分类模型
 * 支持两类知识库的分离式分类管理：运维处置知识库和设备API知识库
 */

import { v4 as uuidv4 } from 'uuid';

export class Category {
  constructor({
    category_id = null,
    knowledge_type,
    display_name_zh,
    display_name_en = null,
    description = '',
    parent_category = null,
    sort_order = 100,
    is_active = true,
    metadata = {},
    created_at = null,
    updated_at = null,
    created_by = null,
    updated_by = null
  }) {
    this.category_id = category_id || uuidv4();
    this.knowledge_type = knowledge_type; // 'operation-procedure', 'device-api'
    this.display_name_zh = display_name_zh;
    this.display_name_en = display_name_en || display_name_zh;
    this.description = description;
    this.parent_category = parent_category;
    this.sort_order = sort_order;
    this.is_active = is_active;
    this.metadata = metadata;
    this.created_at = created_at || new Date().toISOString();
    this.updated_at = updated_at || new Date().toISOString();
    this.created_by = created_by;
    this.updated_by = updated_by;
    
    // 运行时计算字段
    this.children = [];
    this.knowledge_count = 0;
    this.level = 0;
  }

  /**
   * 验证分类数据
   */
  validate() {
    const errors = [];

    if (!this.display_name_zh || this.display_name_zh.trim() === '') {
      errors.push('中文显示名称不能为空');
    }

    const validTypes = ['operation-procedure', 'device-api'];
    if (!validTypes.includes(this.knowledge_type)) {
      errors.push(`知识类型必须是以下之一: ${validTypes.join(', ')}`);
    }

    if (this.sort_order < 0 || this.sort_order > 999) {
      errors.push('排序权重必须在0-999之间');
    }

    if (this.display_name_zh.length > 50) {
      errors.push('中文显示名称不能超过50个字符');
    }

    if (this.display_name_en && this.display_name_en.length > 100) {
      errors.push('英文显示名称不能超过100个字符');
    }

    if (this.description.length > 500) {
      errors.push('描述不能超过500个字符');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 更新分类信息
   */
  update(updates) {
    const allowedFields = [
      'display_name_zh', 'display_name_en', 'description',
      'parent_category', 'sort_order', 'is_active', 'metadata'
    ];

    allowedFields.forEach(field => {
      if (updates.hasOwnProperty(field)) {
        this[field] = updates[field];
      }
    });

    this.updated_at = new Date().toISOString();
    if (updates.updated_by) {
      this.updated_by = updates.updated_by;
    }
  }

  /**
   * 添加子分类
   */
  addChild(childCategory) {
    if (!this.children.some(child => child.category_id === childCategory.category_id)) {
      childCategory.level = this.level + 1;
      this.children.push(childCategory);
      this.sortChildren();
    }
  }

  /**
   * 移除子分类
   */
  removeChild(categoryId) {
    this.children = this.children.filter(child => child.category_id !== categoryId);
  }

  /**
   * 对子分类排序
   */
  sortChildren() {
    this.children.sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.display_name_zh.localeCompare(b.display_name_zh);
    });
  }

  /**
   * 获取所有子分类ID（递归）
   */
  getAllChildrenIds() {
    const ids = [];
    
    const traverse = (category) => {
      category.children.forEach(child => {
        ids.push(child.category_id);
        traverse(child);
      });
    };
    
    traverse(this);
    return ids;
  }

  /**
   * 获取分类路径
   */
  getPath() {
    const path = [];
    let current = this;
    
    while (current) {
      path.unshift({
        id: current.category_id,
        name_zh: current.display_name_zh,
        name_en: current.display_name_en
      });
      
      // 这里需要在实际使用时传入父分类对象
      current = null; // 简化实现
    }
    
    return path;
  }

  /**
   * 检查是否可以作为父分类
   */
  canBeParentOf(childCategory) {
    // 不能将自己作为父分类
    if (this.category_id === childCategory.category_id) {
      return false;
    }

    // 不能将后代分类作为父分类（避免循环引用）
    const childrenIds = this.getAllChildrenIds();
    if (childrenIds.includes(childCategory.category_id)) {
      return false;
    }

    // 必须是同一知识类型
    if (this.knowledge_type !== childCategory.knowledge_type) {
      return false;
    }

    return true;
  }

  /**
   * 设置知识条目计数
   */
  setKnowledgeCount(count) {
    this.knowledge_count = count;
  }

  /**
   * 创建显示用的完整名称
   */
  getFullDisplayName(language = 'zh') {
    const name = language === 'zh' ? this.display_name_zh : this.display_name_en;
    if (this.level > 0) {
      return `${'　'.repeat(this.level)}${name}`;
    }
    return name;
  }

  /**
   * 转换为JSON对象
   */
  toJSON() {
    return {
      category_id: this.category_id,
      knowledge_type: this.knowledge_type,
      display_name_zh: this.display_name_zh,
      display_name_en: this.display_name_en,
      description: this.description,
      parent_category: this.parent_category,
      sort_order: this.sort_order,
      is_active: this.is_active,
      metadata: this.metadata,
      created_at: this.created_at,
      updated_at: this.updated_at,
      created_by: this.created_by,
      updated_by: this.updated_by,
      // 运行时字段
      children: this.children.map(child => child.toJSON()),
      knowledge_count: this.knowledge_count,
      level: this.level
    };
  }

  /**
   * 从JSON对象创建分类实例
   */
  static fromJSON(json) {
    const category = new Category(json);
    
    // 恢复子分类
    if (json.children && Array.isArray(json.children)) {
      category.children = json.children.map(childJson => Category.fromJSON(childJson));
    }
    
    category.knowledge_count = json.knowledge_count || 0;
    category.level = json.level || 0;
    
    return category;
  }

  /**
   * 创建默认的运维处置分类
   */
  static createDefaultOperationCategories() {
    const categories = [
      // 一级分类
      {
        category_id: 'system_performance',
        knowledge_type: 'operation-procedure',
        display_name_zh: '系统性能',
        display_name_en: 'System Performance',
        description: 'CPU、内存、磁盘IO等性能问题的处置方案',
        sort_order: 100
      },
      {
        category_id: 'network_connectivity',
        knowledge_type: 'operation-procedure',
        display_name_zh: '网络连接',
        display_name_en: 'Network Connectivity',
        description: '网络中断、延迟、配置问题的处置方案',
        sort_order: 200
      },
      {
        category_id: 'security_incidents',
        knowledge_type: 'operation-procedure',
        display_name_zh: '安全事件',
        display_name_en: 'Security Incidents',
        description: '安全漏洞、攻击响应、权限问题的处置方案',
        sort_order: 300
      },
      {
        category_id: 'service_availability',
        knowledge_type: 'operation-procedure',
        display_name_zh: '服务可用性',
        display_name_en: 'Service Availability',
        description: '应用服务故障、依赖失效的处置方案',
        sort_order: 400
      },
      {
        category_id: 'data_integrity',
        knowledge_type: 'operation-procedure',
        display_name_zh: '数据完整性',
        display_name_en: 'Data Integrity',
        description: '数据库问题、备份恢复的处置方案',
        sort_order: 500
      },
      {
        category_id: 'infrastructure_maintenance',
        knowledge_type: 'operation-procedure',
        display_name_zh: '基础设施维护',
        display_name_en: 'Infrastructure Maintenance',
        description: '硬件维护、系统更新的处置方案',
        sort_order: 600
      },

      // 二级分类 - 系统性能
      {
        category_id: 'system_performance_cpu',
        knowledge_type: 'operation-procedure',
        display_name_zh: 'CPU使用率异常',
        display_name_en: 'CPU Usage Issues',
        description: 'CPU使用率过高或异常的处置方案',
        parent_category: 'system_performance',
        sort_order: 110
      },
      {
        category_id: 'system_performance_memory',
        knowledge_type: 'operation-procedure',
        display_name_zh: '内存不足',
        display_name_en: 'Memory Shortage',
        description: '内存使用率过高或不足的处置方案',
        parent_category: 'system_performance',
        sort_order: 120
      },
      {
        category_id: 'system_performance_disk',
        knowledge_type: 'operation-procedure',
        display_name_zh: '磁盘空间/IO问题',
        display_name_en: 'Disk Space/IO Issues',
        description: '磁盘空间不足或IO性能问题的处置方案',
        parent_category: 'system_performance',
        sort_order: 130
      },
      {
        category_id: 'system_performance_load',
        knowledge_type: 'operation-procedure',
        display_name_zh: '系统负载过高',
        display_name_en: 'High System Load',
        description: '系统负载过高的处置方案',
        parent_category: 'system_performance',
        sort_order: 140
      }
    ];

    return categories.map(data => new Category(data));
  }

  /**
   * 创建默认的设备API分类
   */
  static createDefaultDeviceAPICategories() {
    const categories = [
      // 一级分类
      {
        category_id: 'database_systems',
        knowledge_type: 'device-api',
        display_name_zh: '数据库系统',
        display_name_en: 'Database Systems',
        description: '各类数据库管理API接口文档',
        sort_order: 100
      },
      {
        category_id: 'network_devices',
        knowledge_type: 'device-api',
        display_name_zh: '网络设备',
        display_name_en: 'Network Devices',
        description: '交换机、路由器、防火墙API接口文档',
        sort_order: 200
      },
      {
        category_id: 'server_hardware',
        knowledge_type: 'device-api',
        display_name_zh: '服务器硬件',
        display_name_en: 'Server Hardware',
        description: '服务器监控、管理API接口文档',
        sort_order: 300
      },
      {
        category_id: 'storage_systems',
        knowledge_type: 'device-api',
        display_name_zh: '存储系统',
        display_name_en: 'Storage Systems',
        description: '存储设备管理API接口文档',
        sort_order: 400
      },
      {
        category_id: 'virtualization',
        knowledge_type: 'device-api',
        display_name_zh: '虚拟化平台',
        display_name_en: 'Virtualization',
        description: '虚拟机、容器管理API接口文档',
        sort_order: 500
      },
      {
        category_id: 'monitoring_tools',
        knowledge_type: 'device-api',
        display_name_zh: '监控工具',
        display_name_en: 'Monitoring Tools',
        description: '监控系统集成API接口文档',
        sort_order: 600
      },

      // 二级分类 - 数据库系统
      {
        category_id: 'database_systems_backup',
        knowledge_type: 'device-api',
        display_name_zh: '备份管理',
        display_name_en: 'Backup Management',
        description: '数据库备份管理API接口',
        parent_category: 'database_systems',
        sort_order: 110
      },
      {
        category_id: 'database_systems_performance',
        knowledge_type: 'device-api',
        display_name_zh: '性能优化',
        display_name_en: 'Performance Tuning',
        description: '数据库性能优化API接口',
        parent_category: 'database_systems',
        sort_order: 120
      },
      {
        category_id: 'database_systems_security',
        knowledge_type: 'device-api',
        display_name_zh: '安全管理',
        display_name_en: 'Security Management',
        description: '数据库安全管理API接口',
        parent_category: 'database_systems',
        sort_order: 130
      },
      {
        category_id: 'database_systems_maintenance',
        knowledge_type: 'device-api',
        display_name_zh: '维护操作',
        display_name_en: 'Maintenance Operations',
        description: '数据库维护操作API接口',
        parent_category: 'database_systems',
        sort_order: 140
      }
    ];

    return categories.map(data => new Category(data));
  }
}

export default Category;