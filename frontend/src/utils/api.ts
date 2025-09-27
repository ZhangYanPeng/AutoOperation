import axios, { AxiosInstance, AxiosResponse } from 'axios'
import toast from 'react-hot-toast'
import type { 
  ApiResponse, 
  Session, 
  CreateSessionRequest, 
  ExecuteStepRequest, 
  FeedbackRequest,
  SessionStatus,
  SearchResult,
  ToolAPI,
  ToolExecutionResult,
  Statistics
} from '@/types'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        // 添加用户认证信息（如果需要）
        const token = localStorage.getItem('auth_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // 响应拦截器
    this.client.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        return response
      },
      (error) => {
        const message = error.response?.data?.message || error.message || '请求失败'
        
        // 根据错误状态码处理
        switch (error.response?.status) {
          case 401:
            toast.error('认证失败，请重新登录')
            // 可以在这里处理登录跳转
            break
          case 403:
            toast.error('权限不足')
            break
          case 404:
            toast.error('请求的资源不存在')
            break
          case 500:
            toast.error('服务器内部错误')
            break
          default:
            toast.error(message)
        }

        return Promise.reject(error)
      }
    )
  }

  // 会话管理API
  async createSession(data: CreateSessionRequest): Promise<{ session: Session; initialPlan: any }> {
    const response = await this.client.post<ApiResponse<{ session: Session; initialPlan: any }>>('/session', data)
    return response.data.data!
  }

  async getSession(sessionId: string): Promise<Session> {
    const response = await this.client.get<ApiResponse<Session>>(`/session/${sessionId}`)
    return response.data.data!
  }

  async getSessionStatus(sessionId: string): Promise<SessionStatus> {
    const response = await this.client.get<ApiResponse<SessionStatus>>(`/session/${sessionId}/status`)
    return response.data.data!
  }

  async executeStep(sessionId: string, data: ExecuteStepRequest): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>(`/session/${sessionId}/step`, data)
    return response.data.data!
  }

  async provideFeedback(sessionId: string, data: FeedbackRequest): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>(`/session/${sessionId}/feedback`, data)
    return response.data.data!
  }

  async completeSession(sessionId: string, summary?: string): Promise<Session> {
    const response = await this.client.post<ApiResponse<Session>>(`/session/${sessionId}/complete`, { summary })
    return response.data.data!
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.delete(`/session/${sessionId}`)
  }

  async getUserSessions(userId?: string, limit = 50, offset = 0): Promise<{ total: number; sessions: Session[] }> {
    const params = new URLSearchParams()
    if (userId) params.append('userId', userId)
    params.append('limit', limit.toString())
    params.append('offset', offset.toString())

    const response = await this.client.get<ApiResponse<{ total: number; sessions: Session[] }>>(`/session?${params}`)
    return response.data.data!
  }

  async searchSessions(query: string, filters?: any): Promise<{ total: number; results: Session[] }> {
    const params = new URLSearchParams()
    params.append('search', query)
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value as string)
      })
    }

    const response = await this.client.get<ApiResponse<{ total: number; results: Session[] }>>(`/session?${params}`)
    return response.data.data!
  }

  // 知识库API
  async searchKnowledge(query: string, options?: {
    type?: 'all' | 'operation-procedure' | 'device-api'
    category?: string
    limit?: number
    minScore?: number
  }): Promise<{ query: string; options: any; total: number; results: SearchResult[] }> {
    const params = new URLSearchParams()
    params.append('query', query)
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, value.toString())
      })
    }

    const response = await this.client.get<ApiResponse<{ query: string; options: any; total: number; results: SearchResult[] }>>(`/knowledge/search?${params}`)
    return response.data.data!
  }

  async getKnowledgeEntry(knowledgeId: string): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>(`/knowledge/${knowledgeId}`)
    return response.data.data!
  }

  async getKnowledgeByCategory(category: string, limit = 20): Promise<{ category: string; entries: any[]; total: number }> {
    const response = await this.client.get<ApiResponse<{ category: string; entries: any[]; total: number }>>(`/knowledge/category/${category}?limit=${limit}`)
    return response.data.data!
  }

  async getRecommendations(category?: string, limit = 5): Promise<{ recommendations: any[]; total: number }> {
    const url = category ? `/knowledge/recommendations/${category}` : '/knowledge/recommendations'
    const response = await this.client.get<ApiResponse<{ recommendations: any[]; total: number }>>(`${url}?limit=${limit}`)
    return response.data.data!
  }

  async updateEffectivenessScore(knowledgeId: string, score: number): Promise<void> {
    await this.client.post(`/knowledge/${knowledgeId}/effectiveness`, { score })
  }

  // 工具管理API
  async getAvailableTools(): Promise<{ tools: ToolAPI[]; total: number }> {
    const response = await this.client.get<ApiResponse<{ tools: ToolAPI[]; total: number }>>('/tools/list')
    return response.data.data!
  }

  async getToolDetails(apiId: string): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>(`/tools/${apiId}`)
    return response.data.data!
  }

  async executeTool(apiId: string, parameters: Record<string, any>, options?: Record<string, any>): Promise<ToolExecutionResult> {
    const response = await this.client.post<ApiResponse<ToolExecutionResult>>('/tools/execute', {
      apiId,
      parameters,
      options
    })
    return response.data.data!
  }

  async testTool(apiId: string, testParameters?: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post<ApiResponse<{ success: boolean; message: string }>>(`/tools/${apiId}/test`, {
      testParameters
    })
    return response.data.data!
  }

  async getExecutionHistory(apiId?: string, limit = 50): Promise<{ history: any[]; total: number }> {
    const url = apiId ? `/tools/history/${apiId}` : '/tools/history'
    const response = await this.client.get<ApiResponse<{ history: any[]; total: number }>>(`${url}?limit=${limit}`)
    return response.data.data!
  }

  // 统计信息API
  async getSessionStatistics(): Promise<Statistics> {
    const response = await this.client.get<ApiResponse<Statistics>>('/session/stats/overview')
    return response.data.data!
  }

  async getKnowledgeStatistics(): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/knowledge/stats/overview')
    return response.data.data!
  }

  async getToolStatistics(): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/tools/status/service')
    return response.data.data!
  }

  // 系统状态API
  async getHealthStatus(): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/../../health')
    return response.data
  }

  async getSystemStatus(): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/../../status')
    return response.data
  }
}

// 创建全局API客户端实例
export const apiClient = new ApiClient()
export default apiClient