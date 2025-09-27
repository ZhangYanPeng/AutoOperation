# 智能运维助手 - API文档

## 概述

智能运维助手提供RESTful API接口，支持会话管理、知识库检索、工具执行等功能。

**Base URL**: `http://localhost:3000/api/v1`

**认证方式**: 暂无（开发阶段）

**响应格式**: JSON

## 通用响应格式

所有API接口都遵循统一的响应格式：

```json
{
  "success": true,
  "data": {
    // 具体响应数据
  },
  "error": "错误信息",
  "message": "操作提示信息"
}
```

## 错误处理

### HTTP状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

### 错误响应示例

```json
{
  "success": false,
  "error": "参数验证失败",
  "message": "问题分类和问题描述不能为空",
  "timestamp": "2024-01-15T10:00:00Z",
  "path": "/api/v1/session",
  "method": "POST"
}
```

## 会话管理 API

### 1. 创建新会话

**接口**: `POST /session`

**描述**: 创建新的问题处置会话

**请求参数**:
```json
{
  "problemCategory": "performance",
  "problemDescription": "服务器CPU使用率持续超过90%，系统响应缓慢",
  "userId": "user123"
}
```

**参数说明**:
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| problemCategory | string | 是 | 问题分类 |
| problemDescription | string | 是 | 问题描述 |
| userId | string | 否 | 用户ID |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "session": {
      "session_id": "sess_123456",
      "problem_category": "performance",
      "problem_description": "服务器CPU使用率持续超过90%，系统响应缓慢",
      "status": "processing",
      "created_at": "2024-01-15T10:00:00Z",
      "steps": [
        {
          "step_id": "step_001",
          "step_order": 1,
          "step_type": "manual",
          "step_content": "检查当前CPU使用率情况",
          "execution_status": "pending"
        }
      ],
      "progress": {
        "total_steps": 5,
        "completed_steps": 0,
        "current_step": "step_001"
      }
    },
    "initialPlan": {
      "analysis": "系统分析结果...",
      "stepsGenerated": 5
    }
  }
}
```

### 2. 获取会话详情

**接口**: `GET /session/{sessionId}`

**参数**:
- `sessionId`: 会话ID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "session_id": "sess_123456",
    "problem_category": "performance",
    "status": "processing",
    "steps": [],
    "progress": {
      "total_steps": 5,
      "completed_steps": 2,
      "percentage": 40
    }
  }
}
```

### 3. 执行处置步骤

**接口**: `POST /session/{sessionId}/step`

**请求参数**:
```json
{
  "stepId": "step_001",
  "executionType": "manual",
  "userInput": "CPU使用率确实很高，主要是java进程占用"
}
```

**参数说明**:
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| stepId | string | 是 | 步骤ID |
| executionType | string | 是 | 执行类型：auto/manual |
| userInput | string | 否 | 用户输入（manual类型必需） |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "step": {
      "step_id": "step_001",
      "execution_status": "completed",
      "execution_result": {
        "success": true,
        "userFeedback": "CPU使用率确实很高，主要是java进程占用"
      }
    },
    "nextStep": {
      "step_id": "step_002",
      "step_content": "识别占用CPU最高的Java进程"
    }
  }
}
```

### 4. 提供用户反馈

**接口**: `POST /session/{sessionId}/feedback`

**请求参数**:
```json
{
  "stepId": "step_001",
  "feedback": "这个步骤遇到了权限问题，无法执行"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "step": {
      "step_id": "step_001",
      "user_feedback": "这个步骤遇到了权限问题，无法执行"
    },
    "planUpdate": {
      "newSteps": [
        {
          "step_id": "step_006",
          "step_content": "使用sudo权限重新执行命令"
        }
      ]
    }
  }
}
```

### 5. 获取会话状态

**接口**: `GET /session/{sessionId}/status`

**响应示例**:
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_123456",
    "overallStatus": "processing",
    "progress": {
      "total": 5,
      "completed": 2,
      "failed": 0,
      "percentage": 40
    },
    "currentStep": {
      "step_id": "step_003",
      "step_content": "分析进程资源使用情况"
    },
    "nextStep": {
      "step_id": "step_004",
      "step_content": "制定优化方案"
    }
  }
}
```

### 6. 完成会话

**接口**: `POST /session/{sessionId}/complete`

**请求参数**:
```json
{
  "summary": "问题已解决，CPU使用率恢复正常"
}
```

### 7. 删除会话

**接口**: `DELETE /session/{sessionId}`

### 8. 获取会话列表

**接口**: `GET /session`

**查询参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| userId | string | 用户ID过滤 |
| limit | integer | 返回数量限制 |
| offset | integer | 分页偏移量 |
| search | string | 搜索关键词 |
| category | string | 问题分类过滤 |
| status | string | 状态过滤 |

## 知识库 API

### 1. 搜索知识库

**接口**: `GET /knowledge/search`

