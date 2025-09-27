import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserSettings } from '@/types'

interface UIState {
  // 用户设置
  userSettings: UserSettings
  
  // 界面状态
  sidebarCollapsed: boolean
  sidebarOpen: boolean
  currentTheme: 'light' | 'dark'
  
  // 全局加载状态
  isGlobalLoading: boolean
  globalLoadingText: string
  
  // 模态框状态
  modals: {
    feedbackModal: boolean
    settingsModal: boolean
    confirmModal: boolean
  }
  
  // 确认模态框数据
  confirmModalData: {
    title: string
    message: string
    onConfirm: (() => void) | null
    onCancel: (() => void) | null
  }
  
  // 通知设置
  notifications: {
    enabled: boolean
    sound: boolean
    desktop: boolean
  }

  // Actions
  setUserSettings: (settings: Partial<UserSettings>) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setSidebarOpen: (open: boolean) => void
  setCurrentTheme: (theme: 'light' | 'dark') => void
  
  setGlobalLoading: (loading: boolean, text?: string) => void
  
  openModal: (modalName: keyof UIState['modals']) => void
  closeModal: (modalName: keyof UIState['modals']) => void
  closeAllModals: () => void
  
  showConfirmModal: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => void
  hideConfirmModal: () => void
  
  setNotifications: (notifications: Partial<UIState['notifications']>) => void
  
  // 主题应用
  applyTheme: () => void
  
  // 重置状态
  reset: () => void
}

const defaultUserSettings: UserSettings = {
  theme: {
    mode: 'light',
    primaryColor: '#3b82f6',
    borderRadius: 8
  },
  notifications: {
    enabled: true,
    sound: true,
    desktop: false
  },
  autoSave: true,
  language: 'zh-CN'
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // 初始状态
      userSettings: defaultUserSettings,
      
      sidebarCollapsed: false,
      sidebarOpen: false,
      currentTheme: 'light',
      
      isGlobalLoading: false,
      globalLoadingText: '',
      
      modals: {
        feedbackModal: false,
        settingsModal: false,
        confirmModal: false
      },
      
      confirmModalData: {
        title: '',
        message: '',
        onConfirm: null,
        onCancel: null
      },
      
      notifications: {
        enabled: true,
        sound: true,
        desktop: false
      },

      // Actions
      setUserSettings: (settings) => set((state) => {
        const newSettings = { ...state.userSettings, ...settings }
        
        // 自动应用主题设置
        if (settings.theme) {
          const root = document.documentElement
          if (settings.theme.primaryColor) {
            root.style.setProperty('--primary-color', settings.theme.primaryColor)
          }
          if (settings.theme.borderRadius !== undefined) {
            root.style.setProperty('--border-radius', `${settings.theme.borderRadius}px`)
          }
          if (settings.theme.mode) {
            if (settings.theme.mode === 'dark') {
              root.classList.add('dark')
            } else {
              root.classList.remove('dark')
            }
          }
        }
        
        return { userSettings: newSettings }
      }),
      
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      
      setCurrentTheme: (theme) => set({ currentTheme: theme }),
      
      setGlobalLoading: (loading, text = '') => set({
        isGlobalLoading: loading,
        globalLoadingText: text
      }),
      
      openModal: (modalName) => set((state) => ({
        modals: { ...state.modals, [modalName]: true }
      })),
      
      closeModal: (modalName) => set((state) => ({
        modals: { ...state.modals, [modalName]: false }
      })),
      
      closeAllModals: () => set({
        modals: {
          feedbackModal: false,
          settingsModal: false,
          confirmModal: false
        }
      }),
      
      showConfirmModal: (title, message, onConfirm, onCancel) => set({
        modals: { ...get().modals, confirmModal: true },
        confirmModalData: { title, message, onConfirm, onCancel: onCancel || null }
      }),
      
      hideConfirmModal: () => set({
        modals: { ...get().modals, confirmModal: false },
        confirmModalData: { title: '', message: '', onConfirm: null, onCancel: null }
      }),
      
      setNotifications: (notifications) => set((state) => ({
        notifications: { ...state.notifications, ...notifications }
      })),
      
      applyTheme: () => {
        const { userSettings } = get()
        const root = document.documentElement
        
        // 应用主色调
        root.style.setProperty('--primary-color', userSettings.theme.primaryColor)
        
        // 应用圆角
        root.style.setProperty('--border-radius', `${userSettings.theme.borderRadius}px`)
        
        // 应用主题模式
        if (userSettings.theme.mode === 'dark') {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      },
      
      reset: () => set({
        userSettings: defaultUserSettings,
        sidebarCollapsed: false,
        sidebarOpen: false,
        currentTheme: 'light',
        isGlobalLoading: false,
        globalLoadingText: '',
        modals: {
          feedbackModal: false,
          settingsModal: false,
          confirmModal: false
        },
        confirmModalData: {
          title: '',
          message: '',
          onConfirm: null,
          onCancel: null
        },
        notifications: {
          enabled: true,
          sound: true,
          desktop: false
        }
      })
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        // 持久化用户设置和界面偏好
        userSettings: state.userSettings,
        sidebarCollapsed: state.sidebarCollapsed,
        currentTheme: state.currentTheme,
        notifications: state.notifications
      })
    }
  )
)

// 初始化时应用主题
if (typeof window !== 'undefined') {
  useUIStore.getState().applyTheme()
}