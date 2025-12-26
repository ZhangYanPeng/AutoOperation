import { create } from 'zustand'
import type { KnowledgeEntry, SearchResult, ToolAPI, Statistics } from '@/types'

interface DataState {
  // 知识库状态
  knowledgeEntries: KnowledgeEntry[]
  searchResults: SearchResult[]
  isKnowledgeLoading: boolean
  knowledgeError: string | null
  knowledgeStats: any | null
  
  // 工具状态
  availableTools: ToolAPI[]
  toolDetails: Record<string, any>
  isToolsLoading: boolean
  toolsError: string | null
  toolsStats: any | null
  
  // 系统统计
  systemStats: Statistics | null
  systemStatus: any | null
  isStatsLoading: boolean
  statsError: string | null
  
  // 缓存设置
  cacheExpiry: Record<string, number>
  cacheTimeout: number

  // Actions - 知识库
  setKnowledgeEntries: (entries: KnowledgeEntry[]) => void
  setSearchResults: (results: SearchResult[]) => void
  setKnowledgeLoading: (loading: boolean) => void
  setKnowledgeError: (error: string | null) => void
  setKnowledgeStats: (stats: any) => void
  
  // Actions - 工具
  setAvailableTools: (tools: ToolAPI[]) => void
  setToolDetails: (toolId: string, details: any) => void
  setToolsLoading: (loading: boolean) => void
  setToolsError: (error: string | null) => void
  setToolsStats: (stats: any) => void
  
  // Actions - 系统统计
  setSystemStats: (stats: Statistics | null) => void
  setSystemStatus: (status: any | null) => void
  setStatsLoading: (loading: boolean) => void
  setStatsError: (error: string | null) => void
  
  // 缓存管理
  setCacheExpiry: (key: string, expiry: number) => void
  isCacheValid: (key: string) => boolean
  clearCache: (key?: string) => void
  
  // 重置状态
  reset: () => void
}

export const useDataStore = create<DataState>((set, get) => ({
  // 初始状态
  knowledgeEntries: [],
  searchResults: [],
  isKnowledgeLoading: false,
  knowledgeError: null,
  knowledgeStats: null,
  
  availableTools: [],
  toolDetails: {},
  isToolsLoading: false,
  toolsError: null,
  toolsStats: null,
  
  systemStats: null,
  systemStatus: null,
  isStatsLoading: false,
  statsError: null,
  
  cacheExpiry: {},
  cacheTimeout: 5 * 60 * 1000, // 5分钟缓存

  // Actions - 知识库
  setKnowledgeEntries: (entries) => {
    set({ knowledgeEntries: entries })
    get().setCacheExpiry('knowledgeEntries', Date.now() + get().cacheTimeout)
  },
  
  setSearchResults: (results) => set({ searchResults: results }),
  
  setKnowledgeLoading: (loading) => set({ isKnowledgeLoading: loading }),
  
  setKnowledgeError: (error) => set({ knowledgeError: error }),
  
  setKnowledgeStats: (stats) => {
    set({ knowledgeStats: stats })
    get().setCacheExpiry('knowledgeStats', Date.now() + get().cacheTimeout)
  },

  // Actions - 工具
  setAvailableTools: (tools) => {
    set({ availableTools: tools })
    get().setCacheExpiry('availableTools', Date.now() + get().cacheTimeout)
  },
  
  setToolDetails: (toolId, details) => set((state) => ({
    toolDetails: { ...state.toolDetails, [toolId]: details }
  })),
  
  setToolsLoading: (loading) => set({ isToolsLoading: loading }),
  
  setToolsError: (error) => set({ toolsError: error }),
  
  setToolsStats: (stats) => {
    set({ toolsStats: stats })
    get().setCacheExpiry('toolsStats', Date.now() + get().cacheTimeout)
  },

  // Actions - 系统统计
  setSystemStats: (stats) => {
    set({ systemStats: stats })
    get().setCacheExpiry('systemStats', Date.now() + get().cacheTimeout)
  },
  
  setSystemStatus: (status) => {
    set({ systemStatus: status })
    get().setCacheExpiry('systemStatus', Date.now() + get().cacheTimeout)
  },
  
  setStatsLoading: (loading) => set({ isStatsLoading: loading }),
  
  setStatsError: (error) => set({ statsError: error }),

  // 缓存管理
  setCacheExpiry: (key, expiry) => set((state) => ({
    cacheExpiry: { ...state.cacheExpiry, [key]: expiry }
  })),
  
  isCacheValid: (key) => {
    const expiry = get().cacheExpiry[key]
    return expiry ? Date.now() < expiry : false
  },
  
  clearCache: (key) => {
    if (key) {
      set((state) => {
        const newCacheExpiry = { ...state.cacheExpiry }
        delete newCacheExpiry[key]
        return { cacheExpiry: newCacheExpiry }
      })
    } else {
      set({ cacheExpiry: {} })
    }
  },

  // 重置状态
  reset: () => set({
    knowledgeEntries: [],
    searchResults: [],
    isKnowledgeLoading: false,
    knowledgeError: null,
    knowledgeStats: null,
    
    availableTools: [],
    toolDetails: {},
    isToolsLoading: false,
    toolsError: null,
    toolsStats: null,
    
    systemStats: null,
    systemStatus: null,
    isStatsLoading: false,
    statsError: null,
    
    cacheExpiry: {}
  })
}))

// 自动清理过期缓存
if (typeof window !== 'undefined') {
  setInterval(() => {
    const store = useDataStore.getState()
    const now = Date.now()
    const expiredKeys: string[] = []
    
    Object.entries(store.cacheExpiry).forEach(([key, expiry]) => {
      if (now >= expiry) {
        expiredKeys.push(key)
      }
    })
    
    if (expiredKeys.length > 0) {
      expiredKeys.forEach(key => store.clearCache(key))
    }
  }, 60000) // 每分钟检查一次
}