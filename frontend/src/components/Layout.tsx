import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Home, 
  MessageSquare, 
  History, 
  Settings, 
  Menu,
  X,
  Brain,
  Activity
} from 'lucide-react'
import { useState } from 'react'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navigation = [
    { name: '首页', href: '/', icon: Home },
    { name: '新建会话', href: '/', icon: MessageSquare },
    { name: '历史记录', href: '/history', icon: History },
    { name: '设置', href: '/settings', icon: Settings },
  ]

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <div className={`
        fixed top-0 left-0 bottom-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900">智能运维助手</span>
            </div>
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <nav className="mt-6 px-3 flex-1">
            <div className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`
                      flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
                      ${isActive(item.href)
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }
                    `}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </nav>

          {/* 状态指示器 */}
          <div className="p-3 flex-shrink-0">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">系统状态</span>
                <div className="flex items-center space-x-1">
                  <Activity className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-600">运行中</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        {/* 顶部导航栏 */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6 text-gray-500" />
            </button>

            <div className="flex-1" />

            {/* 右侧工具栏 */}
            <div className="flex items-center space-x-4">
              <div className="hidden sm:block text-sm text-gray-500">
                {new Date().toLocaleString('zh-CN')}
              </div>
            </div>
          </div>
        </div>

        {/* 页面内容 */}
        <main className="flex-1 overflow-y-auto main-scroll">
          <div className="py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout