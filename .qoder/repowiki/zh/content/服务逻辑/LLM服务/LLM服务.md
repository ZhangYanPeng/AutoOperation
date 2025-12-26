# LLM服务

<cite>
**本文档引用的文件**
- [LLMService.js](file://backend/src/services/LLMService.js)
- [LLMConfigManager.js](file://backend/src/services/LLMConfigManager.js)
- [LLMProvider.js](file://backend/src/services/LLMProvider.js)
- [llm-config.json](file://configs/llm-config.json)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概述](#架构概述)
5. [详细组件分析](#详细组件分析)
6. [依赖分析](#依赖分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)

## 简介
本系统为智能运维助手，其核心是通过大语言模型（LLM）实现自动化问题分析与处置。该文档重点阐述 `LLMService` 如何封装对 Ollama、OpenAI 等多种 LLM 提供商的 API 调用，`LLMConfigManager` 如何动态管理配置和模型参数，以及流式响应处理和提示词工程的具体实践。

## 项目结构
系统采用前后端分离架构，后端使用 Node.js 实现核心服务，前端使用 React 构建用户界面。关键配置文件集中存放在 `configs` 目录下。

```mermaid
graph TD
subgraph "Frontend"
UI[用户界面]
Stores[状态管理]
Hooks[自定义Hook]
end
subgraph "Backend"
Controllers[控制器层]
Services[服务层]
Models[数据模型]
end
UI --> |API调用| Controllers
Controllers --> Services
Services --> |读取| llmConfig[llm-config.json]
Services --> |调用| Providers[Ollama/OpenAI]
```

**Diagram sources**
- [llm-config.json](file://configs/llm-config.json)
- [LLMService.js](file://backend/src/services/LLMService.js)

**Section sources**
- [LLMService.js](file://backend/src/services/LLMService.js)
- [LLMConfigManager.js](file://backend/src/services/LLMConfigManager.js)

## 核心组件
核心功能由 `LLMService`、`LLMConfigManager` 和 `LLMProvider` 三个服务类协同完成。`LLMService` 是业务逻辑的入口，`LLMConfigManager` 负责配置管理，`LLMProvider` 的具体子类则负责与不同 LLM 厂商的 API 进行通信。

**Section sources**
- [LLMService.js](file://backend/src/services/LLMService.js#L9-L366)
- [LLMConfigManager.js](file://backend/src/services/LLMConfigManager.js#L13-L314)
- [LLMProvider.js](file://backend/src/services/LLMProvider.js#L8-L97)

## 架构概述
系统采用分层设计模式，将配置管理、服务封装和底层通信分离，确保了高内聚低耦合。

```mermaid
classDiagram
class LLMService {
+provider : LLMProvider
+cache : Map
+initialize()
+chat(messages, options)
+analyzeProblem()
+generateSteps()
+executeWithRetry()
}
class LLMConfigManager {
+config : Object
+configPath : string
+initialize()
+getResolvedProvider()
+getPromptTemplate()
+switchProvider()
}
class LLMProvider {
<<abstract>>
+name : string
+endpoint : string
+models : Object
+parameters : Object
+chat(messages, options)
+createHttpClient()
+formatMessages()
+mergeParameters()
}
class OllamaProvider {
+chat(messages, options)
}
class OpenAIProvider {
+apiKey : string
+chat(messages, options)
}
LLMService --> LLMConfigManager : "使用"
LLMService --> LLMProvider : "依赖"
LLMProvider <|-- OllamaProvider
LLMProvider <|-- OpenAIProvider
LLMConfigManager ..> LLMService : "被初始化"
```

**Diagram sources**
- [LLMService.js](file://backend/src/services/LLMService.js#L9-L366)
- [LLMConfigManager.js](file://backend/src/services/LLMConfigManager.js#L13-L314)
- [LLMProvider.js](file://backend/src/services/LLMProvider.js#L8-L97)

## 详细组件分析

### LLM服务封装与错误重试机制
`LLMService` 类作为统一的服务接口，封装了所有与 LLM 交互的复杂性。它通过 `executeWithRetry` 方法实现了健壮的错误重试机制。

```mermaid
sequenceDiagram
participant Client as "客户端"
participant Service as "LLMService"
participant Provider as "LLMProvider"
participant Config as "LLMConfigManager"
Client->>Service : analyzeProblem(问题)
Service->>Config : getPromptTemplate('problem_analysis')
Service->>Service : 构造消息数组
loop 重试循环 (最多N次)
Service->>Provider : chat(消息, 参数)
Provider-->>Service : 成功或失败
alt 失败且有重试机会
Service->>Service : 指数退避延迟
end
end
Service-->>Client : 返回结构化结果
```

**Diagram sources**
- [LLMService.js](file://backend/src/services/LLMService.js#L128-L147)
- [LLMService.js](file://backend/src/services/LLMService.js#L178-L214)

**Section sources**
- [LLMService.js](file://backend/src/services/LLMService.js#L128-L147)

### 配置管理与动态参数切换
`LLMConfigManager` 负责加载和管理 `llm-config.json` 文件，支持动态切换提供商和解析环境变量。

```mermaid
flowchart TD
Start([开始]) --> Load["加载 llm-config.json"]
Load --> Validate["验证配置有效性"]
Validate --> Resolve["解析环境变量占位符<br/>如 ${OPENAI_API_KEY}"]
Resolve --> Provide["提供已解析的配置<br/>给 LLMService"]
subgraph "动态切换"
Switch["switchProvider('openai')"] --> Update["更新 active_provider"]
Update --> Save["保存到文件"]
Save --> Reload["重新加载配置"]
Reload --> Apply["新配置生效"]
end
Provide --> Switch
```

**Diagram sources**
- [LLMConfigManager.js](file://backend/src/services/LLMConfigManager.js#L13-L314)
- [llm-config.json](file://configs/llm-config.json)

**Section sources**
- [LLMConfigManager.js](file://backend/src/services/LLMConfigManager.js#L288-L313)

### 流式响应处理
虽然当前代码未直接展示流式处理，但 `OllamaProvider` 的请求体中包含 `stream: false` 字段，表明其具备扩展流式响应的能力。前端可通过 SSE 或 WebSocket 接收实时输出。

```mermaid
sequenceDiagram
participant Frontend as "前端"
participant Backend as "后端"
participant LLM as "大模型"
Frontend->>Backend : 发送问题 (开启流)
Backend->>LLM : POST /api/chat (stream=true)
loop 流式接收Token
LLM-->>Backend : 发送部分响应
Backend-->>Frontend : 通过SSE推送文本片段
end
LLM-->>Backend : 完成标志
Backend-->>Frontend : 关闭流
```

**Diagram sources**
- [LLMProvider.js](file://backend/src/services/LLMProvider.js#L108-L156)

### 提示词工程实践
系统通过预定义的模板进行提示词工程，确保输出格式的一致性和专业性。

```mermaid
flowchart LR
A["用户输入: CPU使用率过高"] --> B["LLMConfigManager<br/>获取 'problem_analysis' 模板"]
B --> C["替换模板变量:<br/>{category} -> '性能'<br/>{description} -> 'CPU使用率过高'"]
C --> D["构造最终Prompt"]
D --> E["发送给LLM"]
E --> F["期望输出:<br/>1. 问题分析<br/>2. 处置步骤<br/>3. 注意事项"]
```

**Diagram sources**
- [LLMConfigManager.js](file://backend/src/services/LLMConfigManager.js#L198-L203)
- [LLMService.js](file://backend/src/services/LLMService.js#L178-L214)

### 请求构造与结构化输出流程
结合实际场景，展示从用户输入到结构化输出的完整过程。

```mermaid
sequenceDiagram
participant User as "用户"
participant Session as "SessionController"
participant LLMService as "LLMService"
participant Provider as "OllamaProvider"
User->>Session : 报告"服务器内存不足"
Session->>LLMService : analyzeProblem("资源", "服务器内存不足")
LLMService->>LLMConfigManager : getPromptTemplate('problem_analysis')
LLMConfigManager-->>LLMService : 返回模板字符串
LLMService->>LLMService : 替换{category}, {description}
LLMService->>LLMService : 构造system/user消息
LLMService->>Provider : chat(消息数组, {temperature : 0.3})
Provider->>Ollama : HTTP POST /api/chat
Ollama-->>Provider : 返回JSON响应
Provider-->>LLMService : 解析为标准格式
LLMService-->>Session : 返回{analysis, model, usage...}
Session-->>User : 显示结构化分析结果
```

**Diagram sources**
- [LLMService.js](file://backend/src/services/LLMService.js#L178-L214)
- [LLMProvider.js](file://backend/src/services/LLMProvider.js#L108-L156)

## 依赖分析
系统依赖关系清晰，各组件职责分明。

```mermaid
graph TD
LLMService --> LLMConfigManager
LLMService --> LLMProvider
LLMProvider --> Axios
LLMConfigManager --> FS
LLMConfigManager --> Path
```

**Diagram sources**
- [LLMService.js](file://backend/src/services/LLMService.js#L9-L366)
- [LLMConfigManager.js](file://backend/src/services/LLMConfigManager.js#L13-L314)

**Section sources**
- [LLMService.js](file://backend/src/services/LLMService.js#L9-L366)

## 性能考虑
系统内置了缓存机制以减少重复请求，并通过配置化的重试策略提高稳定性。

**Section sources**
- [LLMService.js](file://backend/src/services/LLMService.js#L36-L63)
- [LLMService.js](file://backend/src/services/LLMService.js#L128-L147)

## 故障排除指南
当 LLM 服务出现问题时，应首先检查配置文件路径和内容，然后确认所选提供商的网络连通性和 API 密钥有效性。

**Section sources**
- [LLMConfigManager.js](file://backend/src/services/LLMConfigManager.js#L78-L100)
- [LLMProvider.js](file://backend/src/services/LLMProvider.js#L68-L90)

## 结论
该 LLM 服务设计良好，通过分层和工厂模式实现了对多提供商的支持，配置驱动的方式使其具有高度的灵活性和可维护性。未来可进一步完善流式响应功能，提升用户体验。