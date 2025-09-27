/**
 * Jest测试配置
 */

// 设置测试超时时间
jest.setTimeout(30000);

// Mock console methods for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// 全局模拟
global.fetch = jest.fn();

// 清理函数
afterEach(() => {
  jest.clearAllMocks();
});

// 环境变量设置
process.env.NODE_ENV = 'test';
process.env.LLM_PROVIDER = 'mock';
process.env.MOCK_MODE = 'true';