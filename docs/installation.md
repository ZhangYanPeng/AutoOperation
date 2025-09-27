# 智能运维助手 - 安装指南

## 系统要求

### 环境依赖
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **Git**: 最新版本
- **操作系统**: Linux, macOS, Windows

### 推荐配置
- **CPU**: 4核心以上
- **内存**: 8GB以上
- **磁盘空间**: 10GB以上可用空间
- **网络**: 稳定的互联网连接（用于大模型API调用）

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd AutoOperation
```

### 2. 安装依赖

```bash
# 安装所有依赖（根目录、后端、前端）
npm run install:all

# 或分别安装
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 3. 配置环境

#### 后端配置

1. 复制环境变量模板：
```bash
cd backend
cp .env.example .env
```

2. 编辑 `.env` 文件，配置必要参数：
```bash
# 服务器配置
PORT=3000
NODE_ENV=development

# 前端URL
FRONTEND_URL=http://localhost:5173

# 大模型配置
LLM_PROVIDER=ollama
LLM_ENDPOINT=http://localhost:11434
LLM_MODEL=llama2

# 其他配置...
```

#### 前端配置

1. 复制环境变量模板：
```bash
cd frontend
cp .env.example .env
```

2. 编辑 `.env` 文件：
```bash
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### 4. 配置大模型

#### 选项1: 使用本地Ollama（推荐）

1. 安装Ollama：
```bash
# Linux/macOS
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# 下载并安装：https://ollama.ai/download
```

2. 下载模型：
```bash
ollama pull llama2
ollama pull qwen2
```

3. 启动Ollama服务：
```bash
ollama serve
```

#### 选项2: 使用OpenAI API

1. 获取OpenAI API密钥
2. 在 `configs/llm-config.json` 中配置：
```json
{
  "active_provider": "openai",
  "providers": {
    "openai": {
      "api_key": "your-api-key-here",
      "enabled": true
    }
  }
}
```

### 5. 启动服务

#### 开发模式（推荐）

```bash
# 在项目根目录，同时启动前后端
npm run dev

# 或分别启动
npm run dev:backend   # 后端: http://localhost:3000
npm run dev:frontend  # 前端: http://localhost:5173
```

#### 生产模式

```bash
# 构建项目
npm run build

# 启动后端服务
npm run start
```

### 6. 验证安装

1. 访问前端应用：http://localhost:5173
2. 检查后端健康状态：http://localhost:3000/health
3. 查看系统状态：http://localhost:3000/status

## 详细配置

### 大模型配置

编辑 `configs/llm-config.json` 文件：

```json
{
  "version": "1.0.0",
  "active_provider": "ollama",
  "providers": {
    "ollama": {
      "name": "Ollama",
      "type": "local",
      "endpoint": "http://localhost:11434",
      "models": {
        "primary": "llama2",
        "fallback": "qwen2"
      },
      "parameters": {
        "temperature": 0.7,
        "max_tokens": 2048,
        "top_p": 0.9,
        "timeout": 30000
      },
      "enabled": true
    }
  }
}
```

### 应用配置

编辑 `configs/app-config.json` 文件：

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "session_management": {
    "enable_file_storage": true,
    "auto_save": true,
    "max_sessions_in_memory": 1000
  },
  "tool_execution": {
    "timeout": 30000,
    "max_retries": 3
  }
}
```

### 知识库配置

知识库文件位于 `knowledge-base/` 目录：

```
knowledge-base/
├── operation-procedures/    # 运维处置知识库
│   ├── cpu-high-usage.md
│   ├── memory-shortage.md
│   └── network-issues.md
└── device-apis/            # 设备操作API知识库
    ├── server-monitoring-api.md
    ├── network-device-api.apib
    └── database-management-api.md
```

## 常见问题

### Q: 大模型服务连接失败

**A**: 检查以下配置：
1. 确认Ollama服务正在运行：`curl http://localhost:11434/api/tags`
2. 检查模型是否已下载：`ollama list`
3. 验证网络连接和防火墙设置

### Q: 前端无法连接后端

**A**: 检查以下设置：
1. 后端服务是否正常启动：`curl http://localhost:3000/health`
2. 前端环境变量配置是否正确
3. CORS设置是否允许前端域名

### Q: 知识库搜索结果为空

**A**: 确认以下事项：
1. 知识库文档是否正确放置在 `knowledge-base/` 目录
2. 文档格式是否符合要求（Markdown或API Blueprint）
3. 重启后端服务以重新加载知识库

### Q: 性能优化建议

**A**: 考虑以下优化：
1. 使用本地Ollama提升响应速度
2. 调整会话缓存大小和TTL
3. 优化知识库文档数量和质量
4. 配置适当的日志级别

## 开发环境设置

### 代码风格

使用ESLint和Prettier保持代码一致性：

```bash
# 后端
cd backend
npm run lint
npm run lint:fix

# 前端
cd frontend
npm run lint
npm run lint:fix
```

### 测试

```bash
# 运行所有测试
npm test

# 分别运行测试
npm run test:backend
npm run test:frontend

# 生成测试覆盖率报告
npm run test:coverage
```

### 调试

#### 后端调试
```bash
cd backend
npm run dev
# 服务将在调试模式下启动，支持热重载
```

#### 前端调试
```bash
cd frontend
npm run dev
# 前端将在开发模式下启动，支持热重载和源码映射
```

## 生产部署

### 使用Docker（推荐）

```bash
# 构建镜像
docker build -t intelligent-operation-assistant .

# 运行容器
docker run -d \
  --name iot-assistant \
  -p 3000:3000 \
  -p 5173:5173 \
  -v ./configs:/app/configs \
  -v ./knowledge-base:/app/knowledge-base \
  intelligent-operation-assistant
```

### 传统部署

```bash
# 构建生产版本
npm run build

# 使用PM2管理进程
npm install -g pm2
pm2 start backend/src/app.js --name "iot-assistant"

# 配置Nginx反向代理（可选）
```

## 技术支持

如果遇到问题，请：

1. 查看日志文件：`backend/logs/`
2. 检查系统状态：http://localhost:3000/status
3. 参考API文档：[docs/api.md](./api.md)
4. 提交Issue到项目仓库

## 下一步

- 阅读 [API文档](./api.md) 了解接口详情
- 查看 [用户手册](./user-guide.md) 学习系统使用
- 参考 [开发指南](./development.md) 进行二次开发