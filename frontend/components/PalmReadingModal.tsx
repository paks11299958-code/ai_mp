import React, { useRef, useState } from 'react';
import { palmReadingApi, PalmReadingResult } from '../services/apiService';

interface PalmReadingModalProps {
    personaId: string;
    onResult: (result: PalmReadingResult) => void;
    onPointsUpdated?: (paidPoints: number, bonusPoints: number) => void;
    onClose: () => void;
}

export const PalmReadingModal: React.FC<PalmReadingModalProps> = ({ personaId, onResult, onPointsUpdated, onClose }) => {
    const [hand, setHand] = useState<'left' | 'right'>('right');
    const [preview, setPreview] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState<string>('image/jpeg');
    const [base64, setBase64] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const galleryRef = useRef<HTMLInputElement>(null);
    const cameraRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            setError('이미지 파일만 업로드할 수 있습니다.');
            return;
        }
        setError(null);
        setMimeType(file.type);
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            setPreview(result);
            setBase64(result.split(',')[1]);
        };
        reader.readAsDataURL(file);
    };

    const handleAnalyze = async () => {
        if (!base64) return;
        setAnalyzing(true);
        setError(null);
        try {
            const res = await palmReadingApi.analyze(base64, mimeType, personaId, hand);
            if (!res.ok) {
                // 사진 불명확 → 저장 안 함, 포인트 환불됨. 다시 촬영 안내(모달 유지).
                if (res.paidBalance !== undefined && res.bonusBalance !== undefined) {
                    onPointsUpdated?.(res.paidBalance, res.bonusBalance);
                }
                setPreview(null);
                setBase64(null);
                setError(res.message);
                return;
            }
            setPreview(null);
            setBase64(null);
            onPointsUpdated?.(res.paidBalance, res.bonusBalance);
            onResult(res.analysis);
            onClose();
        } catch (e: any) {
            setError(e.message || '분석에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{
                background: 'linear-gradient(160deg, rgba(20,14,6,0.98) 0%, rgba(30,18,8,0.98) 100%)',
                border: '1px solid rgba(251,191,36,0.25)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.8), 0 0 40px rgba(251,191,36,0.08)',
            }}>
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-yellow-900/30">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🖐</span>
                        <h2 className="text-yellow-300 font-bold text-base">손금 분석</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none">×</button>
                </div>

                <div className="p-5 space-y-4">
                    {/* 손 선택 */}
                    <div>
                        <p className="text-yellow-200/80 text-xs mb-2">분석할 손을 선택하세요</p>
                        <div className="flex gap-2">
                            {([['left', '왼손'], ['right', '오른손']] as const).map(([val, ko]) => (
                                <button
                                    key={val}
                                    onClick={() => setHand(val)}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                                    style={hand === val
                                        ? { background: 'linear-gradient(135deg, rgba(251,191,36,0.9), rgba(245,158,11,0.9))', color: '#1a0f00', border: '1px solid transparent' }
                                        : { background: 'rgba(255,255,255,0.04)', color: '#d1d5db', border: '1px solid rgba(255,255,255,0.1)' }}
                                >{ko}</button>
                            ))}
                        </div>
                        {/* 손에 따른 속설 한 줄 (선천운/후천운) */}
                        <p className="text-yellow-200/55 text-[11px] mt-2 leading-relaxed">
                            {hand === 'left'
                                ? '🖐 왼손은 타고난 기질과 잠재된 운명(선천운)을 봅니다.'
                                : '🖐 오른손은 살아오며 만들어가는 현재와 미래의 운(후천운)을 봅니다.'}
                        </p>
                    </div>

                    {/* 안내 문구 */}
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)' }}>
                        <span className="text-yellow-500 text-sm mt-0.5">💡</span>
                        <p className="text-yellow-200/70 text-xs leading-relaxed">
                            손바닥을 활짝 펴고 <strong className="text-yellow-300">손금선이 또렷하게</strong> 보이도록
                            밝은 곳에서 촬영해 주세요. 사진이 흐리면 분석할 수 없어요.
                        </p>
                    </div>

                    {/* 이미지 미리보기 */}
                    {preview ? (
                        <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid rgba(251,191,36,0.3)' }}>
                            <img src={preview} alt="미리보기" className="w-full max-h-64 object-contain bg-black" />
                            <button
                                onClick={() => { setPreview(null); setBase64(null); }}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-gray-300 hover:text-white flex items-center justify-center text-sm transition-colors"
                            >×</button>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            <button
                                onClick={() => galleryRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors"
                                style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fde68a' }}
                            >
                                <span>🖼️</span> 사진 선택 (갤러리)
                            </button>
                            <button
                                onClick={() => cameraRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}
                            >
                                <span>📷</span> 카메라로 바로 찍기
                            </button>
                            <input ref={galleryRef} type="file" accept="image/*" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                        </div>
                    )}

                    {error && (
                        <p className="text-red-400 text-xs text-center leading-relaxed">{error}</p>
                    )}

                    {/* 분석 버튼 */}
                    {preview && (
                        <button
                            onClick={handleAnalyze}
                            disabled={analyzing}
                            className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60"
                            style={{
                                background: analyzing ? 'rgba(251,191,36,0.3)' : 'linear-gradient(135deg, rgba(251,191,36,0.9), rgba(245,158,11,0.9))',
                                color: '#1a0f00',
                            }}
                        >
                            {analyzing ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                    </svg>
                                    손금을 읽는 중...
                                </span>
                            ) : '🖐 손금 분석 시작'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
