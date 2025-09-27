import { useCallback, useEffect } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { useUIStore } from '@/stores/uiStore'
import { apiClient } from '@/utils/api'
import toast from 'react-hot-toast'
import type { Session } from '@/types'

export const useSessionHistory = () => {
  const {
    sessions,
    setSessions,
    isSessionsLoading,
    setSessionsLoading,
    sessionsError,
    setSessionsError,
    totalSessions,
    setTotalSessions,
    currentPage,
    setCurrentPage,
    pageSize,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    removeSession
  } = useSessionStore()

  const { setGlobalLoading } = useUIStore()

  // 加载会话列表
  const loadSessions = useCallback(async (
    page = currentPage,
    query = searchQuery,
    status = statusFilter,
    category = categoryFilter
  ) => {
    setSessionsLoading(true)
    setSessionsError(null)

    try {
      let result
      
      if (query.trim()) {
        // 搜索会话
        const filters: any = {}
        if (status !== 'all') filters.status = status
        if (category !== 'all') filters.category = category
        
        result = await apiClient.searchSessions(query, {
          ...filters,
          limit: pageSize,
          offset: (page - 1) * pageSize
        })
        
        setSessions(result.results)
        setTotalSessions(result.total)
      } else {
        // 获取用户会话列表
        result = await apiClient.getUserSessions(
          undefined, // userId
          pageSize,
          (page - 1) * pageSize
        )
        
        // 应用过滤器
        let filteredSessions = result.sessions
        if (status !== 'all') {
          filteredSessions = filteredSessions.filter(s => s.status === status)
        }
        if (category !== 'all') {
          filteredSessions = filteredSessions.filter(s => s.problem_category === category)
        }
        
        setSessions(filteredSessions)
        setTotalSessions(filteredSessions.length)
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '加载会话列表失败'
      setSessionsError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setSessionsLoading(false)
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    statusFilter,
    categoryFilter,
    setSessions,
    setSessionsLoading,
    setSessionsError,
    setTotalSessions
  ])

  // 删除会话
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await apiClient.deleteSession(sessionId)
      removeSession(sessionId)
      toast.success('会话删除成功')
      
      // 如果当前页没有数据了，跳转到上一页
      if (sessions.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1)
      } else {
        // 重新加载当前页
        loadSessions()
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '删除会话失败'
      toast.error(errorMessage)
      throw error
    }
  }, [removeSession, sessions.length, currentPage, setCurrentPage, loadSessions])

  // 导出会话
  const exportSession = useCallback(async (sessionId: string, format: 'json' | 'csv' = 'json') => {
    setGlobalLoading(true, '正在导出会话...')

    try {
      const data = await apiClient.exportSessionData(sessionId, format)
      
      // 创建下载链接
      const blob = new Blob([data], { 
        type: format === 'json' ? 'application/json' : 'text/csv' 
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `session_${sessionId}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success('会话导出成功')
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '导出会话失败'
      toast.error(errorMessage)
      throw error
    } finally {
      setGlobalLoading(false)
    }
  }, [setGlobalLoading])

  // 批量删除会话
  const deleteMultipleSessions = useCallback(async (sessionIds: string[]) => {
    setGlobalLoading(true, `正在删除 ${sessionIds.length} 个会话...`)

    try {
      await Promise.all(sessionIds.map(id => apiClient.deleteSession(id)))
      
      // 从状态中移除已删除的会话
      sessionIds.forEach(id => removeSession(id))
      
      toast.success(`成功删除 ${sessionIds.length} 个会话`)
      
      // 重新加载列表
      loadSessions()
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '批量删除失败'
      toast.error(errorMessage)
      throw error
    } finally {
      setGlobalLoading(false)
    }
  }, [removeSession, loadSessions, setGlobalLoading])

  // 搜索处理
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(1) // 重置到第一页
  }, [setSearchQuery, setCurrentPage])

  // 过滤器处理
  const handleStatusFilter = useCallback((status: string) => {
    setStatusFilter(status)
    setCurrentPage(1)
  }, [setStatusFilter, setCurrentPage])

  const handleCategoryFilter = useCallback((category: string) => {
    setCategoryFilter(category)
    setCurrentPage(1)
  }, [setCategoryFilter, setCurrentPage])

  // 分页处理
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [setCurrentPage])

  // 自动加载数据
  useEffect(() => {
    loadSessions()
  }, [currentPage, statusFilter, categoryFilter])

  // 搜索防抖
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery !== undefined) {
        loadSessions(1) // 搜索时重置到第一页
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // 计算分页信息
  const totalPages = Math.ceil(totalSessions / pageSize)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  return {
    // 状态
    sessions,
    isSessionsLoading,
    sessionsError,
    totalSessions,
    
    // 分页状态
    currentPage,
    pageSize,
    totalPages,
    hasNextPage,
    hasPrevPage,
    
    // 过滤器状态
    searchQuery,
    statusFilter,
    categoryFilter,

    // 操作方法
    loadSessions,
    deleteSession,
    exportSession,
    deleteMultipleSessions,
    
    // 事件处理
    handleSearch,
    handleStatusFilter,
    handleCategoryFilter,
    handlePageChange
  }
}