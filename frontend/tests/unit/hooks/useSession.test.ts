/**
 * useSession hook单元测试
 */

import { renderHook, act } from '@testing-library/react';
import { useSession } from '../src/hooks/useSession';
import { apiClient } from '../src/utils/api';

// Mock API client
jest.mock('../src/utils/api', () => ({
  apiClient: {
    createSession: jest.fn(),
    getSession: jest.fn(),
    getSessionStatus: jest.fn(),
    executeStep: jest.fn(),
    provideFeedback: jest.fn()
  }
}));

// Mock toast
jest.mock('react-hot-toast', () => ({
  default: {
    success: jest.fn(),
    error: jest.fn()
  }
}));

// Mock zustand store
jest.mock('../src/stores/sessionStore', () => ({
  useSessionStore: () => ({
    currentSession: null,
    sessionStatus: null,
    isLoading: false,
    setCurrentSession: jest.fn(),
    setSessionStatus: jest.fn(),
    setLoading: jest.fn(),
    updateStep: jest.fn()
  })
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('useSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    test('应该成功创建会话', async () => {
      const mockSession = {
        session_id: 'test-session-id',
        problem_category: 'network',
        problem_description: '网络问题',
        status: 'processing',
        steps: []
      };

      mockApiClient.createSession.mockResolvedValue({
        success: true,
        session: mockSession
      });

      const { result } = renderHook(() => useSession());

      await act(async () => {
        const response = await result.current.createSession({
          problem_category: 'network',
          problem_description: '网络问题'
        });

        expect(response.success).toBe(true);
        expect(response.session).toEqual(mockSession);
      });

      expect(mockApiClient.createSession).toHaveBeenCalledWith({
        problem_category: 'network',
        problem_description: '网络问题'
      });
    });

    test('应该处理创建会话失败', async () => {
      const errorMessage = '创建会话失败';
      mockApiClient.createSession.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await expect(result.current.createSession({
          problem_category: 'network',
          problem_description: '网络问题'
        })).rejects.toThrow(errorMessage);
      });
    });

    test('应该在创建过程中设置加载状态', async () => {
      mockApiClient.createSession.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const { result } = renderHook(() => useSession());

      act(() => {
        result.current.createSession({
          problem_category: 'network',
          problem_description: '网络问题'
        });
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('loadSession', () => {
    test('应该成功加载会话', async () => {
      const mockSession = {
        session_id: 'test-session-id',
        problem_category: 'network',
        problem_description: '网络问题',
        status: 'processing',
        steps: []
      };

      const mockStatus = {
        session_id: 'test-session-id',
        current_step_index: 0,
        progress: { completed: 0, total: 2, percentage: 0 }
      };

      mockApiClient.getSession.mockResolvedValue(mockSession);
      mockApiClient.getSessionStatus.mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await result.current.loadSession('test-session-id');
      });

      expect(mockApiClient.getSession).toHaveBeenCalledWith('test-session-id');
      expect(mockApiClient.getSessionStatus).toHaveBeenCalledWith('test-session-id');
    });

    test('应该处理会话不存在', async () => {
      mockApiClient.getSession.mockRejectedValue(new Error('会话不存在'));

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await expect(result.current.loadSession('nonexistent-id'))
          .rejects.toThrow('会话不存在');
      });
    });
  });

  describe('executeStep', () => {
    test('应该成功执行自动步骤', async () => {
      const mockResult = {
        success: true,
        execution_result: '步骤执行成功',
        next_step: null
      };

      mockApiClient.executeStep.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useSession());

      await act(async () => {
        const response = await result.current.executeStep('session-id', {
          stepId: 'step-id',
          executionType: 'auto'
        });

        expect(response).toEqual(mockResult);
      });

      expect(mockApiClient.executeStep).toHaveBeenCalledWith('session-id', {
        stepId: 'step-id',
        executionType: 'auto'
      });
    });

    test('应该成功执行手动步骤', async () => {
      const mockResult = {
        success: true,
        execution_result: '用户输入的结果',
        next_step: null
      };

      mockApiClient.executeStep.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useSession());

      await act(async () => {
        const response = await result.current.executeStep('session-id', {
          stepId: 'step-id',
          executionType: 'manual',
          userInput: '用户输入的结果'
        });

        expect(response).toEqual(mockResult);
      });

      expect(mockApiClient.executeStep).toHaveBeenCalledWith('session-id', {
        stepId: 'step-id',
        executionType: 'manual',
        userInput: '用户输入的结果'
      });
    });

    test('应该处理步骤执行失败', async () => {
      mockApiClient.executeStep.mockRejectedValue(new Error('执行失败'));

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await expect(result.current.executeStep('session-id', {
          stepId: 'step-id',
          executionType: 'auto'
        })).rejects.toThrow('执行失败');
      });
    });
  });

  describe('provideFeedback', () => {
    test('应该成功提交反馈', async () => {
      const mockResult = {
        success: true,
        message: '反馈处理成功',
        additional_steps: []
      };

      mockApiClient.provideFeedback.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useSession());

      await act(async () => {
        const response = await result.current.provideFeedback('session-id', {
          stepId: 'step-id',
          feedback: '这个步骤执行有问题'
        });

        expect(response).toEqual(mockResult);
      });

      expect(mockApiClient.provideFeedback).toHaveBeenCalledWith('session-id', {
        stepId: 'step-id',
        feedback: '这个步骤执行有问题'
      });
    });

    test('应该处理反馈提交失败', async () => {
      mockApiClient.provideFeedback.mockRejectedValue(new Error('反馈提交失败'));

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await expect(result.current.provideFeedback('session-id', {
          stepId: 'step-id',
          feedback: '反馈内容'
        })).rejects.toThrow('反馈提交失败');
      });
    });
  });

  describe('状态管理', () => {
    test('应该正确管理加载状态', async () => {
      let resolvePromise;
      mockApiClient.createSession.mockImplementation(() => 
        new Promise(resolve => { resolvePromise = resolve; })
      );

      const { result } = renderHook(() => useSession());

      // 开始异步操作
      act(() => {
        result.current.createSession({
          problem_category: 'network',
          problem_description: '网络问题'
        });
      });

      expect(result.current.isLoading).toBe(true);

      // 完成异步操作
      await act(async () => {
        resolvePromise({ success: true, session: {} });
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isLoading).toBe(false);
    });

    test('应该处理并发请求', async () => {
      mockApiClient.createSession.mockResolvedValue({
        success: true,
        session: { session_id: 'test-id' }
      });

      const { result } = renderHook(() => useSession());

      await act(async () => {
        // 同时发起多个请求
        const promises = [
          result.current.createSession({
            problem_category: 'network',
            problem_description: '问题1'
          }),
          result.current.createSession({
            problem_category: 'performance',
            problem_description: '问题2'
          })
        ];

        await Promise.all(promises);
      });

      expect(mockApiClient.createSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('错误处理', () => {
    test('应该处理网络错误', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      
      mockApiClient.createSession.mockRejectedValue(networkError);

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await expect(result.current.createSession({
          problem_category: 'network',
          problem_description: '网络问题'
        })).rejects.toThrow('Network Error');
      });
    });

    test('应该处理API响应错误', async () => {
      const apiError = {
        response: {
          data: {
            error: { message: 'API错误' }
          },
          status: 400
        }
      };
      
      mockApiClient.createSession.mockRejectedValue(apiError);

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await expect(result.current.createSession({
          problem_category: 'network',
          problem_description: '网络问题'
        })).rejects.toEqual(apiError);
      });
    });
  });
});