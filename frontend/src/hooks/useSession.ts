import { useCallback, useEffect } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { useUIStore } from '@/stores/uiStore'
import { apiClient } from '@/utils/api'
import toast from 'react-hot-toast'
import type { CreateSessionRequest } from '@/types'

export const useSession = () => {
  const {
    currentSession,
    setCurrentSession,
    currentSessionStatus,
    setCurrentSessionStatus,
    isSessionLoading,
    setSessionLoading,
    sessionError,
    setSessionError,
    updateStep
  } = useSessionStore()

  const { setGlobalLoading } = useUIStore()

  // 创建新会话
  const createSession = useCallback(async (data: CreateSessionRequest) => {
    setSessionLoading(true)
    setSessionError(null)
    setGlobalLoading(true, '正在创建会话...')

    try {
      const result = await apiClient.createSession(data)
      setCurrentSession(result.session)
      toast.success('会话创建成功')
      return result
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '创建会话失败'
      setSessionError(errorMessage)
      toast.error(errorMessage)
      throw error
    } finally {
      setSessionLoading(false)
      setGlobalLoading(false)
    }
  }, [setCurrentSession, setSessionLoading, setSessionError, setGlobalLoading])

  // 加载会话详情
  const loadSession = useCallback(async (sessionId: string) => {
    setSessionLoading(true)
    setSessionError(null)

    try {
      const session = await apiClient.getSession(sessionId)
      setCurrentSession(session)
      return session
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '加载会话失败'
      setSessionError(errorMessage)
      throw error
    } finally {
      setSessionLoading(false)
    }
  }, [setCurrentSession, setSessionLoading, setSessionError])

  // 获取会话状态
  const loadSessionStatus = useCallback(async (sessionId: string) => {
    try {
      const status = await apiClient.getSessionStatus(sessionId)
      setCurrentSessionStatus(status)
      return status
    } catch (error: any) {
      console.error('获取会话状态失败:', error)
      throw error
    }
  }, [setCurrentSessionStatus])

  // 执行步骤
  const executeStep = useCallback(async (
    sessionId: string,
    stepId: string,
    executionType: 'auto' | 'manual',
    userInput?: string
  ) => {
    setGlobalLoading(true, '正在执行步骤...')

    try {
      const result = await apiClient.executeStep(sessionId, {
        stepId,
        executionType,
        userInput
      })

      // 更新步骤状态
      if (result.step) {
        updateStep(stepId, result.step)
      }

      toast.success('步骤执行成功')
      return result
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '步骤执行失败'
      toast.error(errorMessage)
      throw error
    } finally {
      setGlobalLoading(false)
    }
  }, [updateStep, setGlobalLoading])

  // 提供用户反馈
  const provideFeedback = useCallback(async (
    sessionId: string,
    stepId: string,
    feedback: string
  ) => {
    setGlobalLoading(true, '正在处理反馈...')

    try {
      const result = await apiClient.provideFeedback(sessionId, {
        stepId,
        feedback
      })

      toast.success('反馈提交成功')
      return result
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '反馈提交失败'
      toast.error(errorMessage)
      throw error
    } finally {
      setGlobalLoading(false)
    }
  }, [setGlobalLoading])

  // 完成会话
  const completeSession = useCallback(async (sessionId: string, summary?: string) => {
    setGlobalLoading(true, '正在完成会话...')

    try {
      const result = await apiClient.completeSession(sessionId, summary)
      setCurrentSession(result)
      toast.success('会话已完成')
      return result
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '完成会话失败'
      toast.error(errorMessage)
      throw error
    } finally {
      setGlobalLoading(false)
    }
  }, [setCurrentSession, setGlobalLoading])

  // 自动刷新会话状态
  useEffect(() => {
    if (currentSession && currentSession.status === 'processing') {
      const interval = setInterval(() => {
        loadSessionStatus(currentSession.session_id).catch(console.error)
      }, 10000) // 每10秒刷新一次

      return () => clearInterval(interval)
    }
  }, [currentSession, loadSessionStatus])

  return {
    // 状态
    currentSession,
    currentSessionStatus,
    isSessionLoading,
    sessionError,

    // 操作方法
    createSession,
    loadSession,
    loadSessionStatus,
    executeStep,
    provideFeedback,
    completeSession
  }
}