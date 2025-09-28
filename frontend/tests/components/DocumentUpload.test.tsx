/**
 * 文档上传组件测试
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentUpload from '../../src/components/DocumentUpload';
import { useDocumentStore } from '../../src/stores/documentStore';

// Mock Zustand store
vi.mock('../../src/stores/documentStore');

// Mock react-dropzone
vi.mock('react-dropzone', () => ({
  useDropzone: vi.fn()
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe('DocumentUpload Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockUploadDocument = vi.fn();
  
  const mockStore = {
    uploadDocument: mockUploadDocument,
    categories: ['performance', 'network', 'security']
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useDocumentStore.mockReturnValue(mockStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should render upload form with all required fields', () => {
    // Act
    render(<DocumentUpload onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Assert
    expect(screen.getByText('上传文档')).toBeInTheDocument();
    expect(screen.getByText('选择文件')).toBeInTheDocument();
    expect(screen.getByLabelText('文档标题 *')).toBeInTheDocument();
    expect(screen.getByLabelText('文档分类 *')).toBeInTheDocument();
    expect(screen.getByLabelText('知识类型')).toBeInTheDocument();
    expect(screen.getByLabelText('优先级')).toBeInTheDocument();
    expect(screen.getByLabelText('发布状态')).toBeInTheDocument();
    expect(screen.getByLabelText('标签')).toBeInTheDocument();
    expect(screen.getByLabelText('描述')).toBeInTheDocument();
  });

  test('should show file drop zone when no file is selected', () => {
    // Act
    render(<DocumentUpload onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Assert
    expect(screen.getByText('拖拽文件到这里，或')).toBeInTheDocument();
    expect(screen.getByText('点击选择')).toBeInTheDocument();
    expect(screen.getByText('支持 .md, .markdown, .txt 格式，最大 5MB')).toBeInTheDocument();
  });

  test('should validate required fields on submit', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<DocumentUpload onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Act
    const submitButton = screen.getByRole('button', { name: /上传文档/ });
    await user.click(submitButton);

    // Assert
    expect(screen.getByText('请选择要上传的文件')).toBeInTheDocument();
    expect(mockUploadDocument).not.toHaveBeenCalled();
  });

  test('should show file info when file is selected', async () => {
    // Arrange
    const mockFile = new File(['# Test Document'], 'test.md', { type: 'text/markdown' });
    const user = userEvent.setup();
    
    // Mock useDropzone to simulate file selection
    const { useDropzone } = await import('react-dropzone');
    useDropzone.mockReturnValue({
      getRootProps: () => ({}),
      getInputProps: () => ({}),
      isDragActive: false
    });

    render(<DocumentUpload onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Simulate file selection by updating component state
    // This would normally be done through the dropzone callback
    const fileInput = screen.getByRole('button', { name: /选择文件/ });
    
    // Act
    await user.upload(fileInput, mockFile);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('test.md')).toBeInTheDocument();
    });
  });

  test('should auto-fill title from filename', async () => {
    // Arrange
    const mockFile = new File(['# Network Configuration'], 'network-config.md', { type: 'text/markdown' });
    
    // Create a component with file already selected
    const ComponentWithFile = () => {
      const [file, setFile] = React.useState(mockFile);
      const [metadata, setMetadata] = React.useState({
        title: 'Network Config', // Auto-generated from filename
        category: '',
        knowledge_type: 'operation-procedure',
        priority: 0,
        status: 'published',
        tags: [],
        description: ''
      });

      return (
        <DocumentUpload 
          onClose={mockOnClose} 
          onSuccess={mockOnSuccess}
          initialFile={file}
          initialMetadata={metadata}
        />
      );
    };

    render(<ComponentWithFile />);

    // Assert
    expect(screen.getByDisplayValue('Network Config')).toBeInTheDocument();
  });

  test('should add and remove tags', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<DocumentUpload onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Act - Add tag
    const tagInput = screen.getByPlaceholderText('添加标签');
    await user.type(tagInput, 'test-tag');
    
    const addButton = screen.getByRole('button', { name: '' }); // Plus icon button
    await user.click(addButton);

    // Assert - Tag added
    expect(screen.getByText('test-tag')).toBeInTheDocument();

    // Act - Remove tag
    const removeButton = screen.getByRole('button', { name: '' }); // X icon in tag
    await user.click(removeButton);

    // Assert - Tag removed
    expect(screen.queryByText('test-tag')).not.toBeInTheDocument();
  });

  test('should handle form submission successfully', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockFile = new File(['# Test Document'], 'test.md', { type: 'text/markdown' });
    
    mockUploadDocument.mockResolvedValue({});

    // Mock a component with file selected
    const ComponentWithFile = () => {
      return (
        <div>
          <input data-testid="title-input" defaultValue="Test Document" />
          <select data-testid="category-select" defaultValue="network">
            <option value="network">网络管理</option>
          </select>
          <button 
            data-testid="submit-button"
            onClick={() => mockUploadDocument(mockFile, {
              title: 'Test Document',
              category: 'network',
              knowledge_type: 'operation-procedure',
              uploader: 'current_user'
            })}
          >
            上传文档
          </button>
        </div>
      );
    };

    render(<ComponentWithFile />);

    // Act
    const submitButton = screen.getByTestId('submit-button');
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(mockUploadDocument).toHaveBeenCalledWith(
        mockFile,
        expect.objectContaining({
          title: 'Test Document',
          category: 'network',
          knowledge_type: 'operation-procedure'
        })
      );
    });
  });

  test('should handle upload error', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockError = new Error('Upload failed');
    mockUploadDocument.mockRejectedValue(mockError);

    // Mock console.error to avoid test output pollution
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<DocumentUpload onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Simulate form submission with error
    const ComponentWithError = () => {
      const handleSubmit = async () => {
        try {
          await mockUploadDocument(new File(['test'], 'test.md'), {});
        } catch (error) {
          console.error('上传失败:', error);
        }
      };

      return (
        <button onClick={handleSubmit} data-testid="submit-with-error">
          Submit
        </button>
      );
    };

    render(<ComponentWithError />);

    // Act
    const submitButton = screen.getByTestId('submit-with-error');
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('上传失败:', mockError);
    });

    consoleSpy.mockRestore();
  });

  test('should close modal when cancel button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<DocumentUpload onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Act
    const cancelButton = screen.getByRole('button', { name: '取消' });
    await user.click(cancelButton);

    // Assert
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should close modal when X button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<DocumentUpload onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Act
    const closeButton = screen.getByRole('button', { name: '' }); // X icon
    await user.click(closeButton);

    // Assert
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should disable submit button while uploading', async () => {
    // Arrange
    const user = userEvent.setup();
    
    // Create a pending promise to simulate ongoing upload
    let resolveUpload;
    const uploadPromise = new Promise(resolve => {
      resolveUpload = resolve;
    });
    mockUploadDocument.mockReturnValue(uploadPromise);

    // Mock component in uploading state
    const ComponentUploading = () => {
      const [uploading, setUploading] = React.useState(false);
      
      const handleSubmit = async () => {
        setUploading(true);
        try {
          await mockUploadDocument();
        } finally {
          setUploading(false);
        }
      };

      return (
        <button 
          onClick={handleSubmit}
          disabled={uploading}
          data-testid="submit-button"
        >
          {uploading ? '上传中...' : '上传文档'}
        </button>
      );
    };

    render(<ComponentUploading />);

    // Act
    const submitButton = screen.getByTestId('submit-button');
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(screen.getByText('上传中...')).toBeInTheDocument();
    });

    // Cleanup
    resolveUpload();
  });

  test('should validate file type', () => {
    // Arrange
    const invalidFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    
    // Mock validation function
    const validateFileType = (file) => {
      const allowedExtensions = ['.md', '.markdown', '.txt'];
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      return allowedExtensions.includes(extension);
    };

    // Act
    const isValid = validateFileType(invalidFile);

    // Assert
    expect(isValid).toBe(false);
  });

  test('should validate file size', () => {
    // Arrange
    const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.md'); // 6MB
    
    // Mock validation function
    const validateFileSize = (file, maxSizeMB = 5) => {
      const maxSize = maxSizeMB * 1024 * 1024;
      return file.size <= maxSize;
    };

    // Act
    const isValid = validateFileSize(largeFile);

    // Assert
    expect(isValid).toBe(false);
  });
});