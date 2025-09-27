import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Loader, AlertCircle, BookOpen, TrendingUp } from 'lucide-react'
import { apiClient } from '@/utils/api'
import toast from 'react-hot-toast'
import type { CreateSessionRequest } from '@/types'

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<CreateSessionRequest>({
    problemCategory: '',
    problemDescription: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  const problemCategories = [
    { value: 'performance', label: '性能问题', description: 'CPU、内存、磁盘等性能相关问题' },
    { value: 'network', label: '网络问题', description: '网络连接、延迟、丢包等问题' },
    { value: 'service', label: '服务问题', description: '应用服务、数据库、中间件问题' },
    { value: 'security', label: '安全问题', description: '安全漏洞、入侵检测等问题' },
    { value: 'storage', label: '存储问题', description: '磁盘空间、备份恢复等问题' },
    { value: 'other', label: '其他问题', description: '其他运维相关问题' }
  ]

  const exampleProblems = [
    {
      category: 'performance',
      description: '服务器CPU使用率持续超过90%，系统响应缓慢'
    },
    {
      category: 'network',
      description: '部分用户反馈网站访问超时，网络连接不稳定'
    },
    {
      category: 'service',
      description: '数据库连接池耗尽，应用无法正常连接数据库'
    }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.problemCategory || !formData.problemDescription.trim()) {
      toast.error('请选择问题分类并填写问题描述')
      return
    }

    setIsLoading(true)
    try {
      const result = await apiClient.createSession(formData)
      toast.success('会话创建成功，开始智能分析...')
      navigate(`/session/${result.session.session_id}`)
    } catch (error) {
      console.error('创建会话失败:', error)
      toast.error('创建会话失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExampleClick = (example: typeof exampleProblems[0]) => {
    setFormData({
      problemCategory: example.category,
      problemDescription: example.description
    })
  }

  return (
    <div className="container-custom">
      <div className="max-w-4xl mx-auto">
        {/* 头部介绍 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            智能运维助手
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            基于AI的智能运维处置系统，帮助您快速诊断和解决运维问题。
            只需描述问题现象，系统将为您生成详细的处置方案。
          </p>
        </div>

        {/* 统计信息卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 text-center">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">知识库驱动</h3>
            <p className="text-gray-600">基于丰富的运维知识库，提供专业的处置建议</p>
          </div>
          
          <div className="card p-6 text-center">
            <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-6 h-6 text-success-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">智能分析</h3>
            <p className="text-gray-600">AI驱动的问题分析，快速定位根本原因</p>
          </div>
          
          <div className="card p-6 text-center">
            <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-warning-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">渐进式处置</h3>
            <p className="text-gray-600">按步骤引导处置，支持人机协作</p>
          </div>
        </div>

        {/* 问题提交表单 */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                问题分类
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {problemCategories.map((category) => (
                  <label
                    key={category.value}
                    className={`
                      relative flex flex-col p-4 border rounded-lg cursor-pointer transition-all
                      ${formData.problemCategory === category.value
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500'
                        : 'border-gray-300 hover:border-gray-400'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="problemCategory"
                      value={category.value}
                      checked={formData.problemCategory === category.value}
                      onChange={(e) => setFormData(prev => ({ ...prev, problemCategory: e.target.value }))}
                      className="sr-only"
                    />
                    <span className="font-medium text-gray-900">{category.label}</span>
                    <span className="text-sm text-gray-500 mt-1">{category.description}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="problemDescription" className="block text-sm font-medium text-gray-700 mb-2">
                问题描述
              </label>
              <textarea
                id="problemDescription"
                rows={6}
                className="input resize-none"
                placeholder="请详细描述您遇到的问题现象，包括：&#10;1. 问题出现的时间和频率&#10;2. 具体的错误信息或异常表现&#10;3. 影响范围和严重程度&#10;4. 已经尝试过的解决方法&#10;&#10;信息越详细，AI分析越准确"
                value={formData.problemDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, problemDescription: e.target.value }))}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                提交后将进行AI智能分析，生成处置方案
              </div>
              <button
                type="submit"
                disabled={isLoading || !formData.problemCategory || !formData.problemDescription.trim()}
                className="btn btn-primary flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>分析中...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>开始分析</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 示例问题 */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">示例问题</h2>
          <div className="space-y-3">
            {exampleProblems.map((example, index) => (
              <div
                key={index}
                className="card card-hover p-4 cursor-pointer"
                onClick={() => handleExampleClick(example)}
              >
                <div className="flex items-start space-x-3">
                  <div className={`
                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${example.category === 'performance' ? 'bg-red-100 text-red-800' :
                      example.category === 'network' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }
                  `}>
                    {problemCategories.find(cat => cat.value === example.category)?.label}
                  </div>
                  <p className="text-gray-700 flex-1">{example.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage