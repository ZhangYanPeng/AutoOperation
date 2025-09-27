import React, { useState, useEffect } from 'react'
import { Save, RefreshCw, Monitor, Bell, Globe, Palette } from 'lucide-react'
import { apiClient } from '@/utils/api'
import toast from 'react-hot-toast'
import type { UserSettings, ThemeConfig } from '@/types'

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>({
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
  })
  const [systemStatus, setSystemStatus] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadSettings()
    loadSystemStatus()
  }, [])

  const loadSettings = () => {
    // 从 localStorage 加载用户设置
    const savedSettings = localStorage.getItem('userSettings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings(prev => ({ ...prev, ...parsed }))
      } catch (error) {
        console.error('加载设置失败:', error)
      }
    }
  }

  const loadSystemStatus = async () => {
    setIsLoading(true)
    try {
      const status = await apiClient.getSystemStatus()
      setSystemStatus(status)
    } catch (error) {
      console.error('获取系统状态失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      // 保存到 localStorage
      localStorage.setItem('userSettings', JSON.stringify(settings))
      
      // 应用主题设置
      applyTheme(settings.theme)
      
      toast.success('设置保存成功')
    } catch (error) {
      console.error('保存设置失败:', error)
      toast.error('保存设置失败')
    } finally {
      setIsSaving(false)
    }
  }

  const applyTheme = (theme: ThemeConfig) => {
    const root = document.documentElement
    root.style.setProperty('--primary-color', theme.primaryColor)
    root.style.setProperty('--border-radius', `${theme.borderRadius}px`)
    
    if (theme.mode === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  const handleSettingsChange = (path: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev }
      const keys = path.split('.')
      let current: any = newSettings
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]]
      }
      
      current[keys[keys.length - 1]] = value
      return newSettings
    })
  }

  const resetSettings = () => {
    if (confirm('确定要重置所有设置吗？')) {
      localStorage.removeItem('userSettings')
      loadSettings()
      toast.success('设置已重置')
    }
  }

  return (
    <div className="container-custom">
      <div className="max-w-4xl mx-auto">
        {/* 页面头部 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
            <p className="text-gray-600 mt-1">配置您的个人偏好和系统选项</p>
          </div>
          <button
            onClick={loadSystemStatus}
            disabled={isLoading}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>刷新状态</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 设置面板 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 主题设置 */}
            <div className="card p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Palette className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-medium text-gray-900">主题设置</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    主题模式
                  </label>
                  <div className="flex space-x-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="themeMode"
                        value="light"
                        checked={settings.theme.mode === 'light'}
                        onChange={(e) => handleSettingsChange('theme.mode', e.target.value)}
                        className="mr-2"
                      />
                      浅色模式
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="themeMode"
                        value="dark"
                        checked={settings.theme.mode === 'dark'}
                        onChange={(e) => handleSettingsChange('theme.mode', e.target.value)}
                        className="mr-2"
                      />
                      深色模式
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    主色调
                  </label>
                  <input
                    type="color"
                    value={settings.theme.primaryColor}
                    onChange={(e) => handleSettingsChange('theme.primaryColor', e.target.value)}
                    className="w-full h-10 rounded border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    圆角大小: {settings.theme.borderRadius}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={settings.theme.borderRadius}
                    onChange={(e) => handleSettingsChange('theme.borderRadius', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* 通知设置 */}
            <div className="card p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Bell className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-medium text-gray-900">通知设置</h2>
              </div>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">启用通知</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.enabled}
                    onChange={(e) => handleSettingsChange('notifications.enabled', e.target.checked)}
                    className="rounded"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">声音提醒</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.sound}
                    onChange={(e) => handleSettingsChange('notifications.sound', e.target.checked)}
                    disabled={!settings.notifications.enabled}
                    className="rounded"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">桌面通知</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.desktop}
                    onChange={(e) => handleSettingsChange('notifications.desktop', e.target.checked)}
                    disabled={!settings.notifications.enabled}
                    className="rounded"
                  />
                </label>
              </div>
            </div>

            {/* 应用设置 */}
            <div className="card p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Globe className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-medium text-gray-900">应用设置</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    语言
                  </label>
                  <select
                    value={settings.language}
                    onChange={(e) => handleSettingsChange('language', e.target.value)}
                    className="input"
                  >
                    <option value="zh-CN">简体中文</option>
                    <option value="en-US">English</option>
                  </select>
                </div>

                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">自动保存</span>
                  <input
                    type="checkbox"
                    checked={settings.autoSave}
                    onChange={(e) => handleSettingsChange('autoSave', e.target.checked)}
                    className="rounded"
                  />
                </label>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-between">
              <button
                onClick={resetSettings}
                className="btn btn-outline btn-secondary"
              >
                重置设置
              </button>
              
              <button
                onClick={saveSettings}
                disabled={isSaving}
                className="btn btn-primary flex items-center space-x-2"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSaving ? '保存中...' : '保存设置'}</span>
              </button>
            </div>
          </div>

          {/* 系统状态 */}
          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Monitor className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-medium text-gray-900">系统状态</h2>
              </div>
              
              {isLoading ? (
                <div className="flex-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
                </div>
              ) : systemStatus ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">大模型服务</span>
                    <span className={`badge ${systemStatus.services?.llm?.initialized ? 'badge-success' : 'badge-error'}`}>
                      {systemStatus.services?.llm?.initialized ? '正常' : '异常'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">知识库服务</span>
                    <span className={`badge ${systemStatus.services?.knowledge?.total_entries > 0 ? 'badge-success' : 'badge-warning'}`}>
                      {systemStatus.services?.knowledge?.total_entries || 0} 条
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">工具服务</span>
                    <span className={`badge ${systemStatus.services?.tools?.initialized ? 'badge-success' : 'badge-error'}`}>
                      {systemStatus.services?.tools?.loadedAPIs || 0} 个工具
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">会话管理</span>
                    <span className={`badge ${systemStatus.services?.sessions?.initialized ? 'badge-success' : 'badge-error'}`}>
                      {systemStatus.services?.sessions?.sessions_in_memory || 0} 个会话
                    </span>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500">
                      更新时间: {new Date(systemStatus.timestamp).toLocaleString('zh-CN')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  无法获取系统状态
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage