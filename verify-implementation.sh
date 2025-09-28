#!/bin/bash

# 知识库分类优化系统验证脚本

echo "======================================"
echo "知识库分类优化系统验证"
echo "======================================"

# 检查核心文件是否存在
echo "1. 检查核心模型文件..."

files=(
    "backend/src/models/Category.js"
    "backend/src/services/CategoryService.js"
    "backend/src/services/TroubleKnowledgeService.js"
    "backend/src/services/DeviceAPIService.js"
    "backend/src/services/SearchRouterService.js"
    "backend/src/controllers/categoryController.js"
    "backend/src/controllers/searchController.js"
    "frontend/src/components/CategoryManagement.tsx"
    "frontend/src/pages/KnowledgeManagePage.tsx"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file - 存在"
    else
        echo "❌ $file - 缺失"
    fi
done

echo ""
echo "2. 检查后端文件结构..."

# 检查后端目录结构
backend_dirs=(
    "backend/src/models"
    "backend/src/services"
    "backend/src/controllers"
)

for dir in "${backend_dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir - 目录存在"
        echo "   文件列表:"
        ls -la "$dir" | grep -E '\.(js|ts)$' | awk '{print "     " $9}'
    else
        echo "❌ $dir - 目录缺失"
    fi
done

echo ""
echo "3. 检查前端文件结构..."

frontend_dirs=(
    "frontend/src/components"
    "frontend/src/pages"
)

for dir in "${frontend_dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir - 目录存在"
        echo "   React组件文件:"
        ls -la "$dir" | grep -E '\.(tsx|jsx)$' | awk '{print "     " $9}'
    else
        echo "❌ $dir - 目录缺失"
    fi
done

echo ""
echo "4. 功能特性验证..."

# 检查分类模型功能
echo "检查分类模型功能特性:"
if grep -q "createDefaultOperationCategories" backend/src/models/Category.js; then
    echo "✅ 默认运维处置分类支持"
else
    echo "❌ 缺失默认运维处置分类"
fi

if grep -q "createDefaultDeviceAPICategories" backend/src/models/Category.js; then
    echo "✅ 默认设备API分类支持"
else
    echo "❌ 缺失默认设备API分类"
fi

if grep -q "validate" backend/src/models/Category.js; then
    echo "✅ 分类数据验证功能"
else
    echo "❌ 缺失分类数据验证"
fi

# 检查分类服务功能
echo ""
echo "检查分类服务功能特性:"
if grep -q "createCategory" backend/src/services/CategoryService.js; then
    echo "✅ 分类创建功能"
else
    echo "❌ 缺失分类创建功能"
fi

if grep -q "updateCategory" backend/src/services/CategoryService.js; then
    echo "✅ 分类更新功能"
else
    echo "❌ 缺失分类更新功能"
fi

if grep -q "buildHierarchy" backend/src/services/CategoryService.js; then
    echo "✅ 层级结构管理"
else
    echo "❌ 缺失层级结构管理"
fi

if grep -q "searchCategories" backend/src/services/CategoryService.js; then
    echo "✅ 分类搜索功能"
else
    echo "❌ 缺失分类搜索功能"
fi

# 检查API控制器
echo ""
echo "检查API控制器功能:"
if grep -q "router.get.*type.*knowledgeType" backend/src/controllers/categoryController.js; then
    echo "✅ 按类型获取分类API"
else
    echo "❌ 缺失按类型获取分类API"
fi

if grep -q "router.post.*/" backend/src/controllers/categoryController.js; then
    echo "✅ 创建分类API"
else
    echo "❌ 缺失创建分类API"
fi

if grep -q "router.put.*:id" backend/src/controllers/categoryController.js; then
    echo "✅ 更新分类API"
else
    echo "❌ 缺失更新分类API"
fi

# 检查前端组件
echo ""
echo "检查前端组件功能:"
if grep -q "CategoryManagement" frontend/src/components/CategoryManagement.tsx; then
    echo "✅ 分类管理组件"
else
    echo "❌ 缺失分类管理组件"
fi

if grep -q "operation-procedure\|device-api" frontend/src/components/CategoryManagement.tsx; then
    echo "✅ 双类型知识库支持"
else
    echo "❌ 缺失双类型知识库支持"
fi

if grep -q "handleCreateCategory" frontend/src/components/CategoryManagement.tsx; then
    echo "✅ 前端分类创建功能"
else
    echo "❌ 缺失前端分类创建功能"
fi

echo ""
echo "5. 检查配置文件..."

# 检查路由配置
if grep -q "categoryRoutes" backend/src/app.js; then
    echo "✅ 分类路由已注册"
else
    echo "❌ 分类路由未注册"
fi

if grep -q "categoryService" backend/src/app.js; then
    echo "✅ 分类服务已集成"
else
    echo "❌ 分类服务未集成"
fi

echo ""
echo "======================================"
echo "验证完成"
echo "======================================"

# 统计
total_files=0
existing_files=0

for file in "${files[@]}"; do
    total_files=$((total_files + 1))
    if [ -f "$file" ]; then
        existing_files=$((existing_files + 1))
    fi
done

echo "文件完整性: $existing_files/$total_files"

# 创建启动指南
echo ""
echo "启动指南:"
echo "1. 安装后端依赖: cd backend && npm install"
echo "2. 安装前端依赖: cd frontend && npm install"
echo "3. 启动后端服务: cd backend && npm start"
echo "4. 启动前端服务: cd frontend && npm run dev"
echo "5. 访问分类管理: http://localhost:3000/knowledge-manage"
echo "6. API测试地址: http://localhost:3001/api/v1"
echo ""
echo "新增功能测试:"
echo "- 智能搜索: curl 'http://localhost:3001/api/v1/search?q=CPU性能问题'"
echo "- 故障诊断: curl -X POST http://localhost:3001/api/v1/search/diagnose -d '{\"symptoms\":\"系统响应慢\"}'"
echo "- API搜索: curl 'http://localhost:3001/api/v1/search/api-endpoint?method=GET&path=/api/users'"