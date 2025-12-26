
# API 参考

<cite>
**本文档引用的文件**
- [sessionController.js](file://backend/src/controllers/sessionController.js)
- [knowledgeController.js](file://backend/src/controllers/knowledgeController.js)
- [toolController.js](file://backend/src/controllers/toolController.js)
- [SessionManagementService.js](file://backend/src/services/SessionManagementService.js)
- [KnowledgeBaseService.js](file://backend/src/services/KnowledgeBaseService.js)
- [ToolExecutionService.js](file://backend/src/services/ToolExecutionService.js)
- [validation.js](file://backend/src/middleware/validation.js)
- [security.js](file://backend/src/middleware/security.js)
- [app.js](file://backend/src/app.js)
</cite>

## 目录
1. [简介](#简介)
2. [会话管理控制器](#会话管理控制器)
3. [知识检索控制器](#知识检索控制器)
4. [工具调用控制器](#工具调用控制器)
5. [身份验证机制](#身份验证机制)
6. [速率限制策略](#速率限制策略)
7. [版本控制方案](#版本控制方案)
8. [API 调用示例](#api-调用示例)

## 简介
本API参考文档详细描述了智能运维助手应用程序的RESTful接口，涵盖会话管理、知识检索和工具调用三大核心功能模块。所有API均通过`/api/v1`前缀访问，采用JSON格式进行请求和响应。系统实现了全面的输入验证、错误处理和安全防护机制，确保服务的稳定性和安全性。

**Section sources**
- [app.js](file://backend/src/app.js#L1-L148)

## 会话管理控制器

### 创建新会话
创建一个新的问题处置会话，启动问题分析和解决方案生成流程。

- **HTTP方法**: `POST`
- **URL路径**: `/api/v1/session`
- **请求头**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>` (如启用认证)
- **请求体结构**:
```json
{
  "problem_category": "performance|network|service|security|storage|other",
  "problem_description": "string (10-2000字符)",
  "userId": "string (可选)"
}
```
- **查询参数**: 无
- **成功响应格式** (`201 Created`):
```json
{
  "success": true,
  "data": {
    "session": {
      "session_id": "uuid",
      "problem_category": "string",
      "problem_description": "string",
      "status": "processing",
      "created_at": "datetime",
      "updated_at": "datetime",
      "user_id": "string",
      "steps": [],
      "progress": {
        "total_steps": 0,
        "completed_steps": 0,
        "current_step": null
      }
    },
    "initialPlan": {
      "analysis": "string",
      "knowledgeMatches": [],
      "recommendations": [],
      "stepsGenerated": 0
    }
  }
}
```
- **可能的错误码**:
  - `400 Bad Request`: 缺少必需字段或字段验证失败
  - `413 Payload Too Large`: 请求体过大
  - `429 Too Many Requests`: 会话创建频率超限

**Section sources**
- [sessionController.js](file://backend/src/controllers/sessionController.js#L15-L45)
- [validation.js](file://backend/src/middleware/validation.js#L200-L230)
- [security.js](file://backend/src/middleware/security.js#L100-L115)

### 执行处置步骤
执行指定会话中的下一个处置步骤，支持自动和手动两种执行模式。

- **HTTP方法**: `POST`
- **URL路径**: `/api/v1/session/:id/step`
- **请求头**: 
  - `Content-Type: application/json`
- **路径参数**: 
  - `id`: 会话ID (UUID格式)
- **请求体结构**:
```json
{
  "stepId": "string",
  "executionType": "auto|manual",
  "userInput": "string (仅当executionType为manual时必需)"
}
```
- **查询参数**: 无
- **成功响应格式** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "step": {
      "step_id": "uuid",
      "session_id": "uuid",
      "step_order": "number",
      "step_type": "auto|manual|branch|conditional",
      "step_content": "string",
      "tool_api": "string|null",
      "execution_status": "executing|completed|failed",
      "execution_result": {},
      "user_feedback": "string|null",
      "dependencies": [],
      "timeout": "number",
      "retry_count": "number",
      "max_retries": "number",
      "created_at": "datetime",
      "updated_at": "datetime",
      "started_at": "datetime|null",
      "completed_at": "datetime|null",
      "duration": "number|null"
    },
    "executionResult": {},
    "evaluation": {},
    "nextStep": {}
  }
}
```
- **可能的错误码**:
  - `400 Bad Request`: 参数验证失败
  - `404 Not Found`: 会话不存在
  - `422 Unprocessable Entity`: 步骤无法执行

**Section sources**
- [sessionController.js](file://backend/src/controllers/sessionController.js#L47-L78)
- [validation.js](file://backend/src/middleware/validation.js#L232-L255)

### 获取会话详情
获取指定会话的完整信息，包括所有