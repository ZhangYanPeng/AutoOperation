import { useCallback, useEffect } from 'react'
import { useDataStore } from '@/stores/dataStore'
import { useUIStore } from '@/stores/uiStore'
import { apiClient } from '@/utils/api'
import toast from 'react-hot-toast'

export const useKnowledge = () => {
  const {
    knowledgeEntries,
    setKnowledgeEntries,
    searchResults,
    setSearchResults,
    isKnowledgeLoading,
    setKnowledgeLoading,
    knowledgeError,
    setKnowledgeError,
    knowledgeStats,
    setKnowledgeStats,
    isCacheValid
  } = useDataStore()

  const { setGlobalLoading } = useUIStore()

  // 搜索知识库
  const searchKnowledge = useCallback(async (
    query: string,
    options?: {
      type?: 'all' | 'operation-procedure' | 'device-api'
      category?: string
      limit?: number
      minScore?: number
    }
  ) => {
    if (!query.trim()) {
      setSearchResults([])
      return { results: [], total: 0 }
    }

    setKnowledgeLoading(true)
    setKnowledgeError(null)

    try {
      const result = await apiClient.searchKnowledge(query, options)
      setSearchResults(result.results)
      return result
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '搜索知识库失败'
      setKnowledgeError(errorMessage)
      toast.error(errorMessage)
      throw error
    } finally {
      setKnowledgeLoading(false)
    }
  }, [setSearchResults, setKnowledgeLoading, setKnowledgeError])

  // 获取知识条目详情
  const getKnowledgeEntry = useCallback(async (knowledgeId: string) => {
    setKnowledgeLoading(true)

    try {
      const entry = await apiClient.getKnowledgeEntry(knowledgeId)
      return entry
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '获取知识条目失败'
      toast.error(errorMessage)
      throw error
    } finally {
      setKnowledgeLoading(false)
    }
  }, [setKnowledgeLoading])

  // 按分类获取知识
  const getKnowledgeByCategory = useCallback(async (category: string, limit = 20) => {
    setKnowledgeLoading(true)

    try {
      const result = await apiClient.getKnowledgeByCategory(category, limit)
      return result
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '获取分类知识失败'
      toast.error(errorMessage)
      throw error
    } finally {
      setKnowledgeLoading(false)
    }
  }, [setKnowledgeLoading])

  // 获取推荐知识
  const getRecommendations = useCallback(async (category?: string, limit = 5) => {
    try {
      const result = await apiClient.getRecommendations(category, limit)
      return result
    } catch (error: any) {
      console.error('获取推荐知识失败:', error)
      return { recommendations: [], total: 0 }
    }
  }, [])

  // 更新有效性评分
  const updateEffectivenessScore = useCallback(async (knowledgeId: string, score: number) => {
    try {
      await apiClient.updateEffectivenessScore(knowledgeId, score)
      toast.success('评分更新成功')
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '更新评分失败'
      toast.error(errorMessage)
      throw error
    }
  }, [])

  // 加载知识库统计信息
  const loadKnowledgeStats = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && isCacheValid('knowledgeStats')) {
      return knowledgeStats
    }

    try {
      const stats = await apiClient.getKnowledgeStatistics()
      setKnowledgeStats(stats)
      return stats
    } catch (error: any) {
      console.error('获取知识库统计失败:', error)
      return null
    }
  }, [knowledgeStats, isCacheValid, setKnowledgeStats])

  // 实时搜索（防抖）
  const searchWithDebounce = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout
      return (query: string, options?: any) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          if (query.trim()) {
            searchKnowledge(query, options)
          } else {
            setSearchResults([])
          }
        }, 300)
      }
    })(),
    [searchKnowledge, setSearchResults]
  )

  // 智能搜索建议
  const getSearchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      return []
    }

    try {
      // 简单的搜索建议，基于已有的搜索结果
      const result = await searchKnowledge(query, { limit: 3 })
      return result.results.map(r => r.title)
    } catch (error) {
      return []
    }
  }, [searchKnowledge])

  // 自动加载知识库统计
  useEffect(() => {
    loadKnowledgeStats()
  }, [])

  return {
    // 状态
    knowledgeEntries,
    searchResults,
    isKnowledgeLoading,
    knowledgeError,
    knowledgeStats,

    // 操作方法
    searchKnowledge,
    getKnowledgeEntry,
    getKnowledgeByCategory,
    getRecommendations,
    updateEffectivenessScore,
    loadKnowledgeStats,
    
    // 辅助方法
    searchWithDebounce,
    getSearchSuggestions
  }
}

