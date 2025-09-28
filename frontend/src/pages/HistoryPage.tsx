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
import { useSessionHistory } from '@/hooks'
import toast from 'react-hot-toast'
import type { Session } from '@/types'

const HistoryPage: React.FC = () => {
  const {
    sessions: rawSessions,
    isSessionsLoading,
    sessionsError,
    totalSessions,
    currentPage,
    pageSize,
    totalPages,
    hasNextPage,
    hasPrevPage,
    searchQuery,
    statusFilter,
    categoryFilter,
    loadSessions,
    deleteSession,
    exportSession,
    handleSearch,
    handleStatusFilter,
    handleCategoryFilter,
    handlePageChange
  } = useSessionHistory()

  // 确保 sessions 总是一个数组
  const sessions = rawSessions || []

  useEffect(() => {
    // 由于 hook 内部已经处理了初始加载，这里不需要再次调用
  }, [])

  const handleRefresh = () => {
    loadSessions()
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('确定要删除这个会话吗？此操作不可恢复。')) {
      return
    }

    try {
      await deleteSession(sessionId)
    } catch (error) {
      console.error('删除会话失败:', error)
    }
  }

  const handleExportSession = async (sessionId: string) => {
    try {
      await exportSession(sessionId)
    } catch (error) {
      console.error('导出会话失败:', error)
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
            onClick={handleRefresh}
            disabled={isSessionsLoading}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSessionsLoading ? 'animate-spin' : ''}`} />
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
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
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
                onChange={(e) => handleCategoryFilter(e.target.value)}
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
        {isSessionsLoading ? (
          <div className="flex-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : (!sessions || sessions.length === 0) ? (
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
                          <span>步骤: {session.progress?.completed_steps || 0}/{session.progress?.total_steps || 0}</span>
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
                            onClick={() => handleExportSession(session.session_id)}
                            className="btn btn-sm btn-secondary flex items-center space-x-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>导出</span>
                          </button>
                          
                          <button
                            onClick={() => handleDeleteSession(session.session_id)}
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
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!hasPrevPage}
                className="btn btn-sm btn-secondary"
              >
                上一页
              </button>
              
              <span className="text-sm text-gray-700">
                第 {currentPage} 页，共 {totalPages} 页
              </span>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!hasNextPage}
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