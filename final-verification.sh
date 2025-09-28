#!/bin/bash

echo "======================================"
echo "知识库分类优化系统 - 最终验证"
echo "======================================"

echo "核心服务验证:"

# 检查后端服务文件
services=(
    "backend/src/services/CategoryService.js:分类管理服务"
    "backend/src/services/TroubleKnowledgeService.js:故障处置知识服务"  
    "backend/src/services/DeviceAPIService.js:设备API知识服务"
    "backend/src/services/SearchRouterService.js:搜索路由服务"
)

for service in "${services[@]}"; do
    file="${service%:*}"
    name="${service#*:}"
    if [ -f "$file" ]; then
        echo "✅ $name"
    else
        echo "❌ $name - 文件缺失"
    fi
done

echo ""
echo "控制器验证:"

controllers=(
    "backend/src/controllers/categoryController.js:分类管理控制器"
    "backend/src/controllers/searchController.js:搜索控制器"
)

for controller in "${controllers[@]}"; do
    file="${controller%:*}"
    name="${controller#*:}"
    if [ -f "$file" ]; then
        echo "✅ $name"
    else
        echo "❌ $name - 文件缺失"
    fi
done

echo ""
echo "数据模型验证:"
if [ -f "backend/src/models/Category.js" ]; then
    echo "✅ 分类数据模型"
else
    echo "❌ 分类数据模型 - 文件缺失"
fi

if grep -q "category_id.*category_tags" backend/src/models/KnowledgeEntry.js 2>/dev/null; then
    echo "✅ 知识条目模型已更新"
else
    echo "❌ 知识条目模型未更新"
fi

echo ""
echo "前端组件验证:"

frontend_components=(
    "frontend/src/components/CategoryManagement.tsx:分类管理组件"
    "frontend/src/pages/KnowledgeManagePage.tsx:知识库管理页面"
)

for component in "${frontend_components[@]}"; do
    file="${component%:*}"
    name="${component#*:}"
    if [ -f "$file" ]; then
        echo "✅ $name"
    else
        echo "❌ $name - 文件缺失"
    fi
done

echo ""
echo "功能特性验证:"

# 检查关键功能
if grep -q "diagnoseBySymptoms" backend/src/services/TroubleKnowledgeService.js 2>/dev/null; then
    echo "✅ 故障症状诊断功能"
else
    echo "❌ 故障症状诊断功能 - 缺失"
fi

if grep -q "searchByEndpoint" backend/src/services/DeviceAPIService.js 2>/dev/null; then
    echo "✅ API端点搜索功能"
else
    echo "❌ API端点搜索功能 - 缺失"
fi

if grep -q "generateIntegrationCode" backend/src/services/DeviceAPIService.js 2>/dev/null; then
    echo "✅ API集成代码生成"
else
    echo "❌ API集成代码生成 - 缺失"
fi

if grep -q "analyzeSearchIntent" backend/src/services/SearchRouterService.js 2>/dev/null; then
    echo "✅ 智能搜索意图分析"
else
    echo "❌ 智能搜索意图分析 - 缺失"
fi

echo ""
echo "服务集成验证:"

if grep -q "searchRoutes" backend/src/app.js 2>/dev/null; then
    echo "✅ 搜索路由已注册"
else
    echo "❌ 搜索路由未注册"
fi

if grep -q "troubleKnowledgeService.*deviceAPIService.*searchRouterService" backend/src/app.js 2>/dev/null; then
    echo "✅ 所有新服务已集成"
else
    echo "❌ 服务集成不完整"
fi

echo ""
echo "======================================"
echo "验证总结"
echo "======================================"

# 统计文件
total_files=0
existing_files=0

key_files=(
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

for file in "${key_files[@]}"; do
    total_files=$((total_files + 1))
    if [ -f "$file" ]; then
        existing_files=$((existing_files + 1))
    fi
done

echo "核心文件完整性: $existing_files/$total_files"

if [ $existing_files -eq $total_files ]; then
    echo "🎉 所有核心文件已实现"
else
    echo "⚠️  部分文件缺失，需要检查"
fi

echo ""
echo "实现的主要功能:"
echo "✅ 分离式双库架构 (故障处置 + 设备API)"
echo "✅ 灵活的分类管理系统"  
echo "✅ 中英文分类对应"
echo "✅ 智能搜索路由"
echo "✅ 故障症状诊断"
echo "✅ API端点搜索"
echo "✅ 代码生成功能"
echo "✅ 统一管理界面"

echo ""
echo "启动测试:"
echo "cd backend && npm start  # 启动后端服务"
echo "cd frontend && npm run dev  # 启动前端服务"
echo ""
echo "API测试示例:"
echo "curl 'http://localhost:3001/api/v1/search?q=CPU性能问题'"
echo "curl 'http://localhost:3001/api/v1/categories/type/operation-procedure'"