import React, { useEffect, useRef, useState } from 'react';
import { hairApi, HairStyle, HairMatchResult } from '../services/apiService';
import { usePoints } from '../contexts/PointsContext';
import { shareResultImage } from '../services/referral';

// 윤채린 헤어스타일 진단: 내 사진 업로드 → 성별 → 헤어 갤러리 선택 → 어울림 분석(텍스트).
// (실제 합성 이미지는 향후 2단계)
interface Props { personaId?: string; onClose: () => void }

const T = {
    bg: '#FBF8F3', card: '#FFFFFF', line: '#F0E9DE', ink: '#2D2438',
    inkSoft: '#5B5168', inkMute: '#9089A1', accent: '#8E6FB7', accent2: '#A98AD0',
};

export const HairStyleBoard: React.FC<Props> = ({ personaId, onClose }) => {
    const { priceOf, requirePoints } = usePoints();
    const cost = priceOf('hair');
    const [gender, setGender] = useState<'female' | 'male'>('female');
    const [styles, setStyles] = useState<HairStyle[] | null>(null);
    const [selected, setSelected] = useState<HairStyle | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [base64, setBase64] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState('image/jpeg');
    const [analyzing, setAnalyzing] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);   // 0:사진분석 1:헤어합성 2:윤채린진단
    const [result, setResult] = useState<HairMatchResult | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hairBusy, setHairBusy] = useState(false);          // 합성 혼잡 신호등(🔴)
    const [busyRetrySec, setBusyRetrySec] = useState(0);
    const [shareToast, setShareToast] = useState('');         // 결과 공유·저장 안내
    const [viewerOpen, setViewerOpen] = useState(false);      // 크게 보기(라이트박스)
    const [saving, setSaving] = useState(false);
    const [studioBg, setStudioBg] = useState(false);          // 스튜디오 배경 교체(체크 시)
    const fileRef = useRef<HTMLInputElement>(null);

    // GCS 직접 fetch는 CORS로 막혀서(버킷 설정 권한 없음) 같은 출처 중계 라우트로 변환
    const proxyImageUrl = (url: string) => {
        const m = url.match(/\/ai-mp-media\/(hair-tryon\/[^?#]+)/);
        return m ? `/api/hair/image?path=${encodeURIComponent(m[1])}` : url;
    };

    // 저장: '사진 파일만' 갤러리로. iOS=이미지 파일 하나만 담은 공유시트('이미지 저장'→사진앱), 그 외=다운로드.
    // ★링크/캡션 등 텍스트는 절대 안 넣음(자랑하기와 분리) — files만 전달해 '사진 저장' 전용 시트가 뜨게 함.
    const handleSaveImage = async () => {
        if (!resultImage || saving) return;
        setSaving(true);
        try {
            const res = await fetch(proxyImageUrl(resultImage));
            if (!res.ok) throw new Error('fetch fail');
            const blob = await res.blob();
            const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
            const file = new File([blob], `ai-hairstyle-${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
            // iOS(최신 iPad는 UA가 Mac으로 위장 → 터치+canShare(files)로 보강 판별): <a download>는 '파일'앱행이라 갤러리 저장은 공유시트뿐
            const ua = navigator.userAgent;
            const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
            if (isIOS && navigator.canShare?.({ files: [file] }) && navigator.share) {
                try { await navigator.share({ files: [file] }); } catch { /* 사용자가 시트 닫음 — 폴백 불필요 */ }
            } else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = file.name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(a.href), 4000);
                setShareToast('사진을 저장했어요 — 갤러리(다운로드)에서 확인하세요 📥');
                setTimeout(() => setShareToast(''), 3000);
            }
        } catch {
            // 중계 실패 폴백: 새 탭에서 열어 길게 눌러 저장
            window.open(resultImage, '_blank', 'noopener');
        } finally {
            setSaving(false);
        }
    };

    // 순간 진입점: 합성 결과+딥링크(?f=hair&ref=내코드) 공유. 막 떴을 때 자랑→바이럴.
    const handleShareResult = async () => {
        if (!resultImage) return;
        const caption = `${selected?.name ?? '이 헤어'}로 바꾼 내 모습 어때? AI로 미리 해봤어 ✂️`;
        // GCS 직접 fetch는 CORS로 이미지 첨부가 실패해 링크 공유로 폴백되던 것 → 같은 출처 중계 URL로
        const msg = await shareResultImage(proxyImageUrl(resultImage), 'hair', caption);
        if (msg) { setShareToast(`🔗 ${msg}`); setTimeout(() => setShareToast(''), 2500); }
    };

    const LOADING_STEPS = ['사진을 분석하고 있어요', '헤어스타일을 합성하는 중이에요', '윤채린이 어울림을 진단하고 있어요'];

    // 합성 가능 상태 신호등 — 15초마다 폴링(결과 화면일 땐 멈춤)
    useEffect(() => {
        if (result) return;
        let alive = true;
        const poll = () => hairApi.status()
            .then(s => { if (alive) { setHairBusy(s.status === 'busy'); setBusyRetrySec(s.retryAfterSec); } })
            .catch(() => {});
        poll();
        const id = setInterval(poll, 15000);
        return () => { alive = false; clearInterval(id); };
    }, [result]);

    useEffect(() => {
        setStyles(null); setSelected(null);
        hairApi.styles(gender).then(setStyles).catch(() => setError('헤어스타일을 불러오지 못했어요.'));
    }, [gender]);

    const handleFile = async (file: File) => {
        if (!file.type.startsWith('image/')) { setError('이미지 파일만 올려주세요.'); return; }
        setError(null);
        try {
            // 폰 사진의 EXIF 회전을 픽셀에 직접 적용(똑바로 편 뒤 AI에 넘김).
            // createImageBitmap의 imageOrientation:'from-image'가 EXIF를 자동 보정.
            const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
            // 너무 크면 긴 변 1280으로 축소(전송·생성 속도)
            const maxSide = 1280;
            const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
            const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
            setMimeType('image/jpeg');
            setPreview(dataUrl);
            setBase64(dataUrl.split(',')[1]);
        } catch {
            // createImageBitmap 미지원 환경 폴백: 원본 그대로
            setMimeType(file.type);
            const reader = new FileReader();
            reader.onload = e => { const r = e.target?.result as string; setPreview(r); setBase64(r.split(',')[1]); };
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyze = async () => {
        if (!base64) { setError('먼저 내 사진을 올려주세요.'); return; }
        if (!selected) { setError('헤어스타일을 선택해 주세요.'); return; }
        if (!requirePoints('hair')) return;
        setAnalyzing(true); setError(null); setLoadingStep(0);
        // 실제론 병렬 처리라 단계 완료 시점을 알 수 없어, 체감용으로 단계 메시지를 순차 진행.
        const t1 = setTimeout(() => setLoadingStep(1), 2500);
        const t2 = setTimeout(() => setLoadingStep(2), 8000);
        try {
            const { analysis, resultImageUrl } = await hairApi.analyze(base64, mimeType, selected.id, personaId, studioBg);
            setResult(analysis);
            setResultImage(resultImageUrl);
        } catch (e: any) {
            // 포인트 부족은 전역 충전 모달이 뜨므로 보드 에러문구는 생략
            if (e?.code !== 'INSUFFICIENT_POINTS' && e?.message !== 'INSUFFICIENT_POINTS') {
                setError(e.message || '분석에 실패했어요. 다시 시도해 주세요.');
            }
        } finally {
            clearTimeout(t1); clearTimeout(t2);
            setAnalyzing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-start justify-center pt-[60px] md:pt-[84px] md:px-6 md:pb-6" onClick={onClose}>
          <div className="w-full max-w-md h-[calc(100vh-60px)] md:h-auto md:max-h-[calc(100vh-108px)] overflow-y-auto rounded-t-2xl md:rounded-2xl shadow-2xl"
               style={{ background: T.bg }} onClick={e => e.stopPropagation()}>
            {/* 합성·진단 로딩 오버레이 */}
            {analyzing && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 90,
                    background: 'rgba(45,36,56,0.55)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                }}>
                    <div style={{
                        background: T.card, borderRadius: 22, padding: '28px 24px', width: '100%', maxWidth: 320,
                        boxShadow: '0 24px 64px rgba(0,0,0,0.35)', textAlign: 'center',
                    }}>
                        {/* 스피너 */}
                        <div style={{
                            width: 52, height: 52, margin: '0 auto 18px', borderRadius: '50%',
                            border: `4px solid ${T.line}`, borderTopColor: T.accent,
                            animation: 'hair-spin 0.9s linear infinite',
                        }} />
                        {selected && (
                            <div style={{ fontSize: 13, color: T.accent, fontWeight: 700, marginBottom: 14 }}>
                                💇 {selected.name} 적용 중
                            </div>
                        )}
                        {/* 단계 리스트 */}
                        <div style={{ textAlign: 'left', display: 'inline-block' }}>
                            {LOADING_STEPS.map((label, i) => {
                                const done = i < loadingStep, active = i === loadingStep;
                                return (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
                                        color: done ? T.inkMute : active ? T.ink : T.inkMute,
                                        fontWeight: active ? 700 : 500, fontSize: 14,
                                        opacity: i > loadingStep ? 0.45 : 1,
                                    }}>
                                        <span style={{ fontSize: 15 }}>{done ? '✅' : active ? '⏳' : '·'}</span>
                                        <span>{label}{active ? '…' : ''}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ fontSize: 11.5, color: T.inkMute, marginTop: 16 }}>보통 10초쯤 걸려요 ☕</div>
                    </div>
                    <style>{`@keyframes hair-spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            )}
            <div className="max-w-md mx-auto px-4 py-5">
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 style={{ fontFamily: 'Noto Serif KR, serif', fontSize: 20, fontWeight: 700, color: T.ink }}>💇 헤어스타일 진단</h2>
                        <p style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>윤채린이 어울리는 헤어를 찾아드려요</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: T.inkMute, cursor: 'pointer' }}>✕</button>
                </div>

                {/* 합성 상태 신호등 (입력 화면에서만) */}
                {!result && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14,
                        padding: '8px 12px', borderRadius: 12,
                        background: hairBusy ? 'rgba(217,83,79,0.08)' : 'rgba(76,175,120,0.08)',
                        border: `1px solid ${hairBusy ? 'rgba(217,83,79,0.3)' : 'rgba(76,175,120,0.3)'}`,
                    }}>
                        <span style={{
                            width: 9, height: 9, borderRadius: '50%',
                            background: hairBusy ? '#D9534F' : '#4CAF78',
                            boxShadow: `0 0 6px ${hairBusy ? '#D9534F' : '#4CAF78'}`,
                            animation: hairBusy ? 'hair-blink 1s ease-in-out infinite' : undefined,
                        }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: hairBusy ? '#B5453F' : '#3C8B5E' }}>
                            {hairBusy
                                ? `지금 합성 요청이 많아요 — 잠시 후 자동으로 확인돼요${busyRetrySec > 0 ? ` (~${busyRetrySec}초)` : ''}`
                                : '지금 원활해요 — 바로 합성할 수 있어요'}
                        </span>
                        <style>{`@keyframes hair-blink { 50% { opacity: 0.3; } }`}</style>
                    </div>
                )}

                {result ? (
                    /* ── 결과 화면 ── */
                    <div>
                        {/* 합성 결과: 내 얼굴에 헤어 입힌 이미지 (Before/After) */}
                        {resultImage && (
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: T.accent, marginBottom: 8, textAlign: 'center' }}>✨ 이 헤어로 바꾼 내 모습</div>
                                {/* After를 크게(전체 폭) + Before는 우상단 작은 썸네일로 비교 */}
                                <div style={{ position: 'relative' }}>
                                    <img src={resultImage} alt="합성 결과" style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', borderRadius: 16, border: `2.5px solid ${T.accent}`, display: 'block' }} />
                                    <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(142,111,183,0.92)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>
                                        After · {selected?.name}
                                    </div>
                                    {preview && (
                                        <div style={{ position: 'absolute', top: 10, right: 10, textAlign: 'center' }}>
                                            <img src={preview} alt="원본" style={{ width: 72, height: 90, objectFit: 'cover', borderRadius: 10, border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }} />
                                            <div style={{ fontSize: 10, color: '#fff', fontWeight: 600, marginTop: 2, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>Before</div>
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                    <button onClick={() => setViewerOpen(true)} style={{ flex: 1, padding: '12px', borderRadius: 14, border: `1.5px solid ${T.accent}`, background: T.card, color: T.accent, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                                        🔍 크게 보기
                                    </button>
                                    <button onClick={handleSaveImage} disabled={saving} style={{ flex: 1, padding: '12px', borderRadius: 14, border: 'none', background: saving ? T.inkMute : `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer' }}>
                                        {saving ? '저장 중…' : '📥 갤러리에 저장'}
                                    </button>
                                </div>
                                {/* 순간 진입점: 결과 자랑 공유(이미지+초대링크). 막 떴을 때가 공유 충동 최고조. */}
                                <button onClick={handleShareResult} style={{ width: '100%', marginTop: 10, padding: '12px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                                    📲 친구에게 자랑하기
                                </button>
                            </div>
                        )}
                        <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 18, boxShadow: '0 8px 24px -10px rgba(80,50,110,0.18)' }}>
                            <div className="flex items-center gap-3 mb-3">
                                {selected && <img src={selected.imageUrl} alt={selected.name} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />}
                                <div>
                                    <div style={{ fontSize: 11, color: T.accent, fontWeight: 700 }}>선택한 스타일</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{selected?.name}</div>
                                </div>
                            </div>
                            {result.unclear ? (
                                <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6 }}>사진이 조금 흐려서 정확히 보기 어려워요. 얼굴이 잘 나온 정면 사진으로 다시 시도해 주세요. 🙏</p>
                            ) : (
                                <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.65 }}>
                                    {[
                                        ['얼굴형', result.faceShape], ['어울림', result.match],
                                        ['스타일링 팁', result.tips], ['이런 스타일도', result.alternative],
                                    ].map(([label, val]) => (
                                        <div key={label} style={{ marginBottom: 12 }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: T.accent, marginBottom: 3 }}>{label}</div>
                                            <div>{val}</div>
                                        </div>
                                    ))}
                                    <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(142,111,183,0.08)', borderRadius: 12, fontWeight: 600, color: T.ink }}>
                                        ✨ {result.overall}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={() => { setResult(null); setResultImage(null); }} style={{ width: '100%', marginTop: 14, padding: '13px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                            다른 스타일 또 보기
                        </button>
                    </div>
                ) : (
                    /* ── 입력 화면 ── */
                    <div>
                        {/* 1. 내 사진 */}
                        <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 14, marginBottom: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 10 }}>① 내 사진 (정면)</div>
                            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                            <button onClick={() => fileRef.current?.click()} style={{
                                width: '100%', aspectRatio: preview ? undefined : '16/9', height: preview ? 180 : undefined,
                                borderRadius: 12, border: `1.5px dashed ${T.accent}`, background: preview ? `url(${preview}) center/cover` : 'rgba(142,111,183,0.05)',
                                color: T.accent, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {!preview && '📷 사진 올리기'}
                            </button>
                        </div>

                        {/* 2. 성별 */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                            {(['female', 'male'] as const).map(g => (
                                <button key={g} onClick={() => setGender(g)} style={{
                                    flex: 1, padding: '11px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                                    background: gender === g ? `linear-gradient(135deg, ${T.accent}, ${T.accent2})` : T.card,
                                    color: gender === g ? '#fff' : T.inkSoft, border: gender === g ? 'none' : `1px solid ${T.line}`,
                                }}>{g === 'female' ? '👩 여성' : '👨 남성'}</button>
                            ))}
                        </div>

                        {/* 3. 헤어 갤러리 */}
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 8 }}>② 헤어스타일 선택</div>
                        {styles === null ? (
                            <div style={{ textAlign: 'center', color: T.inkMute, padding: 30, fontSize: 14 }}>불러오는 중…</div>
                        ) : styles.length === 0 ? (
                            <div style={{ textAlign: 'center', color: T.inkMute, padding: 30, fontSize: 14 }}>등록된 헤어스타일이 없어요.</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                                {styles.map(s => (
                                    <button key={s.id} onClick={() => setSelected(s)} style={{
                                        border: selected?.id === s.id ? `2.5px solid ${T.accent}` : `1px solid ${T.line}`,
                                        borderRadius: 12, overflow: 'hidden', background: T.card, cursor: 'pointer', padding: 0,
                                        boxShadow: selected?.id === s.id ? `0 6px 16px -6px ${T.accent}66` : 'none',
                                    }}>
                                        <img src={s.imageUrl} alt={s.name} loading="lazy" decoding="async" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                                        <div style={{ fontSize: 11, fontWeight: 600, color: selected?.id === s.id ? T.accent : T.inkSoft, padding: '5px 2px' }}>{s.name}</div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* 스튜디오 배경 옵션 — 체크 시 배경을 스튜디오로 교체, 미체크 시 원래 배경 유지 */}
                        <button onClick={() => setStudioBg(v => !v)} style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
                            padding: '11px 13px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                            background: studioBg ? 'rgba(142,111,183,0.08)' : T.card,
                            border: `1.5px solid ${studioBg ? T.accent : T.line}`,
                        }}>
                            <span style={{
                                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: studioBg ? T.accent : '#fff', border: `1.5px solid ${studioBg ? T.accent : T.inkMute}`,
                                color: '#fff', fontSize: 14, fontWeight: 800,
                            }}>{studioBg ? '✓' : ''}</span>
                            <span style={{ flex: 1 }}>
                                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: T.ink }}>📸 스튜디오 배경으로</span>
                                <span style={{ display: 'block', fontSize: 11, color: T.inkMute, marginTop: 1 }}>체크하면 깔끔한 스튜디오 배경, 안 하면 원래 배경 그대로</span>
                            </span>
                        </button>

                        {error && <div style={{ fontSize: 13, color: '#D9534F', marginBottom: 10, textAlign: 'center' }}>{error}</div>}

                        {/* 혼잡 능동 안내(2026-07-15): 사진까지 올렸는데 혼잡이면 버튼 위에 크게 안내.
                            선언적 렌더(상태 파생)라 풀리면 자동으로 사라짐 — 신호등(작은 배지)보다 눈에 띄게. */}
                        {preview && hairBusy && !analyzing && (
                            <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10,
                                padding: '10px 12px', borderRadius: 12, background: 'rgba(230,162,60,0.12)',
                                border: '1px solid rgba(230,162,60,0.4)',
                            }}>
                                <span style={{ fontSize: 15 }}>⏳</span>
                                <span style={{ fontSize: 12.5, color: '#9A6B1F', lineHeight: 1.5 }}>
                                    지금 합성 요청이 많아요{busyRetrySec > 0 ? ` — 약 ${busyRetrySec}초 뒤 자동으로 풀려요` : ''}.<br />
                                    사진은 그대로 두시면 돼요. 풀리는 즉시 아래 버튼이 열립니다. (대기 중엔 포인트 차감 없음)
                                </span>
                            </div>
                        )}

                        <button onClick={handleAnalyze} disabled={analyzing || hairBusy} style={{
                            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                            background: (analyzing || hairBusy) ? T.inkMute : `linear-gradient(135deg, ${T.accent}, ${T.accent2})`,
                            color: '#fff', fontWeight: 700, fontSize: 15, cursor: (analyzing || hairBusy) ? 'default' : 'pointer',
                        }}>
                            {analyzing ? '합성 + 진단 중… (10초쯤) 💭' : hairBusy ? '⏳ 합성 대기 중… 잠시만요' : `✨ 합성하고 진단받기${cost != null ? ` · ${cost.toLocaleString()}pt` : ''}`}
                        </button>
                    </div>
                )}
            </div>
          </div>
          {/* 크게 보기 라이트박스: 헤어 창 위에 겹치는 별도 모달.
              ★부모 최상위 div(onClick=onClose=헤어창 닫기)의 자식이라, 라이트박스 클릭이 버블링되면
                헤어 창까지 닫힌다 → 배경/✕/저장 모두 stopPropagation으로 부모 전파 차단(닫기=viewer만). */}
          {viewerOpen && resultImage && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 85, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                   onClick={e => { e.stopPropagation(); setViewerOpen(false); }}>
                  <button onClick={e => { e.stopPropagation(); setViewerOpen(false); }} style={{ position: 'absolute', top: 14, right: 16, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: 20, width: 40, height: 40, borderRadius: '50%', cursor: 'pointer' }}>✕</button>
                  <img src={resultImage} alt="합성 결과 크게 보기" onClick={e => e.stopPropagation()}
                       style={{ maxWidth: '100%', maxHeight: 'calc(100% - 104px)', objectFit: 'contain', borderRadius: 12 }} />
                  <div style={{ display: 'flex', gap: 10, marginTop: 14, width: '100%', maxWidth: 380 }}>
                      <button onClick={e => { e.stopPropagation(); setViewerOpen(false); }}
                              style={{ flex: '0 0 auto', padding: '14px 20px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                          닫기
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleSaveImage(); }} disabled={saving}
                              style={{ flex: 1, padding: '14px', borderRadius: 14, border: 'none', background: saving ? T.inkMute : `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: '#fff', fontWeight: 700, fontSize: 15, cursor: saving ? 'default' : 'pointer' }}>
                          {saving ? '저장 중…' : '📥 갤러리에 저장'}
                      </button>
                  </div>
              </div>
          )}
          {shareToast && (
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-xl text-sm text-white shadow-xl" style={{ background: '#2D2438' }}>
                  {shareToast}
              </div>
          )}
        </div>
    );
};
