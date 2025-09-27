// 统一导出所有状态管理store
export { useSessionStore } from './sessionStore'
export { useUIStore } from './uiStore'
export { useDataStore } from './dataStore'

// 可以添加一些组合的 hooks
import { useSessionStore } from './sessionStore'
import { useUIStore } from './uiStore'
import { useDataStore } from './dataStore'

// 重置所有状态的组合 hook
export const useResetAllStores = () => {
  const resetSession = useSessionStore(state => state.reset)
  const resetUI = useUIStore(state => state.reset)
  const resetData = useDataStore(state => state.reset)
  
  return () => {
    resetSession()
    resetUI()
    resetData()
  }
}

// 获取全局加载状态的组合 hook
export const useGlobalLoading = () => {
  const isSessionLoading = useSessionStore(state => state.isSessionLoading)
  const isSessionsLoading = useSessionStore(state => state.isSessionsLoading)
  const isKnowledgeLoading = useDataStore(state => state.isKnowledgeLoading)
  const isToolsLoading = useDataStore(state => state.isToolsLoading)
  const isStatsLoading = useDataStore(state => state.isStatsLoading)
  const isGlobalLoading = useUIStore(state => state.isGlobalLoading)
  
  return (
    isSessionLoading ||
    isSessionsLoading ||
    isKnowledgeLoading ||
    isToolsLoading ||
    isStatsLoading ||
    isGlobalLoading
  )
}

// 获取所有错误状态的组合 hook
export const useGlobalErrors = () => {
  const sessionError = useSessionStore(state => state.sessionError)
  const sessionsError = useSessionStore(state => state.sessionsError)
  const knowledgeError = useDataStore(state => state.knowledgeError)
  const toolsError = useDataStore(state => state.toolsError)
  const statsError = useDataStore(state => state.statsError)
  
  const errors = [sessionError, sessionsError, knowledgeError, toolsError, statsError]
    .filter(Boolean)
  
  return errors.length > 0 ? errors : null
}