import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Search, 
  Filter, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye,
  Trash2,
  Download,
  RefreshCw
} from 'lucide-react'
import { apiClient } from '@/utils/api'
import toast from 'react-hot-toast'
import type { Session } from '@/types'

const HistoryPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalSessions, setTotalSessions] = useState(0)
  const pageSize = 20

  useEffect(() => {
    loadSessions()
  }, [currentPage, statusFilter, categoryFilter])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        searchSessions()
      } else {
        loadSessions()
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const loadSessions = async () => {
    setIsLoading(true)
    try {
      const filters: any = {}
      if (statusFilter !== 'all') filters.status = statusFilter
      if (categoryFilter !== 'all') filters.category = categoryFilter

      const result = await apiClient.getUserSessions(
        undefined, // userId - 如果需要用户权限，这里传入用户ID
        pageSize,
        (currentPage - 1) * pageSize
      )
      
      setSessions(result.sessions)
      setTotalSessions(result.total)
    } catch (error) {
      console.error('加载会话历史失败:', error)
      toast.error('加载会话历史失败')
    } finally {
      setIsLoading(false)
    }
  }

  const searchSessions = async () => {
    if (!searchQuery.trim()) {
      loadSessions()
      return
    }

    setIsLoading(true)
    try {
      const filters: any = {}
      if (statusFilter !== 'all') filters.status = statusFilter
      if (categoryFilter !== 'all') filters.category = categoryFilter

      const result = await apiClient.searchSessions(searchQuery, filters)
      setSessions(result.results)
      setTotalSessions(result.total)
    } catch (error) {
      console.error('搜索会话失败:', error)
      toast.error('搜索会话失败')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteSession = async (sessionId: string) => {
    if (!confirm('确定要删除这个会话吗？此操作不可恢复。')) {
      return
    }

    try {
      await apiClient.deleteSession(sessionId)
      toast.success('会话删除成功')
      setSessions(sessions.filter(s => s.session_id !== sessionId))
      setTotalSessions(prev => prev - 1)
    } catch (error) {
      console.error('删除会话失败:', error)
      toast.error('删除会话失败')
    }
  }

  const exportSession = async (sessionId: string) => {
    try {
      // 这里应该调用后端的导出API
      toast.success('导出功能开发中...')
    } catch (error) {
      console.error('导出会话失败:', error)
      toast.error('导出会话失败')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-success-600" />
      case 'processing':
        return <Clock className="w-5 h-5 text-primary-600" />
      case 'aborted':
        return <XCircle className="w-5 h-5 text-error-600" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap = {
      processing: { label: '处理中', className: 'badge-info' },
      completed: { label: '已完成', className: 'badge-success' },
      aborted: { label: '已中止', className: 'badge-error' }
    }
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, className: 'badge-gray' }
    return <span className={`badge ${statusInfo.className}`}>{statusInfo.label}</span>
  }

  const getCategoryLabel = (category: string) => {
    const categoryMap: Record<string, string> = {
      performance: '性能问题',
      network: '网络问题',
      service: '服务问题',
      security: '安全问题',
      storage: '存储问题',
      other: '其他问题'
    }
    return categoryMap[category] || category
  }

  const totalPages = Math.ceil(totalSessions / pageSize)

  return (
    <div className="container-custom">
      <div className="max-w-6xl mx-auto">
        {/* 页面头部 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">会话历史</h1>
            <p className="text-gray-600 mt-1">查看和管理您的处置会话记录</p>
          </div>
          <button
            onClick={loadSessions}
            disabled={isLoading}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>刷新</span>
          </button>
        </div>

        {/* 搜索和过滤器 */}
        <div className="card p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="搜索会话..."
                  className="input pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">所有状态</option>
                <option value="processing">处理中</option>
                <option value="completed">已完成</option>
                <option value="aborted">已中止</option>
              </select>
            </div>
            
            <div>
              <select
                className="input"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">所有分类</option>
                <option value="performance">性能问题</option>
                <option value="network">网络问题</option>
                <option value="service">服务问题</option>
                <option value="security">安全问题</option>
                <option value="storage">存储问题</option>
                <option value="other">其他问题</option>
              </select>
            </div>
          </div>
        </div>

        {/* 会话列表 */}
        {isLoading ? (
          <div className="flex-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无会话记录</h3>
            <p className="text-gray-600 mb-6">您还没有创建任何处置会话</p>
            <Link to="/" className="btn btn-primary">
              创建新会话
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.session_id} className="card card-hover">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        {getStatusIcon(session.status)}
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {getCategoryLabel(session.problem_category)}
                          </h3>
                          <p className="text-sm text-gray-500">
                            会话ID: {session.session_id}
                          </p>
                        </div>
                        {getStatusBadge(session.status)}
                      </div>
                      
                      <p className="text-gray-700 mb-4 text-truncate-2">
                        {session.problem_description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>创建时间: {new Date(session.created_at).toLocaleString('zh-CN')}</span>
                          <span>步骤: {session.progress.completed}/{session.progress.total}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/session/${session.session_id}`}
                            className="btn btn-sm btn-primary flex items-center space-x-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>查看</span>
                          </Link>
                          
                          <button
                            onClick={() => exportSession(session.session_id)}
                            className="btn btn-sm btn-secondary flex items-center space-x-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>导出</span>
                          </button>
                          
                          <button
                            onClick={() => deleteSession(session.session_id)}
                            className="btn btn-sm btn-error flex items-center space-x-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>删除</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8">
            <div className="text-sm text-gray-700">
              显示 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, totalSessions)} 条，
              共 {totalSessions} 条记录
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="btn btn-sm btn-secondary"
              >
                上一页
              </button>
              
              <span className="text-sm text-gray-700">
                第 {currentPage} 页，共 {totalPages} 页
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="btn btn-sm btn-secondary"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryPage