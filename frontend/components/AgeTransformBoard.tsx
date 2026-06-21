import React, { useRef, useState } from 'react';
import { ageTransformApi } from '../services/apiService';

// 윤채린 나이 변환: 내 사진 업로드 → 4개 나이대(10·30·50·70) 생성 → 슬라이더로 전환 → 저장/취소.
// 헤어 합성 패턴 재활용(EXIF 보정·단계 로딩). 저장 눌러야 DB 확정, 취소하면 미저장.

interface Props {
    personaId?: string;
    onClose: () => void;
}

const AGE_STEPS = ['10s', '30s', '50s', '70s'] as const;
const AGE_LABEL: Record<string, string> = { '10s': '10대', '30s': '30대', '50s': '50대', '70s': '70대' };
const LOADING_MSGS = ['10대 모습을 그리는 중이에요', '30대 모습을 그리는 중이에요', '50대 모습을 그리는 중이에요', '70대 모습을 그리는 중이에요'];

export const AgeTransformBoard: React.FC<Props> = ({ onClose }) => {
    const [preview, setPreview] = useState<string | null>(null);
    const [base64, setBase64] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState('image/jpeg');
    const [currentAge, setCurrentAge] = useState('');

    const [generating, setGenerating] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);
    const [images, setImages] = useState<Record<string, string> | null>(null);  // 생성 결과(미저장)
    const [selected, setSelected] = useState<string>('30s');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileRef = useRef<HTMLInputElement>(null);

    // 사진 업로드 + EXIF 회전 보정(헤어 패턴)
    const handleFile = async (file: File) => {
        if (!file.type.startsWith('image/')) { setError('이미지 파일만 올려주세요.'); return; }
        setError(null); setImages(null); setSaved(false);
        try {
            const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
            const maxSide = 1280;
            const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
            const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
            setMimeType('image/jpeg'); setPreview(dataUrl); setBase64(dataUrl.split(',')[1]);
        } catch {
            setMimeType(file.type);
            const reader = new FileReader();
            reader.onload = e => { const r = e.target?.result as string; setPreview(r); setBase64(r.split(',')[1]); };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!base64) { setError('먼저 사진을 올려주세요.'); return; }
        setGenerating(true); setError(null); setLoadingStep(0);
        // 4장 순차 생성 체감용 단계 표시(서버가 순차 생성, 장당 ~9초)
        const timers = [1, 2, 3].map((i) => setTimeout(() => setLoadingStep(i), i * 9000));
        try {
            const ageNum = currentAge ? Number(currentAge) : undefined;
            const { images: imgs, succeeded } = await ageTransformApi.generate(base64, mimeType, ageNum);
            timers.forEach(clearTimeout);
            if (!succeeded) { setError('이미지 생성에 실패했어요. 다시 시도해 주세요.'); return; }
            setImages(imgs);
            // 생성된 것 중 첫 구간 선택
            const first = AGE_STEPS.find(s => imgs[s]) ?? Object.keys(imgs)[0];
            setSelected(first);
        } catch (e: any) {
            timers.forEach(clearTimeout);
            if (e?.code !== 'INSUFFICIENT_POINTS' && e?.message !== 'INSUFFICIENT_POINTS') {
                setError(e?.message || '나이 변환 중 오류가 발생했어요.');
            }
        } finally {
            setGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!images) return;
        setSaving(true); setError(null);
        try {
            await ageTransformApi.save(images, preview ?? undefined);
            setSaved(true);
        } catch (e: any) {
            if (e?.code !== 'INSUFFICIENT_POINTS' && e?.message !== 'INSUFFICIENT_POINTS') {
                setError(e?.message || '저장에 실패했어요.');
            }
        } finally {
            setSaving(false);
        }
    };

    // 취소 = 저장 안 하고 닫기(이미 생성된 GCS 이미지는 save 안 했으므로 DB 미기록)
    const handleCancel = () => onClose();

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
            <div className="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}
                style={{ fontFamily: "'Pretendard', sans-serif" }}>
                {/* 생성 진행 오버레이 — 4구간 진행 상태를 시각적으로 */}
                {generating && (
                    <div className="absolute inset-0 z-10 bg-white/95 rounded-2xl flex flex-col items-center justify-center px-6 text-center">
                        {/* 원본 + 회전 링 */}
                        <div className="relative mb-5">
                            {preview && <img src={preview} alt="" className="w-24 h-24 rounded-full object-cover" />}
                            <div className="absolute -inset-1.5 rounded-full border-[3px] border-[#EADBF5] border-t-[#9B5FA8] animate-spin" />
                        </div>
                        <p className="text-sm font-bold text-[#2D2438] mb-1">{LOADING_MSGS[loadingStep]}</p>
                        <p className="text-xs text-[#9089A1] mb-4">윤채린이 시간을 돌리고 있어요… 🕰️</p>

                        {/* 진행바 */}
                        <div className="w-full max-w-[240px] h-2 rounded-full bg-[#F0E9DE] overflow-hidden mb-4">
                            <div className="h-full bg-[#9B5FA8] rounded-full transition-all duration-700"
                                style={{ width: `${Math.round(((loadingStep + 1) / AGE_STEPS.length) * 100)}%` }} />
                        </div>

                        {/* 4구간 체크리스트 */}
                        <div className="flex gap-2">
                            {AGE_STEPS.map((step, i) => (
                                <div key={step} className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                                    i < loadingStep ? 'text-[#9B5FA8]' : i === loadingStep ? 'text-[#9B5FA8] bg-[#F3E9F4]' : 'text-[#C9BEDB]'
                                }`}>
                                    <span className="text-base leading-none">{i < loadingStep ? '✓' : i === loadingStep ? '⏳' : '○'}</span>
                                    {AGE_LABEL[step]}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0E9DE]">
                    <h3 className="text-base font-bold text-[#2D2438]">🕰️ 나이 변환 <span className="text-xs text-[#9089A1] ml-1">AGE MORPH</span></h3>
                    <button onClick={onClose} className="text-[#9089A1] hover:text-[#2D2438] text-xl leading-none">✕</button>
                </div>

                <div className="p-5 space-y-4">
                    {/* 1단계: 사진 업로드 */}
                    {!images && (
                        <>
                            <div
                                onClick={() => !generating && fileRef.current?.click()}
                                className="border-2 border-dashed border-[#D4A8DC] rounded-xl p-6 text-center cursor-pointer hover:bg-[#F3E9F4] transition-colors"
                            >
                                {preview
                                    ? <img src={preview} alt="원본" className="max-h-56 mx-auto rounded-lg object-contain" />
                                    : <div className="text-[#9089A1] text-sm py-8">📷 내 사진을 올려주세요<br /><span className="text-xs">정면 얼굴이 또렷한 사진이 좋아요</span></div>}
                            </div>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden"
                                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

                            {/* 현재 나이 입력 — 변환 기준점(정확도↑). 사진 올린 뒤 노출. */}
                            {preview && (
                                <div className="flex items-center gap-2 bg-[#FAF7FC] border border-[#EADBF5] rounded-xl px-3 py-2.5">
                                    <label className="text-sm text-[#5C5468] font-medium whitespace-nowrap">현재 나이</label>
                                    <input
                                        type="number" inputMode="numeric" min={1} max={119}
                                        value={currentAge}
                                        onChange={e => setCurrentAge(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                                        placeholder="예: 32"
                                        className="flex-1 min-w-0 text-sm bg-white rounded-lg px-3 py-1.5 text-[#2D2438] border border-[#EADBF5] focus:outline-none focus:border-[#9B5FA8]"
                                    />
                                    <span className="text-xs text-[#9089A1] whitespace-nowrap">살</span>
                                </div>
                            )}
                            {preview && (
                                <p className="text-[11px] text-[#9089A1] -mt-2 px-1">나이를 알려주면 더 자연스럽게 변환돼요 (선택)</p>
                            )}

                            <button
                                onClick={handleGenerate}
                                disabled={!base64 || generating}
                                className="w-full py-3 rounded-xl bg-[#9B5FA8] hover:bg-[#8a5296] text-white text-sm font-semibold disabled:opacity-40 transition-colors"
                            >
                                {generating ? '변환 중…' : '✨ 나이 변환하기 · 400pt'}
                            </button>
                        </>
                    )}

                    {/* 2단계: 결과 — 슬라이더로 나이대 전환 */}
                    {images && (
                        <>
                            <div className="flex gap-2 text-center mb-1">
                                {AGE_STEPS.map(step => (
                                    <button
                                        key={step}
                                        disabled={!images[step]}
                                        onClick={() => setSelected(step)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-30 ${
                                            selected === step ? 'bg-[#9B5FA8] text-white' : 'bg-[#F3E9F4] text-[#8a5296]'
                                        }`}
                                    >
                                        {AGE_LABEL[step]}
                                    </button>
                                ))}
                            </div>

                            {/* After (선택 나이대) */}
                            <div className="rounded-xl overflow-hidden bg-[#F8F4FB] border border-[#EADBF5]">
                                {images[selected]
                                    ? <img src={images[selected]} alt={AGE_LABEL[selected]} className="w-full object-contain max-h-[50vh]" />
                                    : <div className="py-16 text-center text-[#9089A1] text-sm">이 나이대는 생성하지 못했어요</div>}
                            </div>
                            <p className="text-center text-sm font-bold text-[#9B5FA8]">{AGE_LABEL[selected]}의 내 모습</p>

                            {/* Before (원본) 작게 */}
                            {preview && (
                                <div className="flex items-center gap-2 justify-center text-xs text-[#9089A1]">
                                    <img src={preview} alt="원본" className="w-12 h-12 rounded-lg object-cover" /> 원본
                                </div>
                            )}

                            {/* 저장 / 취소 */}
                            {saved ? (
                                <div className="text-center text-sm text-green-600 font-semibold py-2">✅ 저장했어요!</div>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={handleCancel} className="flex-1 py-3 rounded-xl bg-[#F0E9DE] text-[#5C5468] text-sm font-semibold hover:bg-[#EAE2D3]">
                                        취소
                                    </button>
                                    <button onClick={handleSave} disabled={saving}
                                        className="flex-1 py-3 rounded-xl bg-[#9B5FA8] text-white text-sm font-semibold hover:bg-[#8a5296] disabled:opacity-40">
                                        {saving ? '저장 중…' : '💾 저장'}
                                    </button>
                                </div>
                            )}
                            {saved && (
                                <button onClick={onClose} className="w-full py-3 rounded-xl bg-[#9B5FA8] text-white text-sm font-semibold">닫기</button>
                            )}
                        </>
                    )}

                    {error && <p className="text-red-500 text-xs text-center">{error}</p>}
                </div>
            </div>
        </div>
    );
};
