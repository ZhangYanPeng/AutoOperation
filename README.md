# 智能运维助手

基于大语言模型的智能化运维处置系统，提供人机协作的渐进式问题处置流程。

## 功能特性

- 🤖 **智能问题诊断**：基于大模型分析运维问题现象，生成结构化处置方案
- 📋 **渐进式处置引导**：按步骤引导用户完成问题处置，支持反馈循环优化
- ⚡ **自动化执行**：对具备API支持的处置步骤实现自动执行
- 📚 **知识库驱动**：基于运维经验知识库和设备操作API库提供智能决策
- 🔧 **工具集成**：支持多种外部工具和API的统一调用
- 💬 **交互式界面**：提供友好的Web界面，支持实时问答和步骤执行

## 技术栈

### 前端
- React 18 + TypeScript
- Vite (构建工具)
- Zustand (状态管理)
- Axios (HTTP客户端)

### 后端
- Node.js 18+ + Express
- Winston (日志管理)
- 内存 + 文件存储

### AI/大模型
- 支持多种大模型配置
- 本地部署 (Ollama) 或远程API
- LangChain (可选集成)

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 8.0.0

### 安装
```bash
# 安装所有依赖
npm run install:all

# 或分别安装
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 开发模式
```bash
# 同时启动前后端开发服务
npm run dev

# 或分别启动
npm run dev:backend   # 后端: http://localhost:3000
npm run dev:frontend  # 前端: http://localhost:5173
```

### 生产构建
```bash
npm run build
```

### 测试
```bash
npm test
```

## 项目结构

```
intelligent-operation-assistant/
├── backend/                # 后端服务
│   ├── src/
│   │   ├── controllers/    # 控制器层
│   │   ├── services/       # 业务逻辑层
│   │   ├── models/         # 数据模型
│   │   ├── middleware/     # 中间件
│   │   └── utils/          # 工具函数
│   └── tests/              # 后端测试
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # React组件
│   │   ├── stores/         # 状态管理
│   │   ├── utils/          # 工具函数
│   │   └── types/          # TypeScript类型定义
├── knowledge-base/         # 知识库
│   ├── operation-procedures/ # 运维处置知识库
│   └── device-apis/        # 设备操作API知识库
├── configs/                # 配置文件
├── docs/                   # 项目文档
└── tests/                  # 集成测试
```

## 配置

### 大模型配置
在 `configs/llm-config.json` 中配置大模型相关参数:

```json
{
  "provider": "ollama",
  "models": {
    "primary": "llama2",
    "fallback": "qwen"
  },
  "endpoints": {
    "ollama": "http://localhost:11434"
  }
}
```

### 系统配置
在 `configs/app-config.json` 中配置系统参数。

## API文档

详细API文档请参考 [docs/api.md](docs/api.md)

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情