export const useTools = () => {
  const {
    availableTools,
    setAvailableTools,
    toolDetails,
    setToolDetails,
    isToolsLoading,
    setToolsLoading,
    toolsError,
    setToolsError,
    toolsStats,
    setToolsStats,
    isCacheValid
  } = useDataStore()

  const { setGlobalLoading } = useUIStore()

  // 加载可用工具列表
  const loadAvailableTools = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && isCacheValid('availableTools')) {
      return availableTools
    }

    setToolsLoading(true)
    setToolsError(null)

    try {
      const result = await apiClient.getAvailableTools()
      setAvailableTools(result.tools)
      return result.tools
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '加载工具列表失败'
      setToolsError(errorMessage)
      throw error
    } finally {
      setToolsLoading(false)
    }
  }, [availableTools, isCacheValid, setAvailableTools, setToolsLoading, setToolsError])

  // 获取工具详情
  const getToolDetails = useCallback(async (apiId: string) => {
    // 检查缓存
    if (toolDetails[apiId]) {
      return toolDetails[apiId]
    }

    setToolsLoading(true)

    try {
      const details = await apiClient.getToolDetails(apiId)
      setToolDetails(apiId, details)
      return details
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '获取工具详情失败'
      toast.error(errorMessage)
      throw error
    } finally {
      setToolsLoading(false)
    }
  }, [toolDetails, setToolDetails, setToolsLoading])

  // 执行工具
  const executeTool = useCallback(async (
    apiId: string,
    parameters: Record<string, any>,
    options?: Record<string, any>
  ) => {
    setGlobalLoading(true, '正在执行工具...')

    try {
      const result = await apiClient.executeTool(apiId, parameters, options)
      toast.success('工具执行成功')
      return result
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '工具执行失败'
      toast.error(errorMessage)
      throw error
    } finally {
      setGlobalLoading(false)
    }
  }, [setGlobalLoading])

  // 测试工具连接
  const testTool = useCallback(async (apiId: string, testParameters?: Record<string, any>) => {
    setGlobalLoading(true, '正在测试工具连接...')

    try {
      const result = await apiClient.testTool(apiId, testParameters)
      if (result.success) {
        toast.success('工具连接测试成功')
      } else {
        toast.error(`工具连接测试失败: ${result.message}`)
      }
      return result
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '工具连接测试失败'
      toast.error(errorMessage)
      throw error
    } finally {
      setGlobalLoading(false)
    }
  }, [setGlobalLoading])

  // 获取执行历史
  const getExecutionHistory = useCallback(async (apiId?: string, limit = 50) => {
    try {
      const result = await apiClient.getExecutionHistory(apiId, limit)
      return result
    } catch (error: any) {
      console.error('获取执行历史失败:', error)
      return { history: [], total: 0 }
    }
  }, [])

  // 加载工具统计
  const loadToolsStats = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && isCacheValid('toolsStats')) {
      return toolsStats
    }

    try {
      const stats = await apiClient.getToolStatistics()
      setToolsStats(stats)
      return stats
    } catch (error: any) {
      console.error('获取工具统计失败:', error)
      return null
    }
  }, [toolsStats, isCacheValid, setToolsStats])

  // 自动加载工具列表
  useEffect(() => {
    loadAvailableTools()
    loadToolsStats()
  }, [])

  return {
    // 状态
    availableTools,
    toolDetails,
    isToolsLoading,
    toolsError,
    toolsStats,

    // 操作方法
    loadAvailableTools,
    getToolDetails,
    executeTool,
    testTool,
    getExecutionHistory,
    loadToolsStats
  }
}