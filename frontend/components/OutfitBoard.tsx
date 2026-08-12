import React, { useEffect, useRef, useState } from 'react';
import { outfitApi, OutfitStyle } from '../services/apiService';
import { usePoints } from '../contexts/PointsContext';
import { shareResultImage } from '../services/referral';

// 윤채린 프로필 사진: 내 얼굴 사진 업로드 → 컨셉(배경형: 실내/야외/판타지, 화풍형: 지브리/픽사/민화 등) 선택 → 상반신 프로필 사진 합성.
// (2026-07-21: 전통의상 체험에서 완전 교체 — 나라별 화보→컨셉별 프로필 사진)
// 얼굴 사진만으로 상반신을 생성(백엔드 스튜디오 프롬프트). 진단 텍스트 없음(합성 결과만).
interface Props { personaId?: string; onClose: () => void }

const T = {
    bg: '#FBF8F3', card: '#FFFFFF', line: '#F0E9DE', ink: '#2D2438',
    inkSoft: '#5B5168', inkMute: '#9089A1', accent: '#8E6FB7', accent2: '#A98AD0',
};

export const OutfitBoard: React.FC<Props> = ({ personaId, onClose }) => {
    const { priceOf, requirePoints } = usePoints();
    const cost = priceOf('outfit');
    const [gender, setGender] = useState<'female' | 'male'>('female'); // 디폴트 여성(여성 사용 비중 높음)
    const [styles, setStyles] = useState<OutfitStyle[] | null>(null);
    const [selected, setSelected] = useState<OutfitStyle | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [base64, setBase64] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState('image/jpeg');
    const [analyzing, setAnalyzing] = useState(false);
    // 경과 초(2026-08-12): 종전엔 "보통 10초쯤"이라고만 적어놓고 실측은 12~109초였다.
    // 안내보다 오래 걸리면 회원은 '실패했다'고 판단하고 나가버린다(사장 지적).
    // 숫자가 올라가는 것만 보여도 "돌아가고 있다"는 신호가 되므로 경과를 센다.
    const [elapsedSec, setElapsedSec] = useState(0);
    const [loadingStep, setLoadingStep] = useState(0);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [resultName, setResultName] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [busyRetrySec, setBusyRetrySec] = useState(0);
    // 혼잡 모달(2026-08-12): '눌렀는데 혼잡'은 사용자가 행동한 결과라 반드시 모달로 알린다.
    // 종전엔 화면 중간 빨간 글씨라 스크롤 위치에 따라 아예 안 보였고(사장 지적),
    // 정작 제일 중요한 "포인트 차감 없음"이 가장 안 보이는 자리에 있었다.
    // ★화면 진입 시의 혼잡(폴링)은 모달을 띄우지 않는다 — 아직 아무것도 안 눌렀는데
    //   모달이 튀어나오면 사진 고르는 것을 방해한다(그건 버튼 위 배너로 안내).
    const [busyModal, setBusyModal] = useState(false);
    const [modalCountdown, setModalCountdown] = useState(0);
    const [shareToast, setShareToast] = useState('');
    const [viewerOpen, setViewerOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // GCS 직접 fetch는 CORS로 막혀서(버킷 설정 권한 없음) 같은 출처 중계 라우트로 변환
    const proxyImageUrl = (url: string) => {
        const m = url.match(/\/ai-mp-media\/(outfit-tryon\/[^?#]+)/);
        return m ? `/api/outfit/image?path=${encodeURIComponent(m[1])}` : url;
    };

    // 저장: '사진 파일만' 갤러리로 (헤어와 동일 패턴, 링크/캡션 미포함).
    const handleSaveImage = async () => {
        if (!resultImage || saving) return;
        setSaving(true);
        try {
            const res = await fetch(proxyImageUrl(resultImage));
            if (!res.ok) throw new Error('fetch fail');
            const blob = await res.blob();
            const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
            const file = new File([blob], `ai-outfit-${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
            const ua = navigator.userAgent;
            const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
            if (isIOS && navigator.canShare?.({ files: [file] }) && navigator.share) {
                try { await navigator.share({ files: [file] }); } catch { /* 시트 닫음 */ }
            } else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = file.name;
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(a.href), 4000);
                setShareToast('사진을 저장했어요 — 갤러리(다운로드)에서 확인하세요 📥');
                setTimeout(() => setShareToast(''), 3000);
            }
        } catch {
            window.open(resultImage, '_blank', 'noopener');
        } finally {
            setSaving(false);
        }
    };

    const handleShareResult = async () => {
        if (!resultImage) return;
        const caption = `${resultName || '프로필 사진'} 컨셉으로 찍어봤어! AI로 만들었어 📸`;
        const msg = await shareResultImage(proxyImageUrl(resultImage), 'outfit', caption);
        if (msg) { setShareToast(`🔗 ${msg}`); setTimeout(() => setShareToast(''), 2500); }
    };

    const LOADING_STEPS = ['사진을 분석하고 있어요', '배경을 합성하는 중이에요', '프로필 사진을 만들고 있어요'];

    useEffect(() => {
        if (resultImage) return;
        let alive = true;
        const poll = () => outfitApi.status()
            .then(s => { if (alive) { setBusy(s.status === 'busy'); setBusyRetrySec(s.retryAfterSec); } })
            .catch(() => {});
        poll();
        const id = setInterval(poll, 15000);
        return () => { alive = false; clearInterval(id); };
    }, [resultImage]);

    // ★전신 컨셉 판정은 styleKey 로 한다(2026-08-12).
    //   styles API 응답에 framing 필드가 없어서(실측 확인) selected.framing 은 항상 undefined다.
    //   API를 넓히는 대신 이미 내려오는 styleKey 로 판정한다 — 전신은 베이비뿐이다
    //   (치비도 전신이었으나 109초로 너무 느려 2026-08-12 숨김 처리).
    const isFullBodyConcept = !!selected?.styleKey?.startsWith('baby');

    // 생성 중 경과 시간 — 1초씩 올린다(2026-08-12).
    // ★남은 시간을 '역으로 세지' 않는다 — 실제 소요가 12~109초로 편차가 커서
    //   카운트다운을 쓰면 0이 됐는데 안 끝나는 더 나쁜 상황이 된다. 경과만 정직하게 보여준다.
    useEffect(() => {
        if (!analyzing) { setElapsedSec(0); return; }
        const id = setInterval(() => setElapsedSec(s => s + 1), 1000);
        return () => clearInterval(id);
    }, [analyzing]);

    // 혼잡 모달 카운트다운 — 1초씩 줄여 '얼마나 기다리면 되는지'를 눈에 보이게.
    // 0이 되면 모달을 자동으로 닫는다(그 시점엔 폴링이 busy=false 로 바꿔 버튼이 열린다).
    useEffect(() => {
        if (!busyModal || modalCountdown <= 0) return;
        const id = setInterval(() => {
            setModalCountdown(s => {
                if (s <= 1) { setBusyModal(false); return 0; }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [busyModal, modalCountdown]);

    useEffect(() => {
        setStyles(null); setSelected(null);
        outfitApi.styles(gender).then(setStyles).catch(() => setError('컨셉 목록을 불러오지 못했어요.'));
    }, [gender]);

    const handleFile = async (file: File) => {
        if (!file.type.startsWith('image/')) { setError('이미지 파일만 올려주세요.'); return; }
        setError(null);
        try {
            const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
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
            setMimeType(file.type);
            const reader = new FileReader();
            reader.onload = e => { const r = e.target?.result as string; setPreview(r); setBase64(r.split(',')[1]); };
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyze = async () => {
        if (!base64) { setError('먼저 내 사진을 올려주세요.'); return; }
        if (!selected) { setError('컨셉을 선택해 주세요.'); return; }
        if (!requirePoints('outfit')) return;
        setAnalyzing(true); setError(null); setLoadingStep(0);
        // ★단계 전환 시각을 실측에 맞춰 늘렸다(2026-08-12).
        //   종전 2.5초·8초는 "10초쯤"을 전제로 한 값이라, 실제 30~60초 걸릴 때
        //   8초 만에 마지막 단계에 도달해 **남은 시간 내내 화면이 멈춘 것처럼** 보였다.
        //   실측: 민화 12s / 픽사 26s / 베이비(전신) 34s.
        const t1 = setTimeout(() => setLoadingStep(1), 6000);
        const t2 = setTimeout(() => setLoadingStep(2), 18000);
        try {
            const { resultImageUrl, outfitName } = await outfitApi.analyze(base64, mimeType, selected.id);
            setResultImage(resultImageUrl);
            setResultName(outfitName);
        } catch (e: any) {
            const msg = String(e?.message ?? '');
            // ★혼잡(429→503)은 '실패'가 아니라 '잠시 후 됨'이라 에러 줄이 아니라 모달로 알린다.
            //   백엔드가 retryAfterSec 를 함께 주므로(imageGenStatus) 카운트다운에 쓴다.
            const isBusy = e?.status === 503 || /합성 요청이 많|이용자가 많/.test(msg);
            if (isBusy) {
                // ★err.body 가 정본(apiService 가 !res.ok 에서 본문을 body 로 실어 보낸다).
                const sec = Number(e?.body?.retryAfterSec ?? 0) || 60;
                setBusy(true);
                setBusyRetrySec(sec);
                setModalCountdown(sec);
                setBusyModal(true);
                setError(null);   // 배너/모달 중복 표시 방지(사장 지적: 같은 말이 두 번 떴다)
            } else if (e?.code !== 'INSUFFICIENT_POINTS' && msg !== 'INSUFFICIENT_POINTS') {
                setError(msg || '합성에 실패했어요. 다시 시도해 주세요.');
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
                        <div style={{
                            width: 52, height: 52, margin: '0 auto 18px', borderRadius: '50%',
                            border: `4px solid ${T.line}`, borderTopColor: T.accent,
                            animation: 'outfit-spin 0.9s linear infinite',
                        }} />
                        {selected && (
                            <div style={{ fontSize: 13, color: T.accent, fontWeight: 700, marginBottom: 14 }}>
                                {selected.emoji ?? '📸'} {selected.name} 컨셉으로 만드는 중
                            </div>
                        )}
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
                        {/* 실측 기반 안내(2026-08-12) — 민화 12s / 픽사 26s / 베이비(전신) 34s.
                            전신 컨셉은 그릴 게 많아 상반신보다 오래 걸린다.
                            ★경과 초를 같이 보여준다: 멈춘 게 아니라는 신호가 있어야 회원이 기다린다. */}
                        <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: T.accent, fontVariantNumeric: 'tabular-nums' }}>
                                {elapsedSec}초
                            </div>
                            <div style={{ fontSize: 11.5, color: T.inkMute, marginTop: 4, lineHeight: 1.6 }}>
                                {elapsedSec < 40
                                    ? <>보통 {isFullBodyConcept ? '40초쯤' : '30초쯤'} 걸려요 ☕</>
                                    : elapsedSec < 75
                                        ? <>조금 더 걸리고 있어요. 거의 다 됐어요 🙏</>
                                        : <>오래 걸리는 중이에요. 조금만 더 기다려 주세요<br />
                                           <span style={{ color: T.accent, fontWeight: 700 }}>실패한 게 아니니 화면을 닫지 마세요</span></>}
                            </div>
                        </div>
                    </div>
                    <style>{`@keyframes outfit-spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            )}
            {/* 혼잡 모달(2026-08-12) — '만들기'를 눌렀는데 혼잡할 때만. 화면 진입 시 혼잡은
                버튼 위 배너로만 안내한다(사진 고르는 중에 모달이 튀어나오면 방해라서).
                ★제일 중요한 정보는 "포인트 차감 없음" — 종전엔 그게 가장 안 보이는 자리에 있었다. */}
            {busyModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 95,
                    background: 'rgba(45,36,56,0.6)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                }} onClick={() => setBusyModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: T.card, borderRadius: 22, padding: '26px 22px', width: '100%', maxWidth: 340,
                        boxShadow: '0 24px 64px rgba(0,0,0,0.35)', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 8 }}>
                            지금 합성 요청이 많아요
                        </div>
                        <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.6, marginBottom: 16 }}>
                            잠시만 기다렸다가 다시 만들어 주세요.<br />사진과 컨셉은 그대로 남아 있어요.
                        </div>
                        {modalCountdown > 0 && (
                            <div style={{
                                background: 'rgba(230,162,60,0.14)', border: '1px solid rgba(230,162,60,0.4)',
                                borderRadius: 12, padding: '10px 12px', marginBottom: 14,
                            }}>
                                <span style={{ fontSize: 13, color: '#9A6B1F', fontWeight: 600 }}>
                                    약 <b style={{ fontSize: 18 }}>{modalCountdown}</b>초 뒤 자동으로 풀려요
                                </span>
                            </div>
                        )}
                        {/* ★사용자의 첫 걱정은 "돈 나갔나?" — 가장 크고 분명하게 */}
                        <div style={{
                            background: 'rgba(76,175,120,0.12)', border: '1px solid rgba(76,175,120,0.35)',
                            borderRadius: 12, padding: '10px 12px', marginBottom: 18,
                        }}>
                            <span style={{ fontSize: 13.5, color: '#2F7A52', fontWeight: 700 }}>
                                ✅ 포인트는 차감되지 않았어요
                            </span>
                        </div>
                        <button onClick={() => setBusyModal(false)} style={{
                            width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                            background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`,
                            color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                        }}>알겠어요</button>
                    </div>
                </div>
            )}
            <div className="max-w-md mx-auto px-4 py-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 style={{ fontFamily: 'Noto Serif KR, serif', fontSize: 20, fontWeight: 700, color: T.ink }}>📸 프로필 사진</h2>
                        <p style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>내 얼굴로 다양한 컨셉의 프로필 사진을 만들어보세요</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: T.inkMute, cursor: 'pointer' }}>✕</button>
                </div>

                {!resultImage && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14,
                        padding: '8px 12px', borderRadius: 12,
                        background: busy ? 'rgba(217,83,79,0.08)' : 'rgba(76,175,120,0.08)',
                        border: `1px solid ${busy ? 'rgba(217,83,79,0.3)' : 'rgba(76,175,120,0.3)'}`,
                    }}>
                        <span style={{
                            width: 9, height: 9, borderRadius: '50%',
                            background: busy ? '#D9534F' : '#4CAF78',
                            boxShadow: `0 0 6px ${busy ? '#D9534F' : '#4CAF78'}`,
                            animation: busy ? 'outfit-blink 1s ease-in-out infinite' : undefined,
                        }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: busy ? '#B5453F' : '#3C8B5E' }}>
                            {busy
                                ? `지금 합성 요청이 많아요 — 잠시 후 자동으로 확인돼요${busyRetrySec > 0 ? ` (~${busyRetrySec}초)` : ''}`
                                : '지금 원활해요 — 바로 만들 수 있어요'}
                        </span>
                        <style>{`@keyframes outfit-blink { 50% { opacity: 0.3; } }`}</style>
                    </div>
                )}

                {resultImage ? (
                    /* ── 결과 화면 ── */
                    <div>
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: T.accent, marginBottom: 8, textAlign: 'center' }}>✨ {resultName} 컨셉 프로필 사진</div>
                            <div style={{ position: 'relative' }}>
                                <img src={resultImage} alt="합성 결과" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 16, border: `2.5px solid ${T.accent}`, display: 'block' }} />
                                <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(142,111,183,0.92)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>
                                    {selected?.emoji ?? '📸'} {resultName}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                <button onClick={() => setViewerOpen(true)} style={{ flex: 1, padding: '12px', borderRadius: 14, border: `1.5px solid ${T.accent}`, background: T.card, color: T.accent, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                                    🔍 크게 보기
                                </button>
                                <button onClick={handleSaveImage} disabled={saving} style={{ flex: 1, padding: '12px', borderRadius: 14, border: 'none', background: saving ? T.inkMute : `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer' }}>
                                    {saving ? '저장 중…' : '📥 갤러리에 저장'}
                                </button>
                            </div>
                            <button onClick={handleShareResult} style={{ width: '100%', marginTop: 10, padding: '12px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                                📲 친구에게 자랑하기
                            </button>
                        </div>
                        <button onClick={() => { setResultImage(null); setResultName(''); }} style={{ width: '100%', marginTop: 4, padding: '13px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                            다른 컨셉 또 만들어보기
                        </button>
                    </div>
                ) : (
                    /* ── 입력 화면 ── */
                    <div>
                        <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 14, marginBottom: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 4 }}>① 내 얼굴 사진</div>
                            <div style={{ fontSize: 11, color: T.inkMute, marginBottom: 10 }}>정면 셀카면 충분해요 (전신 아니어도 OK)</div>
                            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                            <button onClick={() => fileRef.current?.click()} style={{
                                width: '100%', aspectRatio: preview ? undefined : '16/9', height: preview ? 180 : undefined,
                                borderRadius: 12, border: `1.5px dashed ${T.accent}`, background: preview ? `url(${preview}) center/cover` : 'rgba(142,111,183,0.05)',
                                color: T.accent, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {!preview && '📷 사진 올리기'}
                            </button>
                        </div>

                        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 8 }}>② 성별</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                            {(['female', 'male'] as const).map(g => (
                                <button key={g} onClick={() => setGender(g)} style={{
                                    flex: 1, padding: '11px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                                    background: gender === g ? `linear-gradient(135deg, ${T.accent}, ${T.accent2})` : T.card,
                                    color: gender === g ? '#fff' : T.inkSoft, border: gender === g ? 'none' : `1px solid ${T.line}`,
                                }}>{g === 'female' ? '👸 여성' : '🤴 남성'}</button>
                            ))}
                        </div>

                        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 8 }}>③ 컨셉 선택</div>
                        {styles === null ? (
                            <div style={{ textAlign: 'center', color: T.inkMute, padding: 30, fontSize: 14 }}>불러오는 중…</div>
                        ) : styles.length === 0 ? (
                            <div style={{ textAlign: 'center', color: T.inkMute, padding: 30, fontSize: 14 }}>등록된 컨셉이 없어요.</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                                {styles.map(s => (
                                    <button key={s.id} onClick={() => setSelected(s)} style={{
                                        border: selected?.id === s.id ? `2.5px solid ${T.accent}` : `1px solid ${T.line}`,
                                        borderRadius: 12, overflow: 'hidden', background: T.card, cursor: 'pointer', padding: 0,
                                        boxShadow: selected?.id === s.id ? `0 6px 16px -6px ${T.accent}66` : 'none',
                                    }}>
                                        {s.imageUrl ? (
                                            <img src={s.imageUrl} alt={s.name} loading="lazy" decoding="async"
                                                 style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                                        ) : (
                                            <div style={{ width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ fontSize: 32 }}>{s.emoji ?? '📸'}</span>
                                            </div>
                                        )}
                                        <div style={{ fontSize: 11, fontWeight: 700, color: selected?.id === s.id ? T.accent : T.inkSoft, padding: '5px 2px', textAlign: 'center' }}>{s.name}</div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {error && <div style={{ fontSize: 13, color: '#D9534F', marginBottom: 10, textAlign: 'center' }}>{error}</div>}

                        {/* 혼잡 능동 안내(2026-07-15): 사진까지 올렸는데 혼잡이면 버튼 위에 크게 안내(풀리면 자동 소멸).
                            ★모달이 떠 있는 동안엔 숨긴다(2026-08-12) — 같은 말이 두 번 보이던 것을 정리. */}
                        {preview && busy && !analyzing && !busyModal && (
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

                        <button onClick={handleAnalyze} disabled={analyzing || busy} style={{
                            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                            background: (analyzing || busy) ? T.inkMute : `linear-gradient(135deg, ${T.accent}, ${T.accent2})`,
                            color: '#fff', fontWeight: 700, fontSize: 15, cursor: (analyzing || busy) ? 'default' : 'pointer',
                        }}>
                            {analyzing ? `만드는 중… ${elapsedSec}초 💭` : busy ? '⏳ 합성 대기 중… 잠시만요' : `✨ 프로필 사진 만들기${cost != null ? ` · ${cost.toLocaleString()}pt` : ''}`}
                        </button>
                    </div>
                )}
            </div>
          </div>
          {/* 크게 보기 라이트박스 (헤어와 동일: stopPropagation으로 부모 onClose 차단) */}
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
