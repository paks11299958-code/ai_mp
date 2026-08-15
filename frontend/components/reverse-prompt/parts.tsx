import React, { useCallback, useState } from 'react';

// 리버스 프롬프트 — 화면 공용 조각
// ★색상은 기존 사이트 베이지 톤을 그대로 쓴다(learning/* 와 동일):
//   배경 #F5EFE6 / 본문 #2D2438 / 보조 #5C5468 / 테두리 #F0E9DE / 포인트 indigo.
//   새 색상 체계나 UI 라이브러리를 도입하지 않는다.

/** 화면 공통 헤더. 뒤로가기는 헤더 내 텍스트 버튼(learning 선례와 동일). */
export const RpHeader: React.FC<{ title: string; backTo?: string; right?: React.ReactNode }> = ({
    title,
    backTo = '/',
    right,
}) => (
    <header className="sticky top-0 z-10 bg-[#F5EFE6]/90 backdrop-blur border-b border-[#F0E9DE]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
            <button
                onClick={() => { window.location.href = backTo; }}
                className="flex items-center gap-1.5 h-full text-sm text-indigo-700 font-semibold shrink-0"
            >
                ← {backTo === '/' ? 'AI 스퀘어' : '뒤로'}
            </button>
            {/* ★360px에서 제목이 길면 줄바꿈 대신 말줄임 — 가로 스크롤을 만들지 않는다 */}
            <span className="text-sm font-extrabold truncate">{title}</span>
            <span className="shrink-0 min-w-16 text-right">{right}</span>
        </div>
    </header>
);

/**
 * 복사 버튼. 클릭 시 "복사됨" 피드백을 준다(PRD 5장).
 * ★navigator.clipboard는 https 또는 localhost에서만 동작한다.
 *   실패 시 textarea + execCommand로 폴백해 어디서든 복사가 되게 한다.
 */
export const CopyButton: React.FC<{ text: string; label?: string; className?: string }> = ({
    text,
    label = '복사',
    className = '',
}) => {
    const [copied, setCopied] = useState(false);

    const copy = useCallback(async () => {
        let ok = false;
        try {
            await navigator.clipboard.writeText(text);
            ok = true;
        } catch {
            // 폴백 — 구형 브라우저·비보안 컨텍스트
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                ok = document.execCommand('copy');
                document.body.removeChild(ta);
            } catch {
                ok = false;
            }
        }
        if (ok) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        }
    }, [text]);

    return (
        <button
            onClick={copy}
            className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors shrink-0 ${
                copied
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-indigo-500/15 text-indigo-700 hover:bg-indigo-500/25'
            } ${className}`}
        >
            {copied ? '복사됨 ✓' : label}
        </button>
    );
};

/**
 * 에러 표시. ★콘솔에만 남기지 않고 화면에 보여준다(지시 17번).
 * 재시도 버튼을 함께 둬서 사용자가 올린 파일을 잃지 않게 한다(지시 18번).
 */
export const RpError: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <p className="text-sm text-rose-800 leading-relaxed break-words">{message}</p>
        {onRetry && (
            <button
                onClick={onRetry}
                className="mt-3 text-xs font-bold px-3 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
            >
                다시 시도
            </button>
        )}
    </div>
);

/** 프롬프트 한 덩어리 + 복사 버튼. MJ/SD positive/negative가 모두 이 모양을 쓴다. */
export const PromptBlock: React.FC<{
    title: string;
    text: string;
    tone?: 'indigo' | 'slate';
    hint?: string;
}> = ({ title, text, tone = 'indigo', hint }) => (
    <div className="rounded-2xl bg-white border border-[#F0E9DE] p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
            <div className="min-w-0">
                <h3
                    className={`text-sm font-extrabold ${
                        tone === 'indigo' ? 'text-indigo-700' : 'text-[#5C5468]'
                    }`}
                >
                    {title}
                </h3>
                {hint && <p className="text-[11px] text-[#9089A1] mt-0.5">{hint}</p>}
            </div>
            <CopyButton text={text} />
        </div>
        {/* ★break-words + whitespace-pre-wrap — 긴 프롬프트가 360px에서 가로로 삐져나가지 않게 */}
        <p className="text-[13px] leading-relaxed text-[#2D2438] whitespace-pre-wrap break-words">
            {text || <span className="text-[#9089A1]">(없음)</span>}
        </p>
    </div>
);

/** 로딩 표시. 분석은 실측 약 4초라 그동안 화면이 죽지 않게 한다(지시 3번). */
export const RpLoading: React.FC<{ label?: string }> = ({ label = '분석 중이에요' }) => (
    <div className="rounded-2xl bg-white border border-[#F0E9DE] p-8 text-center">
        <div className="inline-block w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="mt-3 text-sm font-semibold text-[#2D2438]">{label}</p>
        <p className="mt-1 text-xs text-[#9089A1]">보통 5초 안에 끝나요</p>
    </div>
);

/** 잔여 횟수 배지. */
export const QuotaBadge: React.FC<{ remaining: number; limit: number }> = ({ remaining, limit }) => (
    <span className="text-xs text-[#5C5468]">
        오늘 <b className={remaining > 0 ? 'text-indigo-700' : 'text-rose-600'}>{remaining}</b>
        <span className="text-[#9089A1]">/{limit}</span>회 남음
    </span>
);