**查询参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| query | string | 搜索关键词 |
| type | string | 知识类型：all/operation-procedure/device-api |
| category | string | 分类过滤 |
| limit | integer | 返回数量限制 |
| minScore | float | 最小相关性分数 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "query": "CPU高使用率",
    "total": 3,
    "results": [
      {
        "knowledge_id": "kb_001",
        "title": "服务器高CPU使用率问题处置",
        "type": "operation-procedure",
        "category": "performance",
        "summary": "服务器CPU使用率持续超过80%的诊断和处置方法...",
        "score": 0.95,
        "relevance": 0.87,
        "usage_count": 15
      }
    ]
  }
}
```

### 2. 获取知识条目详情

**接口**: `GET /knowledge/{knowledgeId}`

### 3. 按分类获取知识

**接口**: `GET /knowledge/category/{category}`

### 4. 获取推荐知识

**接口**: `GET /knowledge/recommendations/{category?}`

## 工具管理 API

### 1. 获取可用工具列表

**接口**: `GET /tools/list`

**响应示例**:
```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "id": "tool_001",
        "title": "服务器监控API",
        "method": "GET",
        "path": "/api/system/info",
        "description": "获取服务器基本信息",
        "parameters": [
          {
            "name": "detail",
            "type": "boolean",
            "description": "是否返回详细信息",
            "required": false
          }
        ],
        "usage_count": 25
      }
    ],
    "total": 10
  }
}
```

### 2. 执行工具

**接口**: `POST /tools/execute`

**请求参数**:
```json
{
  "apiId": "tool_001",
  "parameters": {
    "detail": true
  },
  "options": {
    "timeout": 30000
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "statusCode": 200,
    "data": {
      "hostname": "server-001",
      "cpu": {
        "usage": 45.2,
        "cores": 4
      }
    },
    "duration": 1205,
    "apiDefinition": {
      "id": "tool_001",
      "title": "服务器监控API"
    }
  }
}
```

### 3. 获取工具详情

**接口**: `GET /tools/{apiId}`

### 4. 测试工具连接

**接口**: `POST /tools/{apiId}/test`

### 5. 获取执行历史

**接口**: `GET /tools/history/{apiId?}`

## 系统状态 API

### 1. 健康检查

**接口**: `GET /health`

**响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00Z",
  "version": "1.0.0",
  "services": {
    "llm": true,
    "knowledge": true,
    "tools": true,
    "sessions": true
  }
}
```

### 2. 系统状态

**接口**: `GET /status`

**响应示例**:
```json
{
  "timestamp": "2024-01-15T10:00:00Z",
  "services": {
    "llm": {
      "initialized": true,
      "provider": "ollama",
      "model": "llama2"
    },
    "knowledge": {
      "total_entries": 50,
      "by_type": {
        "operation-procedure": 30,
        "device-api": 20
      }
    },
    "tools": {
      "initialized": true,
      "loadedAPIs": 15
    },
    "sessions": {
      "initialized": true,
      "sessions_in_memory": 25
    }
  }
}
```

## 使用示例

### 完整的会话处理流程

```javascript
// 1. 创建会话
const session = await fetch('/api/v1/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    problemCategory: 'performance',
    problemDescription: 'CPU使用率过高'
  })
});

// 2. 执行步骤
const stepResult = await fetch(`/api/v1/session/${sessionId}/step`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    stepId: 'step_001',
    executionType: 'manual',
    userInput: '已确认CPU使用率为95%'
  })
});

// 3. 获取状态
const status = await fetch(`/api/v1/session/${sessionId}/status`);
```

## 限流和配额

- **请求频率限制**: 每IP每15分钟最多100个请求
- **并发连接**: 每IP最多10个并发连接
- **响应超时**: 30秒
- **请求体大小**: 最大10MB

## 版本控制

当前API版本：**v1**

所有API接口都在 `/api/v1/` 路径下，未来版本会保持向后兼容。

## 错误排查

### 常见错误

1. **400 参数验证失败**: 检查请求参数格式和必需字段
2. **404 资源不存在**: 确认会话ID或资源ID是否正确
3. **500 服务器错误**: 检查后端服务状态和日志

### 调试建议

1. 使用 `/health` 接口检查服务状态
2. 查看响应中的详细错误信息
3. 检查请求头和内容类型设置
4. 确认API版本和路径正确

## SDK和工具

### JavaScript/TypeScript
```javascript
import { apiClient } from './utils/api'

// 创建会话
const session = await apiClient.createSession({
  problemCategory: 'performance',
  problemDescription: 'CPU高使用率问题'
});
```

### cURL示例
```bash
# 创建会话
curl -X POST http://localhost:3000/api/v1/session \
  -H "Content-Type: application/json" \
  -d '{"problemCategory":"performance","problemDescription":"CPU高使用率"}'

# 搜索知识库
curl -X GET "http://localhost:3000/api/v1/knowledge/search?query=CPU&type=operation-procedure"
```