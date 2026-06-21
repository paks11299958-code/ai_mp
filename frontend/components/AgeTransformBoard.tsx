import React, { useRef, useState } from 'react';
import { ageTransformApi } from '../services/apiService';

// 윤채린 "미래의 나": 내 사진+현재 나이 → 10·20·30·40년 후 모습 생성 → 슬라이더로 전환/Before·After 비교 → 저장/취소.
// 과거(회춘)는 안 함(품질·수요). 헤어 합성 패턴 재활용(EXIF·단계로딩). 저장 눌러야 DB 확정.

interface Props {
    personaId?: string;
    onClose: () => void;
}

// 적응형: 서버가 현재 나이 맞춰 목표나이 3개(ages)를 줌. 키=목표나이 문자열. 라벨="N년 후".
const yearsLabel = (targetAge: number, age: number) => `${targetAge - age}년 후`;

export const AgeTransformBoard: React.FC<Props> = ({ onClose }) => {
    const [preview, setPreview] = useState<string | null>(null);
    const [base64, setBase64] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState('image/jpeg');
    const [currentAge, setCurrentAge] = useState('');
    const [usedAge, setUsedAge] = useState(0);  // 생성에 쓴 현재 나이(결과 라벨 계산용)
    const [ages, setAges] = useState<number[]>([]);  // 서버가 준 목표 나이들(오름차순)

    const [generating, setGenerating] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);
    const [images, setImages] = useState<Record<string, string> | null>(null);  // 생성 결과(미저장)
    const [selected, setSelected] = useState<string>('');  // 선택된 목표나이 키
    const [compare, setCompare] = useState(50);  // Before/After 슬라이더 위치(%)
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileRef = useRef<HTMLInputElement>(null);
    const LOADING_MSGS = ['가까운 미래를 그리는 중이에요', '중년의 모습을 그리는 중이에요', '노년의 모습을 그리는 중이에요'];

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
        const ageNum = Number(currentAge);
        if (!currentAge || !Number.isFinite(ageNum) || ageNum <= 0 || ageNum >= 120) {
            setError('현재 나이를 입력해 주세요.'); return;
        }
        setGenerating(true); setError(null); setLoadingStep(0);
        // 3장 순차 생성 체감용 단계 표시(장당 ~9초)
        const timers = [1, 2].map((i) => setTimeout(() => setLoadingStep(i), i * 9000));
        try {
            const { images: imgs, ages: targetAges, succeeded } = await ageTransformApi.generate(base64, mimeType, ageNum);
            timers.forEach(clearTimeout);
            if (!succeeded) { setError('이미지 생성에 실패했어요. 다시 시도해 주세요.'); return; }
            setUsedAge(ageNum);
            setAges(targetAges || []);
            setImages(imgs);
            setCompare(50);
            // 생성된 것 중 첫 구간 선택
            const first = (targetAges || []).map(String).find(k => imgs[k]) ?? Object.keys(imgs)[0];
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
                                style={{ width: `${Math.round(((loadingStep + 1) / 3) * 100)}%` }} />
                        </div>

                        {/* 3단계 체크리스트 */}
                        <div className="flex gap-2">
                            {['가까운 미래', '중년', '노년'].map((lbl, i) => (
                                <div key={lbl} className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                                    i < loadingStep ? 'text-[#9B5FA8]' : i === loadingStep ? 'text-[#9B5FA8] bg-[#F3E9F4]' : 'text-[#C9BEDB]'
                                }`}>
                                    <span className="text-base leading-none">{i < loadingStep ? '✓' : i === loadingStep ? '⏳' : '○'}</span>
                                    {lbl}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0E9DE]">
                    <h3 className="text-base font-bold text-[#2D2438]">🕰️ 미래의 나 <span className="text-xs text-[#9089A1] ml-1">FUTURE ME</span></h3>
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
                                <p className="text-[11px] text-[#9089A1] -mt-2 px-1">나이를 기준으로 10·20·30·40년 후 모습을 만들어요</p>
                            )}

                            <button
                                onClick={handleGenerate}
                                disabled={!base64 || !currentAge || generating}
                                className="w-full py-3 rounded-xl bg-[#9B5FA8] hover:bg-[#8a5296] text-white text-sm font-semibold disabled:opacity-40 transition-colors"
                            >
                                {generating ? '변환 중…' : '🕰️ 미래의 나 보기 · 400pt'}
                            </button>
                        </>
                    )}

                    {/* 2단계: 결과 — 미래 구간 탭 + Before/After 슬라이더 비교 */}
                    {images && (
                        <>
                            <div className="flex gap-1.5 text-center mb-1">
                                {ages.map(a => {
                                    const key = String(a);
                                    return (
                                        <button
                                            key={key}
                                            disabled={!images[key]}
                                            onClick={() => { setSelected(key); setCompare(50); }}
                                            className={`flex-1 py-2 rounded-lg text-[11px] font-bold leading-tight transition-colors disabled:opacity-30 ${
                                                selected === key ? 'bg-[#9B5FA8] text-white' : 'bg-[#F3E9F4] text-[#8a5296]'
                                            }`}
                                        >
                                            {yearsLabel(a, usedAge)}<br />
                                            <span className="text-[10px] font-medium opacity-80">{a}세</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Before(원본) → After(미래) 드래그 비교 */}
                            {images[selected] ? (
                                <>
                                    <div className="relative rounded-xl overflow-hidden bg-[#F8F4FB] border border-[#EADBF5] select-none">
                                        {/* After (전체) */}
                                        <img src={images[selected]} alt="미래" className="w-full object-contain max-h-[50vh] block" draggable={false} />
                                        {/* Before (원본)을 위에 덮고 compare%만큼 보여줌 */}
                                        {preview && (
                                            <div className="absolute inset-0 overflow-hidden" style={{ width: `${compare}%` }}>
                                                <img src={preview} alt="현재" className="h-full w-auto max-w-none object-cover" draggable={false}
                                                    style={{ width: `${100 / (compare / 100)}%`, maxWidth: 'none' }} />
                                            </div>
                                        )}
                                        {/* 라벨 */}
                                        <span className="absolute top-2 left-2 text-[10px] font-bold text-white bg-black/40 rounded px-1.5 py-0.5">지금</span>
                                        <span className="absolute top-2 right-2 text-[10px] font-bold text-white bg-[#9B5FA8]/80 rounded px-1.5 py-0.5">{selected}세</span>
                                        {/* 구분선 */}
                                        <div className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none" style={{ left: `${compare}%` }} />
                                    </div>
                                    <input type="range" min={0} max={100} value={compare}
                                        onChange={e => setCompare(Number(e.target.value))}
                                        className="w-full accent-[#9B5FA8]" />
                                    <p className="text-center text-sm font-bold text-[#9B5FA8] -mt-1">
                                        {yearsLabel(Number(selected), usedAge)}, {selected}세의 나 🕰️
                                    </p>
                                    <p className="text-center text-[11px] text-[#9089A1] -mt-2">← 슬라이더를 움직여 지금과 비교해보세요</p>
                                </>
                            ) : (
                                <div className="rounded-xl bg-[#F8F4FB] border border-[#EADBF5] py-16 text-center text-[#9089A1] text-sm">이 구간은 생성하지 못했어요</div>
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
