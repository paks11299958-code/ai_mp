import React, { useEffect, useRef, useState } from 'react';
import { Persona } from '../types';
import { personaApi, chatApi, sessionApi } from '../services/apiService';
import { TarotCardModal } from './TarotCardModal';

// 🔌 임베드 위젯 채팅 (?embed=<personaId|이름>) — 외부 사이트 iframe 전용 슬림 화면 (2026-07-06)
// - 게스트: /api/embed/chat (가입 없이 하루 3회, 지식창고 주입) → 소진 시 가입 CTA
// - 회원(iframe 안 로그인 or 파티션 저장소에 토큰): 기존 채팅 API. 유나면 타로 모달까지.
// - 본 사이트로 나가는 링크에는 위젯 host를 ref 유입 경로로 남긴다(바이럴 추적).

interface Msg { role: 'user' | 'model'; text: string }

function guestId(): string {
    let id = localStorage.getItem('embed_guest_id');
    if (!id) { id = 'g_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('embed_guest_id', id); }
    return id;
}

export const EmbedChat: React.FC<{ personaKey: string }> = ({ personaKey }) => {
    const [persona, setPersona] = useState<Persona | null>(null);
    const [msgs, setMsgs] = useState<Msg[]>([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [remaining, setRemaining] = useState<number | null>(null);  // 게스트 잔여(응답에서 갱신)
    const [limitHit, setLimitHit] = useState(false);
    const [showTarot, setShowTarot] = useState(false);
    const [sessionId, setSessionId] = useState<number | null>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const isMember = !!localStorage.getItem('token');

    useEffect(() => {
        personaApi.getAll().then(list => {
            const p = list.find(x => x.id === personaKey || x.name === personaKey) || null;
            setPersona(p);
            if (p) setMsgs([{ role: 'model', text: `안녕하세요! ${p.name}예요. ${p.description || '무엇이든 편하게 물어보세요.'} ✨` }]);
        }).catch(() => {});
    }, [personaKey]);

    useEffect(() => { endRef.current?.parentElement?.scrollTo({ top: 999999, behavior: 'smooth' }); }, [msgs]);

    // 무료 체험 소진 후 CTA — ?ref=코드를 붙이면 App.tsx의 arrivedViaReferral 로직이
    // 본 사이트에서 곧장 회원가입 전체화면을 띄운다(2026-07-20 사장 지시: 3회 체험 후
    // 알림+가입화면 전환). ?p=는 가입 후 해당 페르소나로 자연 복귀하도록 남겨둠.
    const mainUrl = `${window.location.origin}/?p=${encodeURIComponent(persona?.id || personaKey)}&ref=AEFWTS5F&utm=widget`;

    // 무료 체험(하루 3회) 소진 알림 → 확인 시 본 사이트 회원가입 화면으로 이동.
    // 창을 새로 열면(target=_blank) iframe 안에 갇힌 위젯에서도 항상 새 탭으로 빠져나간다.
    const notifyLimitAndRedirect = () => {
        // 이름 받침 유무에 따라 '와/과'가 갈려 조사 없이 자연스러운 문장으로(간단·안전).
        if (window.confirm(`오늘 무료 체험 3회를 모두 사용했어요.\n가입하면 ${persona?.name ?? '이 페르소나'}랑 계속 대화할 수 있어요 — 가입 화면으로 이동할까요?`)) {
            window.open(mainUrl, '_blank', 'noopener');
        }
    };

    const send = async (text: string) => {
        const t = text.trim();
        if (!t || busy || !persona) return;
        setMsgs(m => [...m, { role: 'user', text: t }]);
        setInput('');
        setBusy(true);
        try {
            if (isMember) {
                // 회원: 정식 채팅(세션+스트림 대신 단순화 — 스트림 API를 통짜 수신)
                let sid = sessionId;
                if (!sid) {
                    const s = await sessionApi.create(persona.id, t.slice(0, 30));
                    sid = s.id; setSessionId(sid);
                }
                await new Promise<void>((resolve) => {
                    let full = '';
                    chatApi.stream(
                        { personaId: persona.id, text: t, sessionId: sid ?? undefined },
                        chunk => { full += chunk; },
                        fullText => { setMsgs(m => [...m, { role: 'model', text: (fullText || full) || '(응답 없음)' }]); resolve(); },
                        () => { setMsgs(m => [...m, { role: 'model', text: '응답에 실패했어요. 잠시 후 다시 시도해 주세요.' }]); resolve(); },
                    );
                });
            } else {
                const res = await fetch('/api/embed/chat', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ personaId: persona.id, guestId: guestId(), messages: [...msgs, { role: 'user', text: t }] }),
                });
                const data = await res.json();
                if (res.status === 429) { setLimitHit(true); setRemaining(0); notifyLimitAndRedirect(); return; }
                if (!res.ok) throw new Error(data.error || '오류');
                setMsgs(m => [...m, { role: 'model', text: data.reply }]);
                setRemaining(data.remaining);
                // ★2026-07-20 사장 지시: 3회 소진 시 알림 후 전체화면 회원가입으로 즉시 전환.
                if (data.remaining <= 0) { setLimitHit(true); notifyLimitAndRedirect(); }
            }
        } catch (e: any) {
            setMsgs(m => [...m, { role: 'model', text: '연결이 잠깐 불안정했어요. 다시 시도해 주세요 🙏' }]);
        } finally {
            setBusy(false);
        }
    };

    if (!persona) return <div style={{ padding: 24, fontFamily: 'sans-serif', color: '#666' }}>불러오는 중…</div>;

    const isYuna = persona.name === '유나';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxHeight: '100dvh', background: '#FBF8F3', fontFamily: 'Pretendard, sans-serif' }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff', borderBottom: '1px solid #EEE5D8' }}>
                {persona.imageUrl && <img src={persona.imageUrl} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#2D2438' }}>{persona.name}</div>
                    <div style={{ fontSize: 11, color: '#8A7F96', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{persona.jobTitle || 'AI 페르소나'}</div>
                </div>
                {remaining != null && !isMember && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#8E6FB7', background: '#F5E6F7', padding: '3px 8px', borderRadius: 999 }}>무료 {remaining}회 남음</span>
                )}
                <a href={mainUrl} target="_blank" rel="noreferrer"
                   style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'linear-gradient(90deg,#8E6FB7,#C77DBE)', padding: '6px 10px', borderRadius: 999, textDecoration: 'none' }}>
                    전체 기능 ↗
                </a>
            </div>

            {/* 기능 바 (유나=타로 인워젯, 그 외 기능은 본 사이트로) */}
            {isYuna && (
                <div style={{ display: 'flex', gap: 6, padding: '8px 12px', background: '#fff', borderBottom: '1px solid #F0E9DE' }}>
                    <button onClick={() => (isMember ? setShowTarot(true) : setLimitHit(true))}
                        style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 999, border: '1px solid #C4B5FD', background: '#F3E8FF', color: '#7C3AED', cursor: 'pointer' }}>
                        🪄 타로점 보기{!isMember && ' (가입 후)'}
                    </button>
                </div>
            )}

            {/* 메시지 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
                {msgs.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                        <div style={{
                            maxWidth: '82%', padding: '9px 13px', borderRadius: 16, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                            background: m.role === 'user' ? 'linear-gradient(90deg,#8E6FB7,#A78BC9)' : '#fff',
                            color: m.role === 'user' ? '#fff' : '#2D2438',
                            border: m.role === 'user' ? 'none' : '1px solid #EEE5D8',
                        }}>{m.text}</div>
                    </div>
                ))}
                {busy && <div style={{ fontSize: 12, color: '#8A7F96' }}>{persona.name}가 생각 중… ✨</div>}
                <div ref={endRef} />
            </div>

            {/* 한도 도달 CTA */}
            {limitHit && (
                <div style={{ padding: '14px 16px', background: 'linear-gradient(120deg,#F1ECFA,#FBF2F8)', borderTop: '1px solid #E4D3EC', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#2D2438', marginBottom: 6 }}>
                        {isMember ? '이 기능은 본 사이트에서 이용할 수 있어요' : `${persona.name}와 더 깊은 대화를 나눠보세요`}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#5C5468', marginBottom: 10 }}>가입하면 보너스 포인트 + 타로점 등 전체 기능 이용 가능</div>
                    <a href={mainUrl} target="_blank" rel="noreferrer"
                       style={{ display: 'inline-block', fontSize: 13, fontWeight: 800, color: '#fff', background: 'linear-gradient(90deg,#8E6FB7,#C77DBE)', padding: '10px 22px', borderRadius: 999, textDecoration: 'none' }}>
                        ✨ 무료로 시작하기
                    </a>
                </div>
            )}

            {/* 입력 */}
            <div style={{ display: 'flex', gap: 8, padding: 10, background: '#fff', borderTop: '1px solid #EEE5D8' }}>
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(input); }}
                    placeholder={limitHit && !isMember ? '무료 체험이 끝났어요 — 위 버튼으로 계속!' : `${persona.name}에게 메시지…`}
                    disabled={busy || (limitHit && !isMember)}
                    style={{ flex: 1, border: '1px solid #E4D3EC', borderRadius: 12, padding: '10px 12px', fontSize: 13.5, outline: 'none', color: '#2D2438', background: '#fff' }}
                />
                <button onClick={() => send(input)} disabled={busy || !input.trim() || (limitHit && !isMember)}
                    style={{ border: 'none', borderRadius: 12, padding: '0 16px', fontWeight: 800, fontSize: 13, color: '#fff', background: '#8E6FB7', cursor: 'pointer', opacity: busy || !input.trim() ? 0.5 : 1 }}>
                    전송
                </button>
            </div>

            {/* 유나 타로(회원 전용 — 게스트는 CTA로 유도) */}
            {showTarot && (
                <TarotCardModal
                    isTyping={busy}
                    onSend={msg => { setShowTarot(false); send(msg); }}
                    onClose={() => setShowTarot(false)}
                />
            )}
        </div>
    );
};
