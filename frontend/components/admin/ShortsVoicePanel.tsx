import React, { useCallback, useEffect, useRef, useState } from 'react';
import { shortsApi, settingsApi } from '../../services/apiService';

// 쇼츠 내레이션 음성 선택(2026-08-02 사장 지시).
//
// 왜 "들어보고 고르는" 화면인가: 쇼츠 TTS는 언어당 목소리 1개 고정이었고(한국어=Leda),
// 사장이 성별 선택을 원했다. 실측 결과 ko-KR Chirp3-HD에 남성 13·여성 14개가 있는데,
// **Google TTS에는 "나이" 파라미터가 없다** — 목소리마다 인상이 다를 뿐이다. 그래서
// "20대 목소리" 같은 라벨을 개발자가 임의로 붙이면 거짓 표기가 된다. 실제로 들어보고
// 고르는 수밖에 없고, 그 판단은 사람만 할 수 있으므로 이 화면이 필요하다.
//
// 저장은 AppConfig(shorts_voice_{lang}) — 기존 설정 API를 그대로 쓴다(새 테이블 없음).
// 저장된 값은 math-tutor-tts.ts가 읽어 쓰므로, 쇼츠 전 소재(회원용·자동생성)에 함께 적용된다.

const PREVIEW_TEXT = '안녕하세요. 오늘은 아주 특별한 날이죠. 진심을 담아 축하드립니다.';

interface Voice { name: string; gender: 'F' | 'M' }

/** ko-KR-Chirp3-HD-Leda → Leda (화면엔 식별자 꼬리만 보여준다) */
const shortName = (full: string) => full.split('-').pop() || full;

export const ShortsVoicePanel: React.FC = () => {
    const [candidates, setCandidates] = useState<Voice[]>([]);
    const [current, setCurrent] = useState<string | null>(null);   // 저장된 값(서버)
    const [picked, setPicked] = useState<string | null>(null);      // 화면에서 고른 값
    const [playing, setPlaying] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [text, setText] = useState(PREVIEW_TEXT);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    // 만들어 둔 Blob URL — 언마운트 때 정리하지 않으면 메모리에 남는다.
    const urlsRef = useRef<string[]>([]);

    const load = useCallback(() => {
        shortsApi.getVoices('ko')
            .then(d => { setCandidates(d.candidates); setCurrent(d.current); setPicked(d.current); })
            .catch(e => setMsg('목록 조회 실패: ' + e.message));
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => () => {
        audioRef.current?.pause();
        urlsRef.current.forEach(u => URL.revokeObjectURL(u));
    }, []);

    const preview = async (voice: string) => {
        setMsg(''); setPlaying(voice);
        try {
            const url = await shortsApi.previewVoice(voice, text.trim() || undefined);
            urlsRef.current.push(url);
            audioRef.current?.pause();
            const a = new Audio(url);
            audioRef.current = a;
            a.onended = () => setPlaying(null);
            a.onerror = () => { setPlaying(null); setMsg('재생에 실패했어요.'); };
            await a.play();
        } catch (e: any) {
            setPlaying(null);
            setMsg(e.message || '미리듣기 실패');
        }
    };

    const save = async () => {
        if (!picked) return;
        setSaving(true); setMsg('');
        try {
            await settingsApi.update({ shorts_voice_ko: picked });
            setCurrent(picked);
            setMsg('저장했어요 — 다음 쇼츠부터 이 목소리로 만들어집니다.');
        } catch (e: any) {
            setMsg('저장 실패: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const rows = (g: 'F' | 'M') => candidates.filter(v => v.gender === g);

    return (
        <div className="rounded-xl bg-gray-800/40 border border-gray-700 p-3 space-y-3">
            <div>
                <p className="text-xs font-semibold text-gray-300">🎙 내레이션 목소리 (한국어)</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                    들어보고 고른 뒤 저장하세요. 저장하면 <b className="text-gray-400">이후 만드는 모든 쇼츠</b>에 적용됩니다.
                    {/* 나이 라벨을 안 붙인 이유를 화면에도 남긴다 — 나중에 "왜 20대가 없냐"는 질문 방지 */}
                    <br />※ 나이는 지정할 수 없어요(TTS에 해당 기능 없음) — 목소리마다 인상이 다를 뿐이라 직접 들어보고 고르시면 됩니다.
                </p>
            </div>

            <input
                value={text}
                onChange={e => setText(e.target.value)}
                maxLength={200}
                placeholder="미리듣기 문장"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200"
            />

            {(['F', 'M'] as const).map(g => (
                <div key={g}>
                    <p className="text-[11px] font-semibold text-gray-400 mb-1.5">
                        {g === 'F' ? '👩 여성' : '👨 남성'} ({rows(g).length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {rows(g).map(v => {
                            const isPicked = picked === v.name;
                            const isSaved = current === v.name;
                            return (
                                <div key={v.name}
                                     className="flex items-center gap-1 rounded-lg border px-2 py-1.5"
                                     style={isPicked
                                         ? { borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.12)' }
                                         : { borderColor: '#374151' }}>
                                    <button onClick={() => preview(v.name)}
                                            title="들어보기"
                                            className="shrink-0 w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 text-[10px] text-white">
                                        {playing === v.name ? '❚❚' : '▶'}
                                    </button>
                                    <button onClick={() => setPicked(v.name)}
                                            className="flex-1 min-w-0 text-left text-[11px] text-gray-200 truncate">
                                        {shortName(v.name)}
                                        {isSaved && <span className="ml-1 text-[9px] text-green-400">사용중</span>}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            <div className="flex items-center gap-2">
                <button onClick={save}
                        disabled={saving || !picked || picked === current}
                        className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors">
                    {saving ? '저장 중...' : picked === current ? '저장됨' : '이 목소리로 저장'}
                </button>
                {picked && picked !== current && (
                    <span className="text-[11px] text-gray-400">선택: {shortName(picked)}</span>
                )}
            </div>
            {msg && <p className="text-[11px] text-gray-400">{msg}</p>}
        </div>
    );
};
