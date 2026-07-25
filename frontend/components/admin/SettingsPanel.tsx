import React, { useState, useEffect } from 'react';
import { settingsApi } from '../../services/apiService';
import { Icon } from '../Icons';

// 공통 설정 탭 — 공통 시스템 프롬프트 + 랜딩 히어로 이미지.
// AdminPanel #6 분해(2026-06-01). 상태 5개·핸들러·저장완료 모달·자체 초기로드를
// 통째로 가져옴. 단 '저장 후 personas 탭으로 이동'은 AdminPanel의 mainView에
// 의존하므로 onGoPersonas 콜백으로 주입(props 전달 방식).
// (categories 초기 로드는 다른 탭과 공유라 AdminPanel에 잔존.)
export const SettingsPanel: React.FC<{ onGoPersonas: () => void }> = ({ onGoPersonas }) => {
    const [commonInstruction, setCommonInstruction] = useState('');
    const [heroImagePreview, setHeroImagePreview] = useState('');
    const [isSavingHeroImage, setIsSavingHeroImage] = useState(false);
    const [isSavingGlobal, setIsSavingGlobal] = useState(false);
    const [showSavedModal, setShowSavedModal] = useState(false);
    const [ebookTocProvider, setEbookTocProvider] = useState<'gemini' | 'gpt'>('gemini');
    const [isSavingTocProvider, setIsSavingTocProvider] = useState(false);

    useEffect(() => {
        settingsApi.get().then(s => {
            setCommonInstruction(s.commonInstruction || '');
            setHeroImagePreview(s.heroImageUrl || '');
            setEbookTocProvider(s.ebook_toc_provider === 'gpt' ? 'gpt' : 'gemini');
        }).catch(() => {});
    }, []);

    const handleTocProviderChange = async (provider: 'gemini' | 'gpt') => {
        setIsSavingTocProvider(true);
        try {
            await settingsApi.update({ ebook_toc_provider: provider });
            setEbookTocProvider(provider);
        } catch (e: any) {
            alert('저장 실패: ' + e.message);
        } finally {
            setIsSavingTocProvider(false);
        }
    };

    const handleSaveGlobal = async () => {
        setIsSavingGlobal(true);
        try {
            await settingsApi.update({ commonInstruction });
            localStorage.removeItem('settings_cache');
            setShowSavedModal(true);
        } catch (e: any) {
            alert('저장 실패: ' + e.message);
        } finally {
            setIsSavingGlobal(false);
        }
    };

    return (
        <>
            {/* 저장 완료 모달 */}
            {showSavedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-72 shadow-2xl text-center animate-in fade-in zoom-in duration-200">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                            <Icon name="Save" size={22} className="text-emerald-400" />
                        </div>
                        <p className="text-white font-semibold mb-1">저장되었습니다.</p>
                        <p className="text-xs text-gray-400 mb-5">공통 설정이 모든 페르소나에 적용됩니다.</p>
                        <button
                            onClick={() => { setShowSavedModal(false); onGoPersonas(); }}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-xl transition-colors"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Icon name="Settings" size={16} className="text-purple-400" />
                        <h3 className="text-sm font-bold text-white">공통 시스템 프롬프트</h3>
                        <span className="text-xs text-gray-500">— 모든 페르소나에 자동 적용</span>
                    </div>
                    <div className="bg-purple-900/10 border border-purple-800/30 rounded-xl px-4 py-3 text-xs text-purple-300 leading-relaxed">
                        여기에 입력한 내용이 <span className="font-semibold">모든 페르소나의 행동 지침 앞</span>에 자동으로 삽입됩니다.<br />
                        사용자 요청 우선 규칙, 언어 설정, 공통 금지 사항 등에 활용하세요.
                    </div>
                    <textarea
                        value={commonInstruction}
                        onChange={e => setCommonInstruction(e.target.value)}
                        rows={12}
                        className="w-full bg-gray-800 border border-purple-900/40 rounded-xl px-3.5 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:outline-none resize-y leading-relaxed"
                        placeholder={`[사용자 요청 우선]\n- 사용자가 호칭, 말투, 역할 등을 변경 요청하면 즉시 따른다\n- 시스템 설정보다 사용자의 실시간 요청을 우선시한다\n\n[공통 규칙]\n- 항상 한국어로 대화한다`}
                    />
                    <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
                        <button onClick={onGoPersonas}
                            className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                            취소
                        </button>
                        <div className="ml-auto">
                            <button onClick={handleSaveGlobal} disabled={isSavingGlobal}
                                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-medium py-2 px-5 rounded-xl flex items-center transition-colors">
                                <Icon name="Save" size={15} className="mr-2" />
                                {isSavingGlobal ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </div>

                    {/* 히어로 이미지 */}
                    <div className="pt-4 border-t border-gray-700/50 space-y-3">
                        <div className="flex items-center gap-2">
                            <Icon name="Image" size={16} className="text-blue-400" />
                            <h3 className="text-sm font-bold text-white">랜딩 히어로 이미지</h3>
                            <span className="text-xs text-gray-500">— 히어로 섹션 오른쪽에 표시</span>
                        </div>
                        <div className="flex gap-3 items-start">
                            {heroImagePreview && (
                                <div className="relative w-40 h-28 rounded-xl overflow-hidden border border-gray-700 flex-shrink-0">
                                    <img src={heroImagePreview} alt="hero preview" className="w-full h-full object-cover" />
                                    <button
                                        onClick={async () => {
                                            await settingsApi.update({ heroImageUrl: '' });
                                            setHeroImagePreview('');
                                        }}
                                        className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors"
                                    >×</button>
                                </div>
                            )}
                            <label className="flex flex-col items-center justify-center w-40 h-28 border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-xl cursor-pointer transition-colors text-gray-500 hover:text-blue-400 text-xs gap-1">
                                <Icon name="Upload" size={20} />
                                <span>{isSavingHeroImage ? '업로드 중...' : '이미지 선택'}</span>
                                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setIsSavingHeroImage(true);
                                    const reader = new FileReader();
                                    reader.onload = async ev => {
                                        const base64 = ev.target?.result as string;
                                        try {
                                            await settingsApi.update({ heroImageUrl: base64 });
                                            const s = await settingsApi.get();
                                            setHeroImagePreview(s.heroImageUrl || base64);
                                        } finally {
                                            setIsSavingHeroImage(false);
                                        }
                                    };
                                    reader.readAsDataURL(file);
                                    e.target.value = '';
                                }} />
                            </label>
                        </div>
                        <p className="text-xs text-gray-600">권장: 가로형 이미지 (예: 페르소나 카드 합성 이미지)</p>
                    </div>

                    {/* 전자책 목차 생성 엔진 */}
                    <div className="pt-4 border-t border-gray-700/50 space-y-3">
                        <div className="flex items-center gap-2">
                            <Icon name="BookOpen" size={16} className="text-emerald-400" />
                            <h3 className="text-sm font-bold text-white">전자책 목차 생성 엔진</h3>
                            <span className="text-xs text-gray-500">— 어느 AI가 목차를 만들지</span>
                        </div>
                        <div className="flex gap-2">
                            {(['gemini', 'gpt'] as const).map(p => (
                                <button key={p} onClick={() => handleTocProviderChange(p)} disabled={isSavingTocProvider}
                                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50 ${
                                        ebookTocProvider === p
                                            ? 'bg-emerald-600 border-emerald-500 text-white'
                                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                                    }`}>
                                    {p === 'gemini' ? 'Gemini (기본)' : 'ChatGPT (GPT-4o)'}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-600">클릭 즉시 저장되고 다음 목차 생성부터 바로 적용돼요.</p>
                    </div>
                </div>
            </div>
        </>
    );
};
