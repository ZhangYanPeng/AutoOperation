// 会话相关类型定义
export interface Session {
  session_id: string
  problem_category: string
  problem_description: string
  status: 'processing' | 'completed' | 'aborted'
  created_at: string
  updated_at: string
  user_id?: string
  metadata?: Record<string, any>
  steps: Step[]
  progress: {
    total_steps: number
    completed_steps: number
    current_step: string | null
  }
}

// 处置步骤类型定义
export interface Step {
  step_id: string
  session_id: string
  step_order: number
  step_type: 'auto' | 'manual' | 'branch' | 'conditional'
  step_content: string
  tool_api?: string
  execution_status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped'
  execution_result?: any
  user_feedback?: string
  dependencies: string[]
  timeout: number
  retry_count: number
  max_retries: number
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
  duration?: number
}

// 知识库条目类型定义
export interface KnowledgeEntry {
  knowledge_id: string
  knowledge_type: 'operation-procedure' | 'device-api'
  title: string
  content: string
  keywords: string[]
  category?: string
  priority: number
  usage_count: number
  effectiveness_score: number
  metadata: Record<string, any>
  version: string
  author?: string
  source_file?: string
  created_at: string
  last_updated: string
}

// 工具API类型定义
export interface ToolAPI {
  id: string
  title: string
  method: string
  path: string
  description: string
  parameters: ToolParameter[]
  usage_count: number
}

export interface ToolParameter {
  name: string
  type: string
  description: string
  required: boolean
}

// API响应类型定义
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 搜索结果类型定义
export interface SearchResult {
  knowledge_id: string
  title: string
  type: string
  category?: string
  summary: string
  score: number
  relevance: number
  reasons: string[]
  usage_count: number
  effectiveness_score: number
}

// 会话状态类型定义
export interface SessionStatus {
  sessionId: string
  overallStatus: string
  progress: {
    total: number
    completed: number
    failed: number
    percentage: number
  }
  currentStep: Step | null
  nextStep: Step | null
  updatedAt: string
}

// 工具执行结果类型定义
export interface ToolExecutionResult {
  success: boolean
  statusCode?: number
  headers?: Record<string, string>
  data?: any
  duration?: number
  attempt?: number
  apiDefinition?: {
    id: string
    title: string
    method: string
  }
  error?: string
}

// 创建会话请求类型定义
export interface CreateSessionRequest {
  problemCategory: string
  problemDescription: string
  userId?: string
}

// 执行步骤请求类型定义
export interface ExecuteStepRequest {
  stepId: string
  executionType: 'auto' | 'manual'
  userInput?: string
}

// 反馈请求类型定义
export interface FeedbackRequest {
  stepId: string
  feedback: string
}

// 主题配置类型定义
export interface ThemeConfig {
  mode: 'light' | 'dark'
  primaryColor: string
  borderRadius: number
}

// 用户设置类型定义
export interface UserSettings {
  theme: ThemeConfig
  notifications: {
    enabled: boolean
    sound: boolean
    desktop: boolean
  }
  autoSave: boolean
  language: 'zh-CN' | 'en-US'
}

// 统计信息类型定义
export interface Statistics {
  total_sessions: number
  by_status: Record<string, number>
  by_category: Record<string, number>
  active_sessions: number
  completed_sessions: number
  failed_sessions: number
  average_steps: number
  average_duration: number
}