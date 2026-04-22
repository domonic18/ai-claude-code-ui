// React 错误边界组件：捕获子组件树中未处理的渲染异常，展示降级 UI 并支持重试
import React, { Component, ReactNode } from 'react';
import { logger } from '@/shared/utils/logger';

export interface ErrorBoundaryProps {
  children: ReactNode;
  showDetails?: boolean;
  onRetry?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  // 静态方法：渲染阶段捕获错误，触发降级 UI 显示
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  // 提交阶段捕获错误信息和组件栈，用于日志记录
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  // 重置错误状态并调用外部重试回调，允许子组件树重新渲染
  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="ml-3 text-sm font-medium text-red-800">
                Something went wrong
              </h3>
            </div>
            <div className="text-sm text-red-700">
              <p className="mb-2">An error occurred while loading the chat interface.</p>
              {this.props.showDetails && this.state.error && (
                // 开发环境下可通过 showDetails 展示完整错误栈，辅助调试
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-mono">Error Details</summary>
                  <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
            <div className="mt-4">
              <button
                onClick={this.handleRetry}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
