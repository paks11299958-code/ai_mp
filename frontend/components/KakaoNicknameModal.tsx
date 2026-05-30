import React, { useState } from 'react';

interface Props {
    defaultNickname: string;
    token: string;
    onComplete: (username: string) => void;
}

export default function KakaoNicknameModal({ defaultNickname, token, onComplete }: Props) {
    const [nickname, setNickname] = useState(defaultNickname);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        const trimmed = nickname.trim();
        if (!trimmed) { setError('닉네임을 입력해주세요.'); return; }
        if (trimmed.length > 20) { setError('닉네임은 20자 이하로 입력해주세요.'); return; }
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/kakao/set-nickname', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ nickname: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || '오류가 발생했습니다.'); return; }
            onComplete(data.user.username);
        } catch {
            setError('네트워크 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit();
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
        }}>
            <div style={{
                background: '#FBF8F3',
                borderRadius: 20,
                padding: '36px 32px',
                width: 340,
                maxWidth: '90vw',
                boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                display: 'flex', flexDirection: 'column', gap: 16,
                fontFamily: 'inherit',
            }}>
                {/* 카카오 아이콘 + 제목 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 52, height: 52, borderRadius: '50%',
                        background: '#FEE500',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 26,
                    }}>
                        💬
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#3B2A1A' }}>
                        닉네임을 설정해주세요
                    </div>
                    <div style={{ fontSize: 13, color: '#8B7355', textAlign: 'center', lineHeight: 1.5 }}>
                        서비스에서 사용할 별명입니다.<br />
                        <span style={{ color: '#C07A3A', fontWeight: 600 }}>실명 대신 별명 사용을 권장합니다.</span><br />
                        나중에 프로필에서 변경할 수 있어요.
                    </div>
                </div>

                {/* 입력 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                        type="text"
                        value={nickname}
                        onChange={e => setNickname(e.target.value)}
                        onKeyDown={handleKeyDown}
                        maxLength={20}
                        placeholder="닉네임 입력"
                        autoFocus
                        style={{
                            border: '1.5px solid #D4B896',
                            borderRadius: 10,
                            padding: '12px 14px',
                            fontSize: 15,
                            background: '#FFFDF9',
                            color: '#3B2A1A',
                            outline: 'none',
                            width: '100%',
                            boxSizing: 'border-box',
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#B8A090' }}>
                        {error
                            ? <span style={{ color: '#E05C5C' }}>{error}</span>
                            : <span>카카오 닉네임이 기본값으로 채워졌어요</span>
                        }
                        <span>{nickname.length}/20</span>
                    </div>
                </div>

                {/* 확인 버튼 */}
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                        background: loading ? '#C4A882' : '#8E6FB7',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '13px 0',
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s',
                    }}
                >
                    {loading ? '저장 중...' : '시작하기'}
                </button>
            </div>
        </div>
    );
}
