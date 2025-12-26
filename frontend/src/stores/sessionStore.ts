import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session, SessionStatus, Step } from '@/types'

interface SessionState {
  // 当前会话相关状态
  currentSession: Session | null
  currentSessionStatus: SessionStatus | null
  isSessionLoading: boolean
  sessionError: string | null

  // 会话列表状态
  sessions: Session[]
  isSessionsLoading: boolean
  sessionsError: string | null
  totalSessions: number
  currentPage: number
  pageSize: number

  // 搜索和过滤状态
  searchQuery: string
  statusFilter: string
  categoryFilter: string

  // Actions
  setCurrentSession: (session: Session | null) => void
  setCurrentSessionStatus: (status: SessionStatus | null) => void
  setSessionLoading: (loading: boolean) => void
  setSessionError: (error: string | null) => void
  
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  updateSession: (sessionId: string, updates: Partial<Session>) => void
  removeSession: (sessionId: string) => void
  setSessionsLoading: (loading: boolean) => void
  setSessionsError: (error: string | null) => void
  setTotalSessions: (total: number) => void
  
  setSearchQuery: (query: string) => void
  setStatusFilter: (filter: string) => void
  setCategoryFilter: (filter: string) => void
  setCurrentPage: (page: number) => void
  
  // 步骤相关操作
  updateStep: (stepId: string, updates: Partial<Step>) => void
  
  // 重置状态
  reset: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      // 初始状态
      currentSession: null,
      currentSessionStatus: null,
      isSessionLoading: false,
      sessionError: null,
      
      sessions: [],
      isSessionsLoading: false,
      sessionsError: null,
      totalSessions: 0,
      currentPage: 1,
      pageSize: 20,
      
      searchQuery: '',
      statusFilter: 'all',
      categoryFilter: 'all',

      // Actions
      setCurrentSession: (session) => set({ currentSession: session }),
      
      setCurrentSessionStatus: (status) => set({ currentSessionStatus: status }),
      
      setSessionLoading: (loading) => set({ isSessionLoading: loading }),
      
      setSessionError: (error) => set({ sessionError: error }),
      
      setSessions: (sessions) => set({ sessions }),
      
      addSession: (session) => set((state) => ({
        sessions: [session, ...state.sessions],
        totalSessions: state.totalSessions + 1
      })),
      
      updateSession: (sessionId, updates) => set((state) => ({
        sessions: state.sessions.map(session =>
          session.session_id === sessionId
            ? { ...session, ...updates }
            : session
        ),
        currentSession: state.currentSession?.session_id === sessionId
          ? { ...state.currentSession, ...updates }
          : state.currentSession
      })),
      
      removeSession: (sessionId) => set((state) => ({
        sessions: state.sessions.filter(session => session.session_id !== sessionId),
        totalSessions: Math.max(0, state.totalSessions - 1),
        currentSession: state.currentSession?.session_id === sessionId
          ? null
          : state.currentSession
      })),
      
      setSessionsLoading: (loading) => set({ isSessionsLoading: loading }),
      
      setSessionsError: (error) => set({ sessionsError: error }),
      
      setTotalSessions: (total) => set({ totalSessions: total }),
      
      setSearchQuery: (query) => set({ searchQuery: query, currentPage: 1 }),
      
      setStatusFilter: (filter) => set({ statusFilter: filter, currentPage: 1 }),
      
      setCategoryFilter: (filter) => set({ categoryFilter: filter, currentPage: 1 }),
      
      setCurrentPage: (page) => set({ currentPage: page }),
      
      updateStep: (stepId, updates) => set((state) => {
        if (!state.currentSession) return state
        
        const updatedSteps = state.currentSession.steps.map(step =>
          step.step_id === stepId
            ? { ...step, ...updates }
            : step
        )
        
        return {
          currentSession: {
            ...state.currentSession,
            steps: updatedSteps
          }
        }
      }),
      
      reset: () => set({
        currentSession: null,
        currentSessionStatus: null,
        isSessionLoading: false,
        sessionError: null,
        sessions: [],
        isSessionsLoading: false,
        sessionsError: null,
        totalSessions: 0,
        currentPage: 1,
        searchQuery: '',
        statusFilter: 'all',
        categoryFilter: 'all'
      })
    }),
    {
      name: 'session-storage',
      partialize: (state) => ({
        // 只持久化部分状态
        searchQuery: state.searchQuery,
        statusFilter: state.statusFilter,
        categoryFilter: state.categoryFilter,
        currentPage: state.currentPage,
        pageSize: state.pageSize
      })
    }
  )
)