import React, { useRef, useState } from 'react';
import { lookalikeApi, LookalikeResult } from '../services/apiService';
import { usePoints } from '../contexts/PointsContext';

interface LookalikeModalProps {
    personaId: string;
    onResult: (result: LookalikeResult) => void;
    onPointsUpdated?: (paidPoints: number, bonusPoints: number) => void;
    onClose: () => void;
}

// 내 사진 → 닮은 연예인 찾기(윤채린). 텍스트 분석만(초상권 안전).
export const LookalikeModal: React.FC<LookalikeModalProps> = ({ personaId, onResult, onPointsUpdated, onClose }) => {
    const { priceOf, requirePoints } = usePoints();
    const cost = priceOf('lookalike');
    const [preview, setPreview] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState<string>('image/jpeg');
    const [base64, setBase64] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const galleryRef = useRef<HTMLInputElement>(null);
    const cameraRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드할 수 있습니다.'); return; }
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
        if (!requirePoints('lookalike')) return;
        setAnalyzing(true);
        setError(null);
        try {
            const r = await lookalikeApi.analyze(base64, mimeType, personaId);
            if (!r.ok) { setError(r.message); setAnalyzing(false); return; }  // 422: 무과금 안내
            setPreview(null);
            setBase64(null);
            if (r.paidBalance != null && r.bonusBalance != null) onPointsUpdated?.(r.paidBalance, r.bonusBalance);
            onResult(r.analysis);
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
                background: 'linear-gradient(160deg, rgba(28,18,34,0.98) 0%, rgba(38,24,46,0.98) 100%)',
                border: '1px solid rgba(196,169,224,0.3)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.8), 0 0 40px rgba(142,111,183,0.12)',
            }}>
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-purple-900/30">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">✨</span>
                        <h2 className="font-bold text-base" style={{ color: '#D4B8E8' }}>닮은 연예인 찾기</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none">×</button>
                </div>

                <div className="p-5 space-y-4">
                    {/* 안내 문구 */}
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(196,169,224,0.08)', border: '1px solid rgba(196,169,224,0.18)' }}>
                        <span className="text-sm mt-0.5" style={{ color: '#C4A9E0' }}>🔒</span>
                        <p className="text-xs leading-relaxed" style={{ color: 'rgba(212,184,232,0.75)' }}>
                            정면이 또렷한 사진일수록 정확해요. 업로드된 사진은 <strong style={{ color: '#D4B8E8' }}>분석에만 사용</strong>되며 서버에 저장되지 않습니다.
                        </p>
                    </div>

                    {/* 이미지 미리보기 */}
                    {preview ? (
                        <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid rgba(196,169,224,0.35)' }}>
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
                                style={{ background: 'rgba(196,169,224,0.12)', border: '1px solid rgba(196,169,224,0.28)', color: '#E0CDF0' }}
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
                            <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                        </div>
                    )}

                    {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                    {/* 분석 버튼 */}
                    {preview && (
                        <button
                            onClick={handleAnalyze}
                            disabled={analyzing}
                            className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60"
                            style={{
                                background: analyzing ? 'rgba(142,111,183,0.4)' : 'linear-gradient(135deg, rgba(168,134,210,0.95), rgba(142,111,183,0.95))',
                                color: '#fff',
                            }}
                        >
                            {analyzing ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    분석 중…
                                </span>
                            ) : (
                                <>✨ 닮은 연예인 찾기{cost ? ` · ${cost}pt` : ''}</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
