import { useCallback, useEffect } from 'react'
import { useDataStore } from '@/stores/dataStore'
import { apiClient } from '@/utils/api'
import toast from 'react-hot-toast'

export const useSystemStatus = () => {
  const {
    systemStats,
    setSystemStats,
    systemStatus,
    setSystemStatus,
    isStatsLoading,
    setStatsLoading,
    statsError,
    setStatsError,
    isCacheValid
  } = useDataStore()

  // 获取健康状态
  const getHealthStatus = useCallback(async () => {
    try {
      const status = await apiClient.getHealthStatus()
      return status
    } catch (error: any) {
      console.error('获取健康状态失败:', error)
      return null
    }
  }, [])

  // 获取系统状态
  const getSystemStatus = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && isCacheValid('systemStatus')) {
      return systemStatus
    }

    setStatsLoading(true)
    setStatsError(null)

    try {
      const status = await apiClient.getSystemStatus()
      setSystemStatus(status)
      return status
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '获取系统状态失败'
      setStatsError(errorMessage)
      console.error(errorMessage, error)
      return null
    } finally {
      setStatsLoading(false)
    }
  }, [systemStatus, isCacheValid, setSystemStatus, setStatsLoading, setStatsError])

  // 获取会话统计
  const getSessionStats = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && isCacheValid('systemStats')) {
      return systemStats
    }

    setStatsLoading(true)

    try {
      const stats = await apiClient.getSessionStatistics()
      setSystemStats(stats)
      return stats
    } catch (error: any) {
      console.error('获取会话统计失败:', error)
      return null
    } finally {
      setStatsLoading(false)
    }
  }, [systemStats, isCacheValid, setSystemStats, setStatsLoading])

  // 综合系统检查
  const performSystemCheck = useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)

    try {
      const [health, status, stats] = await Promise.allSettled([
        getHealthStatus(),
        getSystemStatus(true),
        getSessionStats(true)
      ])

      const result = {
        health: health.status === 'fulfilled' ? health.value : null,
        status: status.status === 'fulfilled' ? status.value : null,
        stats: stats.status === 'fulfilled' ? stats.value : null,
        timestamp: new Date().toISOString()
      }

      // 检查是否有服务异常
      const hasErrors = [health, status, stats].some(p => p.status === 'rejected')
      if (hasErrors) {
        toast.warning('部分系统服务状态异常')
      } else {
        toast.success('系统状态检查完成')
      }

      return result
    } catch (error: any) {
      const errorMessage = '系统检查失败'
      setStatsError(errorMessage)
      toast.error(errorMessage)
      throw error
    } finally {
      setStatsLoading(false)
    }
  }, [getHealthStatus, getSystemStatus, getSessionStats, setStatsLoading, setStatsError])

  // 自动加载系统状态
  useEffect(() => {
    getSystemStatus()
    getSessionStats()
  }, [])

  // 定期刷新系统状态
  useEffect(() => {
    const interval = setInterval(() => {
      getSystemStatus(true)
    }, 60000) // 每分钟刷新一次

    return () => clearInterval(interval)
  }, [getSystemStatus])

  return {
    // 状态
    systemStats,
    systemStatus,
    isStatsLoading,
    statsError,

    // 操作方法
    getHealthStatus,
    getSystemStatus,
    getSessionStats,
    performSystemCheck
  }
}

// 导出所有自定义Hooks
export { useSession } from './useSession'
export { useSessionHistory } from './useSessionHistory'
export { useKnowledge, useTools } from './useKnowledge'