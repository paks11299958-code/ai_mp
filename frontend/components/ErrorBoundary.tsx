import React from 'react';

interface Props {
    children: React.ReactNode;
    onClose?: () => void;
    label?: string;
}
interface State { error: Error | null; }

/**
 * 자식 컴포넌트의 렌더 에러를 가둬 앱 전체가 까맣게 죽는 것을 막는다.
 * 에러 시 안내 카드 + 콘솔 로그(원인 추적용)를 보여준다.
 */
export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }
    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // 콘솔에 정확한 에러 + 컴포넌트 스택 출력 (원인 진단)
        console.error('[ErrorBoundary] 렌더 에러:', error, info.componentStack);
    }

    render() {
        if (this.state.error) {
            return (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-full max-w-md rounded-2xl p-6 text-center" style={{ background: '#FBF8F3', border: '1px solid #E8DDD0' }}>
                        <p className="text-2xl mb-2">⚠️</p>
                        <p className="text-sm font-bold mb-1" style={{ color: '#2D2438' }}>
                            {this.props.label ?? '화면을 표시하는 중 문제가 생겼어요'}
                        </p>
                        <p className="text-xs mb-4" style={{ color: '#9089A1' }}>
                            잠시 후 다시 시도해 주세요. 문제가 계속되면 새로고침해 주세요.
                        </p>
                        <div className="flex gap-2 justify-center">
                            <button onClick={() => this.setState({ error: null })}
                                className="text-xs font-semibold px-4 py-2 rounded-xl" style={{ color: '#fff', background: '#8E6FB7' }}>
                                다시 시도
                            </button>
                            {this.props.onClose && (
                                <button onClick={this.props.onClose}
                                    className="text-xs px-4 py-2 rounded-xl" style={{ color: '#6B5F56', border: '1px solid #E8DDD0' }}>
                                    닫기
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
