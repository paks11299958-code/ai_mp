import React, { useEffect, useRef, useState } from 'react';
import { hairApi, HairStyle, HairMatchResult } from '../services/apiService';

// 윤채린 헤어스타일 진단: 내 사진 업로드 → 성별 → 헤어 갤러리 선택 → 어울림 분석(텍스트).
// (실제 합성 이미지는 향후 2단계)
interface Props { personaId?: string; onClose: () => void }

const T = {
    bg: '#FBF8F3', card: '#FFFFFF', line: '#F0E9DE', ink: '#2D2438',
    inkSoft: '#5B5168', inkMute: '#9089A1', accent: '#8E6FB7', accent2: '#A98AD0',
};

export const HairStyleBoard: React.FC<Props> = ({ personaId, onClose }) => {
    const [gender, setGender] = useState<'female' | 'male'>('female');
    const [styles, setStyles] = useState<HairStyle[] | null>(null);
    const [selected, setSelected] = useState<HairStyle | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [base64, setBase64] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState('image/jpeg');
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<HairMatchResult | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

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
        setAnalyzing(true); setError(null);
        try {
            const { analysis, resultImageUrl } = await hairApi.analyze(base64, mimeType, selected.id, personaId);
            setResult(analysis);
            setResultImage(resultImageUrl);
        } catch (e: any) {
            setError(e.message || '분석에 실패했어요. 다시 시도해 주세요.');
        } finally { setAnalyzing(false); }
    };

    return (
        <div className="fixed inset-0 z-[70] overflow-y-auto" style={{ background: T.bg }}>
            <div className="max-w-md mx-auto px-4 py-5">
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 style={{ fontFamily: 'Noto Serif KR, serif', fontSize: 20, fontWeight: 700, color: T.ink }}>💇 헤어스타일 진단</h2>
                        <p style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>윤채린이 어울리는 헤어를 찾아드려요</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: T.inkMute, cursor: 'pointer' }}>✕</button>
                </div>

                {result ? (
                    /* ── 결과 화면 ── */
                    <div>
                        {/* 합성 결과: 내 얼굴에 헤어 입힌 이미지 (Before/After) */}
                        {resultImage && (
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: T.accent, marginBottom: 8, textAlign: 'center' }}>✨ 이 헤어로 바꾼 내 모습</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {preview && (
                                        <div style={{ flex: 1, textAlign: 'center' }}>
                                            <img src={preview} alt="원본" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 14, border: `1px solid ${T.line}` }} />
                                            <div style={{ fontSize: 11, color: T.inkMute, marginTop: 4 }}>Before</div>
                                        </div>
                                    )}
                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                        <img src={resultImage} alt="합성 결과" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 14, border: `2px solid ${T.accent}` }} />
                                        <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, marginTop: 4 }}>After · {selected?.name}</div>
                                    </div>
                                </div>
                                <a href={resultImage} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', fontSize: 12, color: T.accent, marginTop: 8, textDecoration: 'underline' }}>크게 보기 / 저장</a>
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
                                        <img src={s.imageUrl} alt={s.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                                        <div style={{ fontSize: 11, fontWeight: 600, color: selected?.id === s.id ? T.accent : T.inkSoft, padding: '5px 2px' }}>{s.name}</div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {error && <div style={{ fontSize: 13, color: '#D9534F', marginBottom: 10, textAlign: 'center' }}>{error}</div>}

                        <button onClick={handleAnalyze} disabled={analyzing} style={{
                            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                            background: analyzing ? T.inkMute : `linear-gradient(135deg, ${T.accent}, ${T.accent2})`,
                            color: '#fff', fontWeight: 700, fontSize: 15, cursor: analyzing ? 'default' : 'pointer',
                        }}>
                            {analyzing ? '합성 + 진단 중… (10초쯤) 💭' : '✨ 합성하고 진단받기'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
