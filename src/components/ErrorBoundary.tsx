/**
 * React 에러 바운더리
 * 런타임 에러 발생 시 앱 크래시 방지, 에러 정보 표시
 */
import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] 에러 감지:', error, errorInfo);
    this.setState({ errorInfo });

    // 크래시 리포터에 에러 전송 (SQLite 로컬 저장)
    import('../utils/crashReporter').then(({ logCrash }) => {
      logCrash('react_error_boundary', error.message, error.stack, {
        componentStack: errorInfo.componentStack,
      });
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="error-boundary">
          <h2>오류가 발생했습니다</h2>
          <p className="error-message">{this.state.error?.message}</p>
          {this.state.errorInfo && (
            <details className="error-details">
              <summary>상세 정보</summary>
              <pre>{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
          <button className="btn-primary" onClick={this.handleReset}>
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
