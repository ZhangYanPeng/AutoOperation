import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Play, 
  Pause, 
  Check, 
  X, 
  AlertTriangle, 
  Clock, 
  MessageSquare,
  ExternalLink,
  ChevronRight,
  RefreshCw
} from 'lucide-react'
import { useSession } from '@/hooks'
import toast from 'react-hot-toast'
import type { Session, Step, SessionStatus } from '@/types'

const SessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const {
    currentSession: session,
    sessionStatus,
    currentStep,
    isLoading,
    loadSession,
    executeStep,
    provideFeedback
  } = useSession()
  const [isExecuting, setIsExecuting] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackStep, setFeedbackStep] = useState<Step | null>(null)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    if (sessionId) {
      handleLoadSession()
    }
  }, [sessionId])

  const handleLoadSession = async () => {
    try {
      await loadSession(sessionId!)
    } catch (error) {
      console.error('加载会话失败:', error)
      toast.error('会话不存在或已删除')
      navigate('/')
    }
  }

  const handleExecuteStep = async (step: Step, executionType: 'auto' | 'manual') => {
    if (!sessionId) return
    
    setIsExecuting(true)
    try {
      await executeStep(sessionId, {
        stepId: step.step_id,
        executionType,
        userInput: executionType === 'manual' ? userInput : undefined
      })
      
      toast.success('步骤执行成功')
      setUserInput('')
    } catch (error) {
      console.error('执行步骤失败:', error)
      toast.error('步骤执行失败')
    } finally {
      setIsExecuting(false)
    }
  }

  const handleFeedback = async () => {
    if (!feedbackStep || !feedback.trim() || !sessionId) {
      toast.error('请输入反馈内容')
      return
    }

    try {
      await provideFeedback(sessionId, {
        stepId: feedbackStep.step_id,
        feedback
      })
      
      toast.success('反馈提交成功')
      setShowFeedbackModal(false)
      setFeedback('')
      setFeedbackStep(null)
    } catch (error) {
      console.error('提交反馈失败:', error)
      toast.error('反馈提交失败')
    }
  }

  const getStepStatusIcon = (step: Step) => {
    switch (step.execution_status) {
      case 'completed':
        return <Check className="w-5 h-5 text-success-600" />
      case 'failed':
        return <X className="w-5 h-5 text-error-600" />
      case 'executing':
        return <RefreshCw className="w-5 h-5 text-primary-600 animate-spin" />
      case 'skipped':
        return <ChevronRight className="w-5 h-5 text-gray-400" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getStepStatusBadge = (step: Step) => {
    const statusMap = {
      pending: { label: '待执行', className: 'badge-gray' },
      executing: { label: '执行中', className: 'badge-info' },
      completed: { label: '已完成', className: 'badge-success' },
      failed: { label: '失败', className: 'badge-error' },
      skipped: { label: '已跳过', className: 'badge-warning' }
    }
    
    const status = statusMap[step.execution_status] || statusMap.pending
    return <span className={`badge ${status.className}`}>{status.label}</span>
  }

  if (isLoading) {
    return (
      <div className="container-custom">
        <div className="flex-center min-h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="container-custom">
        <div className="text-center py-12">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">会话不存在</h2>
          <p className="text-gray-600 mb-6">请检查会话ID是否正确</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            返回首页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container-custom">
      <div className="max-w-4xl mx-auto">
        {/* 会话信息头部 */}
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">处置会话</h1>
              <p className="text-gray-600">会话ID: {session.session_id}</p>
            </div>
            <div className="text-right">
              <div className={`badge ${
                session.status === 'completed' ? 'badge-success' :
                session.status === 'processing' ? 'badge-info' :
                'badge-error'
              }`}>
                {session.status === 'completed' ? '已完成' :
                 session.status === 'processing' ? '处理中' :
                 '已中止'}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">问题分类</h3>
              <p className="text-gray-600">{session.problem_category}</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">创建时间</h3>
              <p className="text-gray-600">{new Date(session.created_at).toLocaleString('zh-CN')}</p>
            </div>
          </div>
          
          <div className="mt-4">
            <h3 className="font-medium text-gray-900 mb-2">问题描述</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{session.problem_description}</p>
          </div>

          {/* 进度条 */}
          {sessionStatus && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">处置进度</span>
                <span className="text-sm text-gray-500">
                  {sessionStatus.progress.completed}/{sessionStatus.progress.total} 步骤
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${sessionStatus.progress.percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 处置步骤列表 */}
        <div className="space-y-4">
          {session.steps.map((step, index) => (
            <div key={step.step_id} className="card">
              <div className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
                    {getStepStatusIcon(step)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        步骤 {step.step_order}
                      </h3>
                      <div className="flex items-center space-x-2">
                        {getStepStatusBadge(step)}
                        {step.step_type === 'auto' && (
                          <span className="badge badge-info">自动</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-gray-700 mb-4 whitespace-pre-wrap">
                      {step.step_content}
                    </div>

                    {/* 执行结果 */}
                    {step.execution_result && (
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <h4 className="font-medium text-gray-900 mb-2">执行结果</h4>
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                          {typeof step.execution_result === 'string' 
                            ? step.execution_result 
                            : JSON.stringify(step.execution_result, null, 2)
                          }
                        </pre>
                      </div>
                    )}

                    {/* 用户反馈 */}
                    {step.user_feedback && (
                      <div className="bg-blue-50 rounded-lg p-4 mb-4">
                        <h4 className="font-medium text-gray-900 mb-2">用户反馈</h4>
                        <p className="text-gray-700">{step.user_feedback}</p>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    {step.execution_status === 'pending' && currentStep?.step_id === step.step_id && (
                      <div className="space-y-3">
                        {step.step_type === 'auto' && step.tool_api && (
                          <button
                            onClick={() => handleExecuteStep(step, 'auto')}
                            disabled={isExecuting}
                            className="btn btn-primary flex items-center space-x-2"
                          >
                            <Play className="w-4 h-4" />
                            <span>自动执行</span>
                          </button>
                        )}
                        
                        {step.step_type === 'manual' && (
                          <div className="space-y-3">
                            <textarea
                              className="input"
                              rows={3}
                              placeholder="请输入您的操作结果或遇到的问题..."
                              value={userInput}
                              onChange={(e) => setUserInput(e.target.value)}
                            />
                            <button
                              onClick={() => handleExecuteStep(step, 'manual')}
                              disabled={isExecuting || !userInput.trim()}
                              className="btn btn-primary"
                            >
                              确认完成
                            </button>
                          </div>
                        )}
                        
                        <button
                          onClick={() => {
                            setFeedbackStep(step)
                            setShowFeedbackModal(true)
                          }}
                          className="btn btn-secondary flex items-center space-x-2"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>反馈问题</span>
                        </button>
                      </div>
                    )}

                    {/* 工具API链接 */}
                    {step.tool_api && (
                      <div className="mt-3">
                        <button className="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1">
                          <ExternalLink className="w-3 h-3" />
                          <span>查看工具详情</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 反馈模态框 */}
        {showFeedbackModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">提供反馈</h3>
              <textarea
                className="input mb-4"
                rows={4}
                placeholder="请描述您遇到的问题或需要的帮助..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  className="btn btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleFeedback}
                  disabled={!feedback.trim()}
                  className="btn btn-primary"
                >
                  提交反馈
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SessionPage