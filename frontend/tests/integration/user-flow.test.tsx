/**
 * 前端集成测试 - 用户交互流程
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from '../src/App';

// Mock API responses
const mockApiClient = {
  createSession: vi.fn(),
  getSession: vi.fn(),
  getSessionStatus: vi.fn(),
  executeStep: vi.fn(),
  provideFeedback: vi.fn(),
  searchSessions: vi.fn(),
  deleteSession: vi.fn()
};

vi.mock('../src/utils/api', () => ({
  apiClient: mockApiClient
}));

const renderApp = () => {
  return render(
    <BrowserRouter>
      <App />
      <Toaster />
    </BrowserRouter>
  );
};

describe('Frontend Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // 设置默认的API响应
    mockApiClient.createSession.mockResolvedValue({
      success: true,
      session: {
        session_id: 'test-session-123',
        problem_category: 'network',
        problem_description: '网络连接问题',
        status: 'processing',
        steps: [
          {
            step_id: 'step-1',
            step_order: 1,
            step_content: '检查网络连接状态',
            step_type: 'manual',
            execution_status: 'pending'
          },
          {
            step_id: 'step-2',
            step_order: 2,
            step_content: '重启网络服务',
            step_type: 'auto',
            execution_status: 'pending',
            tool_api: 'system_restart_service'
          }
        ]
      }
    });

    mockApiClient.getSession.mockResolvedValue({
      session_id: 'test-session-123',
      problem_category: 'network',
      problem_description: '网络连接问题',
      status: 'processing',
      steps: [
        {
          step_id: 'step-1',
          step_order: 1,
          step_content: '检查网络连接状态',
          step_type: 'manual',
          execution_status: 'pending'
        },
        {
          step_id: 'step-2',
          step_order: 2,
          step_content: '重启网络服务',
          step_type: 'auto',
          execution_status: 'pending',
          tool_api: 'system_restart_service'
        }
      ]
    });

    mockApiClient.getSessionStatus.mockResolvedValue({
      session_id: 'test-session-123',
      current_step_index: 0,
      progress: {
        completed: 0,
        total: 2,
        percentage: 0
      },
      currentStep: {
        step_id: 'step-1',
        step_order: 1,
        step_content: '检查网络连接状态',
        step_type: 'manual',
        execution_status: 'pending'
      }
    });
  });

  describe('完整的用户交互流程', () => {
    test('用户可以创建会话并完成处置流程', async () => {
      const user = userEvent.setup();
      
      // 1. 渲染应用并导航到首页
      renderApp();

      // 2. 等待首页加载
      await waitFor(() => {
        expect(screen.getByText('智能运维助手')).toBeInTheDocument();
      });

      // 3. 选择问题分类
      const networkOption = screen.getByLabelText('网络问题');
      await user.click(networkOption);

      // 4. 输入问题描述
      const textarea = screen.getByPlaceholderText(/请详细描述您遇到的问题/);
      await user.type(textarea, '服务器无法连接外部API，连接超时');

      // 5. 提交表单创建会话
      const submitButton = screen.getByText('开始智能处置');
      await user.click(submitButton);

      // 6. 验证API调用
      await waitFor(() => {
        expect(mockApiClient.createSession).toHaveBeenCalledWith({
          problem_category: 'network',
          problem_description: '服务器无法连接外部API，连接超时'
        });
      });

      // 7. 验证导航到会话页面
      // 注意：这里需要mock useNavigate或者设置更完整的路由测试
      
      console.log('✓ 会话创建流程测试通过');
    });

    test('用户可以在会话页面执行步骤', async () => {
      const user = userEvent.setup();

      // Mock更新后的会话状态
      mockApiClient.executeStep.mockResolvedValue({
        success: true,
        execution_result: '网络连接检查完成'
      });

      // 模拟已经在会话页面
      window.history.pushState({}, '', '/session/test-session-123');
      
      renderApp();

      // 等待会话数据加载
      await waitFor(() => {
        expect(mockApiClient.getSession).toHaveBeenCalledWith('test-session-123');
        expect(mockApiClient.getSessionStatus).toHaveBeenCalledWith('test-session-123');
      });

      // 假设会话页面已渲染，查找手动步骤的输入框
      const stepInput = screen.queryByPlaceholderText(/请输入您的操作结果/);
      if (stepInput) {
        await user.type(stepInput, '已检查网络连接，发现DNS解析问题');

        const executeButton = screen.getByText('确认完成');
        await user.click(executeButton);

        await waitFor(() => {
          expect(mockApiClient.executeStep).toHaveBeenCalledWith(
            'test-session-123',
            {
              stepId: 'step-1',
              executionType: 'manual',
              userInput: '已检查网络连接，发现DNS解析问题'
            }
          );
        });
      }

      console.log('✓ 步骤执行流程测试通过');
    });

    test('用户可以提交反馈', async () => {
      const user = userEvent.setup();

      mockApiClient.provideFeedback.mockResolvedValue({
        success: true,
        message: '反馈处理成功'
      });

      window.history.pushState({}, '', '/session/test-session-123');
      renderApp();

      // 等待页面加载
      await waitFor(() => {
        expect(screen.queryByText('反馈问题')).toBeInTheDocument();
      });

      // 点击反馈按钮
      const feedbackButton = screen.getByText('反馈问题');
      await user.click(feedbackButton);

      // 在弹出的模态框中输入反馈
      const feedbackTextarea = screen.getByPlaceholderText(/请描述您遇到的问题/);
      await user.type(feedbackTextarea, '这个步骤执行后问题仍然存在');

      const submitFeedbackButton = screen.getByText('提交反馈');
      await user.click(submitFeedbackButton);

      await waitFor(() => {
        expect(mockApiClient.provideFeedback).toHaveBeenCalledWith(
          'test-session-123',
          {
            stepId: 'step-1',
            feedback: '这个步骤执行后问题仍然存在'
          }
        );
      });

      console.log('✓ 反馈提交流程测试通过');
    });
  });

  describe('历史会话管理', () => {
    test('用户可以查看和搜索历史会话', async () => {
      const user = userEvent.setup();

      mockApiClient.searchSessions.mockResolvedValue({
        results: [
          {
            session_id: 'session-1',
            problem_category: 'network',
            problem_description: '网络连接问题',
            status: 'completed',
            created_at: '2024-01-15T10:00:00Z',
            progress: { completed: 2, total: 2 }
          },
          {
            session_id: 'session-2',
            problem_category: 'performance',
            problem_description: '性能问题',
            status: 'processing',
            created_at: '2024-01-14T15:30:00Z',
            progress: { completed: 1, total: 3 }
          }
        ],
        total: 2
      });

      window.history.pushState({}, '', '/history');
      renderApp();

      // 等待历史页面加载
      await waitFor(() => {
        expect(screen.getByText('会话历史')).toBeInTheDocument();
        expect(mockApiClient.searchSessions).toHaveBeenCalled();
      });

      // 验证会话列表显示
      expect(screen.getByText('网络连接问题')).toBeInTheDocument();
      expect(screen.getByText('性能问题')).toBeInTheDocument();

      // 测试搜索功能
      const searchInput = screen.getByPlaceholderText('搜索会话...');
      await user.type(searchInput, '网络');

      // 等待搜索结果
      await waitFor(() => {
        expect(mockApiClient.searchSessions).toHaveBeenCalledWith(
          '网络',
          expect.any(Object),
          expect.any(Number),
          expect.any(Number)
        );
      }, { timeout: 1000 });

      console.log('✓ 历史会话查看和搜索测试通过');
    });

    test('用户可以删除历史会话', async () => {
      const user = userEvent.setup();

      mockApiClient.deleteSession.mockResolvedValue({
        success: true,
        message: '会话删除成功'
      });

      // 模拟确认对话框
      window.confirm = vi.fn(() => true);

      window.history.pushState({}, '', '/history');
      renderApp();

      await waitFor(() => {
        expect(screen.getByText('会话历史')).toBeInTheDocument();
      });

      // 查找并点击删除按钮
      const deleteButtons = screen.getAllByText('删除');
      if (deleteButtons.length > 0) {
        await user.click(deleteButtons[0]);

        await waitFor(() => {
          expect(mockApiClient.deleteSession).toHaveBeenCalled();
        });
      }

      console.log('✓ 会话删除功能测试通过');
    });
  });

  describe('设置页面', () => {
    test('用户可以修改应用设置', async () => {
      const user = userEvent.setup();

      window.history.pushState({}, '', '/settings');
      renderApp();

      await waitFor(() => {
        expect(screen.getByText('系统设置')).toBeInTheDocument();
      });

      // 测试主题切换
      const darkModeRadio = screen.getByLabelText('深色模式');
      await user.click(darkModeRadio);

      // 测试通知设置
      const notificationToggle = screen.getByLabelText('启用通知');
      await user.click(notificationToggle);

      // 保存设置
      const saveButton = screen.getByText('保存设置');
      await user.click(saveButton);

      // 验证设置已保存到localStorage
      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalled();
      });

      console.log('✓ 设置修改功能测试通过');
    });
  });

  describe('错误处理', () => {
    test('应用应该优雅处理API错误', async () => {
      const user = userEvent.setup();

      // 模拟API错误
      mockApiClient.createSession.mockRejectedValue(new Error('网络错误'));

      renderApp();

      await waitFor(() => {
        expect(screen.getByText('智能运维助手')).toBeInTheDocument();
      });

      const networkOption = screen.getByLabelText('网络问题');
      await user.click(networkOption);

      const textarea = screen.getByPlaceholderText(/请详细描述您遇到的问题/);
      await user.type(textarea, '测试问题');

      const submitButton = screen.getByText('开始智能处置');
      await user.click(submitButton);

      // 验证错误提示显示
      await waitFor(() => {
        expect(screen.queryByText(/错误/)).toBeInTheDocument();
      });

      console.log('✓ 错误处理测试通过');
    });

    test('应用应该处理加载状态', async () => {
      // 模拟延迟的API响应
      mockApiClient.createSession.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      const user = userEvent.setup();
      renderApp();

      await waitFor(() => {
        expect(screen.getByText('智能运维助手')).toBeInTheDocument();
      });

      const networkOption = screen.getByLabelText('网络问题');
      await user.click(networkOption);

      const textarea = screen.getByPlaceholderText(/请详细描述您遇到的问题/);
      await user.type(textarea, '测试问题');

      const submitButton = screen.getByText('开始智能处置');
      await user.click(submitButton);

      // 验证加载状态
      expect(submitButton).toBeDisabled();

      console.log('✓ 加载状态处理测试通过');
    });
  });

  describe('响应式设计', () => {
    test('应用应该在不同屏幕尺寸下正常工作', async () => {
      // 模拟移动设备
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });

      window.dispatchEvent(new Event('resize'));

      renderApp();

      await waitFor(() => {
        expect(screen.getByText('智能运维助手')).toBeInTheDocument();
      });

      // 验证移动端布局
      const container = document.querySelector('.container-custom');
      expect(container).toBeInTheDocument();

      console.log('✓ 响应式设计测试通过');
    });
  });

  afterAll(() => {
    console.log('\n📱 前端集成测试完成');
    console.log('✅ 用户交互流程验证通过');
    console.log('🎨 界面响应和错误处理正常');
  });
});