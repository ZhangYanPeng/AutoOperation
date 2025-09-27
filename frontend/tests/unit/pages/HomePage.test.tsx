/**
 * HomePage组件单元测试
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import HomePage from '../src/pages/HomePage';

// Mock hooks
jest.mock('../src/hooks', () => ({
  useSession: () => ({
    isLoading: false,
    createSession: jest.fn().mockResolvedValue({
      success: true,
      session: {
        session_id: 'test-session-id',
        status: 'processing'
      }
    })
  })
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
      <Toaster />
    </BrowserRouter>
  );
};

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('应该渲染首页标题和描述', () => {
    renderWithRouter(<HomePage />);

    expect(screen.getByText('智能运维助手')).toBeInTheDocument();
    expect(screen.getByText(/基于大语言模型的智能化运维处置系统/)).toBeInTheDocument();
  });

  test('应该渲染问题分类选项', () => {
    renderWithRouter(<HomePage />);

    expect(screen.getByText('性能问题')).toBeInTheDocument();
    expect(screen.getByText('网络问题')).toBeInTheDocument();
    expect(screen.getByText('服务问题')).toBeInTheDocument();
    expect(screen.getByText('安全问题')).toBeInTheDocument();
    expect(screen.getByText('存储问题')).toBeInTheDocument();
    expect(screen.getByText('其他问题')).toBeInTheDocument();
  });

  test('应该选择问题分类', () => {
    renderWithRouter(<HomePage />);

    const networkOption = screen.getByText('网络问题').closest('label');
    fireEvent.click(networkOption);

    const radioInput = networkOption.querySelector('input[type="radio"]');
    expect(radioInput).toBeChecked();
  });

  test('应该输入问题描述', () => {
    renderWithRouter(<HomePage />);

    const textarea = screen.getByPlaceholderText(/请详细描述您遇到的问题/);
    fireEvent.change(textarea, { target: { value: '网络连接超时问题' } });

    expect(textarea.value).toBe('网络连接超时问题');
  });

  test('应该在输入不足时禁用提交按钮', () => {
    renderWithRouter(<HomePage />);

    const submitButton = screen.getByText('开始智能处置');
    expect(submitButton).toBeDisabled();

    // 只选择分类，不输入描述
    const networkOption = screen.getByText('网络问题').closest('label');
    fireEvent.click(networkOption);
    expect(submitButton).toBeDisabled();

    // 只输入描述，不选择分类
    const textarea = screen.getByPlaceholderText(/请详细描述您遇到的问题/);
    fireEvent.change(textarea, { target: { value: '网络问题描述' } });
    
    // 重新渲染
    renderWithRouter(<HomePage />);
    const newSubmitButton = screen.getByText('开始智能处置');
    expect(newSubmitButton).toBeDisabled();
  });

  test('应该在完整输入后启用提交按钮', () => {
    renderWithRouter(<HomePage />);

    // 选择分类
    const networkOption = screen.getByText('网络问题').closest('label');
    fireEvent.click(networkOption);

    // 输入描述
    const textarea = screen.getByPlaceholderText(/请详细描述您遇到的问题/);
    fireEvent.change(textarea, { target: { value: '网络连接超时，无法访问外部服务' } });

    const submitButton = screen.getByText('开始智能处置');
    expect(submitButton).not.toBeDisabled();
  });

  test('应该成功创建会话并跳转', async () => {
    const mockCreateSession = jest.fn().mockResolvedValue({
      success: true,
      session: {
        session_id: 'test-session-id',
        status: 'processing'
      }
    });

    jest.doMock('../src/hooks', () => ({
      useSession: () => ({
        isLoading: false,
        createSession: mockCreateSession
      })
    }));

    renderWithRouter(<HomePage />);

    // 选择分类
    const networkOption = screen.getByText('网络问题').closest('label');
    fireEvent.click(networkOption);

    // 输入描述
    const textarea = screen.getByPlaceholderText(/请详细描述您遇到的问题/);
    fireEvent.change(textarea, { 
      target: { value: '网络连接超时，无法访问外部服务' } 
    });

    // 提交表单
    const submitButton = screen.getByText('开始智能处置');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith({
        problem_category: 'network',
        problem_description: '网络连接超时，无法访问外部服务'
      });
      expect(mockNavigate).toHaveBeenCalledWith('/session/test-session-id');
    });
  });

  test('应该处理创建会话失败', async () => {
    const mockCreateSession = jest.fn().mockRejectedValue(new Error('创建失败'));

    jest.doMock('../src/hooks', () => ({
      useSession: () => ({
        isLoading: false,
        createSession: mockCreateSession
      })
    }));

    renderWithRouter(<HomePage />);

    // 选择分类和输入描述
    const networkOption = screen.getByText('网络问题').closest('label');
    fireEvent.click(networkOption);

    const textarea = screen.getByPlaceholderText(/请详细描述您遇到的问题/);
    fireEvent.change(textarea, { target: { value: '测试问题描述' } });

    // 提交表单
    const submitButton = screen.getByText('开始智能处置');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
      // 这里应该显示错误提示，具体取决于错误处理的实现
    });
  });

  test('应该显示加载状态', () => {
    jest.doMock('../src/hooks', () => ({
      useSession: () => ({
        isLoading: true,
        createSession: jest.fn()
      })
    }));

    renderWithRouter(<HomePage />);

    const submitButton = screen.getByText('开始智能处置');
    expect(submitButton).toBeDisabled();
    // 可以添加更多加载状态的检查
  });

  test('应该渲染功能特性卡片', () => {
    renderWithRouter(<HomePage />);

    expect(screen.getByText('智能分析')).toBeInTheDocument();
    expect(screen.getByText('自动化处置')).toBeInTheDocument();
    expect(screen.getByText('实时监控')).toBeInTheDocument();

    expect(screen.getByText(/基于大语言模型深度分析/)).toBeInTheDocument();
    expect(screen.getByText(/自动执行标准化运维操作/)).toBeInTheDocument();
    expect(screen.getByText(/实时监控处置进度/)).toBeInTheDocument();
  });

  test('应该渲染最近会话链接', () => {
    renderWithRouter(<HomePage />);

    const historyLink = screen.getByText('查看历史会话');
    expect(historyLink).toBeInTheDocument();
    expect(historyLink.closest('a')).toHaveAttribute('href', '/history');
  });

  test('应该验证问题描述长度', () => {
    renderWithRouter(<HomePage />);

    const textarea = screen.getByPlaceholderText(/请详细描述您遇到的问题/);
    
    // 测试最小长度
    fireEvent.change(textarea, { target: { value: '短' } });
    const networkOption = screen.getByText('网络问题').closest('label');
    fireEvent.click(networkOption);
    
    const submitButton = screen.getByText('开始智能处置');
    expect(submitButton).toBeDisabled();

    // 测试有效长度
    fireEvent.change(textarea, { 
      target: { value: '这是一个足够长的问题描述，应该可以通过验证' } 
    });
    expect(submitButton).not.toBeDisabled();
  });
});