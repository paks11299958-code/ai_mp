import React, { useState, useEffect, useRef } from 'react';
import { Persona, User, PersonaQuotaRequest, PersonaDashboardEntry, PersonaStatus, PersonaImage, PersonaVideo } from '../types';
import { personaApi, quotaRequestApi, personaImageApi, personaVideoApi } from '../services/apiService';
import { generateImageDescription } from '../services/geminiService';
import { STAGES } from '../utils/level';
import { Icon } from './Icons';

interface UserPersonaPanelProps {
    user: User;
    onClose: () => void;
    onSelectPersona?: (personaId: string) => void;
    onPersonaUpdated?: (persona: Persona) => void;
}

const AVAILABLE_COLORS = [
    { label: '파랑-청록', value: 'from-blue-500 to-cyan-500' },
    { label: '초록-청록', value: 'from-emerald-500 to-teal-500' },
    { label: '보라-분홍', value: 'from-purple-500 to-pink-500' },
    { label: '주황-호박', value: 'from-orange-500 to-amber-500' },
    { label: '빨강-장미', value: 'from-red-500 to-rose-500' },
    { label: '남색-보라', value: 'from-indigo-500 to-violet-500' },
];

const AVAILABLE_ICONS = ['Bot', 'Code2', 'PenTool', 'Languages', 'Send', 'Settings'];

const STATUS_LABEL: Record<PersonaStatus, { label: string; color: string }> = {
    pending:  { label: '승인 대기', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
    approved: { label: '공개 중',   color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
    rejected: { label: '거부됨',    color: 'bg-red-500/20 text-red-400 border border-red-500/30' },
    suspended:{ label: '정지됨',    color: 'bg-red-600/20 text-red-400 border border-red-600/30' },
    archived: { label: '아카이브',  color: 'bg-gray-600/40 text-gray-400 border border-gray-600/30' },
};

type TabType = 'list' | 'create' | 'dashboard';

export const UserPersonaPanel: React.FC<UserPersonaPanelProps> = ({ user, onClose, onSelectPersona, onPersonaUpdated }) => {
    const [activeTab, setActiveTab] = useState<TabType>('list');
    const [myPersonas, setMyPersonas] = useState<Persona[]>([]);
    const [loading, setLoading] = useState(true);

    // 대시보드
    const [dashboard, setDashboard] = useState<PersonaDashboardEntry[]>([]);
    const [dashLoading, setDashLoading] = useState(false);

    // 슬롯 요청
    const [quotaRequests, setQuotaRequests] = useState<PersonaQuotaRequest[]>([]);
    const [quotaNote, setQuotaNote] = useState('');
    const [isRequestingQuota, setIsRequestingQuota] = useState(false);

    // 이미지 관리
    const [personaImages, setPersonaImages] = useState<PersonaImage[]>([]);
    const [imagesLoading, setImagesLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 동영상 관리
    const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
    const [videos, setVideos] = useState<PersonaVideo[]>([]);
    const [videoUrl, setVideoUrl] = useState('');
    const [videoTitle, setVideoTitle] = useState('');
    const [isAddingVideo, setIsAddingVideo] = useState(false);
    const videoFileInputRef = useRef<HTMLInputElement>(null);
    const [playingVideo, setPlayingVideo] = useState<{ url: string; title?: string } | null>(null);
    const [imageDescInput, setImageDescInput] = useState('');
    const [newImageDesc, setNewImageDesc] = useState('');
    const descInputRef = useRef<HTMLInputElement>(null);

    // 생성/수정 폼
    const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
    const [editTab, setEditTab] = useState<'info' | 'images'>('info');
    const [name, setName] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [description, setDescription] = useState('');
    const [instruction, setInstruction] = useState('');
    const [identityPrompt, setIdentityPrompt] = useState('');
    const [iconName, setIconName] = useState('Bot');
    const [colorClass, setColorClass] = useState(AVAILABLE_COLORS[0].value);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            personaApi.getMine(),
            quotaRequestApi.getAll(),
        ]).then(([personas, requests]) => {
            setMyPersonas(personas);
            setQuotaRequests(requests);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (activeTab === 'dashboard' && dashboard.length === 0 && !dashLoading) {
            setDashLoading(true);
            quotaRequestApi.getDashboard()
                .then(setDashboard)
                .catch(() => {})
                .finally(() => setDashLoading(false));
        }
        // 탭을 목록/대시보드로 이동하면 수정 모드 해제
        if (activeTab !== 'create') {
            setEditingPersona(null);
            resetForm();
        }
    }, [activeTab]);

    const resetForm = () => {
        setName(''); setJobTitle(''); setDescription('');
        setInstruction(''); setIdentityPrompt('');
        setIconName('Bot'); setColorClass(AVAILABLE_COLORS[0].value);
    };

    const openEditMode = (p: Persona) => {
        setEditingPersona(p);
        setName(p.name);
        setJobTitle(p.jobTitle || '');
        setDescription(p.description || '');
        setInstruction(p.systemInstruction);
        setIdentityPrompt(p.identityPrompt || '');
        setIconName(p.iconName);
        setColorClass(p.colorClass);
        setPersonaImages([]);
        setSelectedImageId(null);
        setVideos([]);
        setEditTab('info');
        setImagesLoading(true);
        personaImageApi.getAll(p.id)
            .then(setPersonaImages)
            .catch(() => {})
            .finally(() => setImagesLoading(false));
        setActiveTab('create');
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingPersona) return;
        e.target.value = '';
        setIsUploading(true);
        try {
            let desc = newImageDesc.trim();
            if (!desc) {
                const reader = new FileReader();
                const base64 = await new Promise<string>(resolve => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
                setNewImageDesc('설명 생성 중...');
                desc = await generateImageDescription(base64) || '';
                setNewImageDesc(desc);
            }
            const { signedUrl, publicUrl } = await personaImageApi.getSignedUrl(editingPersona.id, file.type, file.name);
            await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
            const isFirst = personaImages.length === 0;
            const saved = await personaImageApi.create(editingPersona.id, publicUrl, desc, isFirst);
            setPersonaImages(prev => [...prev, saved]);
            setNewImageDesc('');
            setSelectedImageId(saved.id);
            setImageDescInput(desc);
            setVideos([]);
        } catch (e: any) {
            alert(e.message || '업로드에 실패했습니다.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSetMain = async (imageId: number) => {
        if (!editingPersona) return;
        try {
            await personaImageApi.setMain(editingPersona.id, imageId);
            setPersonaImages(prev => prev.map(img => ({ ...img, isMain: img.id === imageId })));
        } catch (e: any) { alert(e.message); }
    };

    const handleDeleteImage = async (imageId: number) => {
        if (!editingPersona || !window.confirm('이미지를 삭제하시겠습니까?')) return;
        try {
            await personaImageApi.delete(editingPersona.id, imageId);
            setPersonaImages(prev => {
                const next = prev.filter(img => img.id !== imageId);
                if (next.length > 0 && !next.some(img => img.isMain)) next[0] = { ...next[0], isMain: true };
                return next;
            });
            if (selectedImageId === imageId) { setSelectedImageId(null); setVideos([]); }
        } catch (e: any) { alert(e.message); }
    };

    const handleSelectImage = async (imageId: number) => {
        if (selectedImageId === imageId) { setSelectedImageId(null); setVideos([]); setImageDescInput(''); return; }
        setSelectedImageId(imageId);
        const img = personaImages.find(i => i.id === imageId);
        setImageDescInput(img?.description || '');
        try { setVideos(await personaVideoApi.getAll(imageId)); } catch { setVideos([]); }
    };

    const handleReorderImage = async (imageId: number, direction: 'left' | 'right') => {
        if (!editingPersona) return;
        const idx = personaImages.findIndex(img => img.id === imageId);
        if (direction === 'left' && idx === 0) return;
        if (direction === 'right' && idx === personaImages.length - 1) return;
        const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
        const newImages = [...personaImages];
        [newImages[idx], newImages[swapIdx]] = [newImages[swapIdx], newImages[idx]];
        setPersonaImages(newImages);
        try {
            await Promise.all([
                personaImageApi.updateOrder(editingPersona.id, newImages[idx].id, idx),
                personaImageApi.updateOrder(editingPersona.id, newImages[swapIdx].id, swapIdx),
            ]);
        } catch (e: any) { alert('순서 변경 실패: ' + e.message); }
    };

    const handleSaveImageDescription = async () => {
        if (!editingPersona || !selectedImageId) return;
        try {
            await personaImageApi.updateDescription(editingPersona.id, selectedImageId, imageDescInput);
            setPersonaImages(prev => prev.map(img => img.id === selectedImageId ? { ...img, description: imageDescInput } : img));
        } catch (e: any) { alert(e.message); }
    };

    const handleAddVideo = async () => {
        if (!selectedImageId || !videoUrl.trim()) return;
        setIsAddingVideo(true);
        try {
            const video = await personaVideoApi.create(selectedImageId, { videoUrl: videoUrl.trim(), title: videoTitle.trim() || undefined });
            setVideos(prev => [...prev, video]);
            setVideoUrl(''); setVideoTitle('');
        } catch (e: any) { alert(e.message); }
        finally { setIsAddingVideo(false); }
    };

    const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedImageId) return;
        if (file.size > 20 * 1024 * 1024) { alert('20MB 이하 동영상만 업로드 가능합니다.'); return; }
        setIsAddingVideo(true);
        try {
            const { signedUrl, publicUrl } = await personaVideoApi.getSignedUrl(file.type, file.name, selectedImageId);
            await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
            const video = await personaVideoApi.create(selectedImageId, { videoUrl: publicUrl, title: videoTitle.trim() || file.name });
            setVideos(prev => [...prev, video]);
            setVideoTitle('');
            if (videoFileInputRef.current) videoFileInputRef.current.value = '';
        } catch (e: any) { alert(e.message); }
        finally { setIsAddingVideo(false); }
    };

    const handleDeleteVideo = async (videoId: number) => {
        if (!window.confirm('동영상을 삭제하시겠습니까?')) return;
        try {
            await personaVideoApi.delete(videoId);
            setVideos(prev => prev.filter(v => v.id !== videoId));
        } catch (e: any) { alert(e.message); }
    };

    const handleSubmitReview = async () => {
        if (!editingPersona) return;
        const draftCount = personaImages.filter(img => img.status === 'draft').length;
        if (draftCount === 0) { alert('검토 요청할 항목이 없습니다.'); return; }
        if (!window.confirm(`${draftCount}개 이미지(및 연결된 동영상)를 관리자 검토 요청하시겠습니까?`)) return;
        try {
            const result = await personaImageApi.submitReview(editingPersona.id);
            setPersonaImages(prev => prev.map(img => img.status === 'draft' ? { ...img, status: 'pending' } : img));
            setVideos(prev => prev.map(v => v.status === 'draft' ? { ...v, status: 'pending' } : v));
            alert(`검토 요청 완료: 이미지 ${result.imageCount}개, 동영상 ${result.videoCount}개`);
        } catch (e: any) { alert(e.message || '요청에 실패했습니다.'); }
    };

    const pendingRequestExists = quotaRequests.some(r => r.status === 'pending');
    const activePersonaCount = myPersonas.filter(p => p.status !== 'archived').length;
    const canCreate = activePersonaCount < (user.personaQuota ?? 1);

    const handleSave = async () => {
        if (!name.trim() || !instruction.trim()) { alert('이름과 행동 지침을 입력해주세요.'); return; }
        const isEditing = !!editingPersona;
        if (!isEditing && !canCreate) { alert(`슬롯이 부족합니다. (${activePersonaCount}/${user.personaQuota})`); return; }

        setIsSaving(true);
        try {
            const data = {
                name, jobTitle: jobTitle.trim() || undefined,
                description, systemInstruction: instruction,
                identityPrompt: identityPrompt.trim() || undefined,
                iconName, colorClass,
            };

            if (isEditing) {
                const saved = await personaApi.update(editingPersona.id, data);
                setMyPersonas(prev => prev.map(p => p.id === saved.id ? saved : p));
                onPersonaUpdated?.(saved);
                setEditingPersona(null);
                resetForm();
                setActiveTab('list');
                if (saved.status === 'pending' && editingPersona.status === 'approved') {
                    alert('행동 지침이 수정되어 재심사 대기 상태로 변경되었습니다.');
                } else {
                    alert('수정되었습니다.');
                }
            } else {
                const saved = await personaApi.create(data);
                setMyPersonas(prev => [saved, ...prev]);
                resetForm();
                setActiveTab('list');
                alert('페르소나 생성 요청이 완료되었습니다. 관리자 승인 후 공개됩니다.');
            }
        } catch (e: any) {
            alert(e.message || (editingPersona ? '수정에 실패했습니다.' : '생성에 실패했습니다.'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleArchive = async (id: string) => {
        if (!window.confirm('아카이브 처리하시겠습니까? (복원은 관리자에게 문의)')) return;
        try {
            await personaApi.archive(id);
            setMyPersonas(prev => prev.map(p => p.id === id ? { ...p, status: 'archived' } : p));
        } catch (e: any) { alert(e.message); }
    };

    const handleRequestQuota = async () => {
        setIsRequestingQuota(true);
        try {
            const req = await quotaRequestApi.create(quotaNote.trim() || undefined);
            setQuotaRequests(prev => [req, ...prev]);
            setQuotaNote('');
            alert('슬롯 추가 요청이 접수되었습니다. 관리자 승인 후 슬롯이 늘어납니다.');
        } catch (e: any) {
            alert(e.message || '요청에 실패했습니다.');
        } finally {
            setIsRequestingQuota(false);
        }
    };

    const isEditing = !!editingPersona;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">

                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <Icon name="Bot" size={18} className="text-blue-400" />
                        <h2 className="text-base font-bold text-white">내 페르소나</h2>
                        <span className="text-xs text-gray-500">슬롯 {activePersonaCount}/{user.personaQuota ?? 1}</span>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                        <Icon name="X" size={18} />
                    </button>
                </div>

                {/* 탭 바 */}
                <div className="flex border-b border-gray-800 px-5 shrink-0">
                    <button onClick={() => setActiveTab('list')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === 'list' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                        목록 ({myPersonas.length})
                    </button>
                    <button onClick={() => { if (!isEditing) { resetForm(); } setActiveTab('create'); }}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === 'create' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                        {isEditing && activeTab === 'create' ? '✏ 수정하기' : '+ 새로 만들기'}
                    </button>
                    <button onClick={() => setActiveTab('dashboard')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === 'dashboard' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                        대시보드
                    </button>
                </div>

                {/* 콘텐츠 */}
                <div className="flex-1 overflow-y-auto p-5">

                    {/* ── 목록 탭 ── */}
                    {activeTab === 'list' && (
                        <div className="space-y-5">
                            {/* 슬롯 현황 */}
                            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-white">페르소나 슬롯</span>
                                    <span className="text-sm text-gray-400">{activePersonaCount} / {user.personaQuota ?? 1}개 사용 중</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                                    <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (activePersonaCount / (user.personaQuota ?? 1)) * 100)}%` }} />
                                </div>
                                {canCreate ? (
                                    <p className="text-xs text-gray-400">슬롯에 여유가 있습니다. 새 페르소나를 만들어보세요.</p>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-xs text-yellow-400">슬롯이 가득 찼습니다. 슬롯 추가를 요청하세요.</p>
                                        {!pendingRequestExists ? (
                                            <div className="flex gap-2">
                                                <input type="text" value={quotaNote} onChange={e => setQuotaNote(e.target.value)}
                                                    placeholder="요청 사유 (선택)"
                                                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                />
                                                <button onClick={handleRequestQuota} disabled={isRequestingQuota}
                                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors shrink-0">
                                                    {isRequestingQuota ? '요청 중...' : '슬롯 추가 요청'}
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-blue-400">슬롯 추가 요청이 관리자 검토 중입니다.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 페르소나 목록 */}
                            {loading ? (
                                <div className="text-center py-8 text-gray-500 text-sm">로딩 중...</div>
                            ) : myPersonas.length === 0 ? (
                                <div className="text-center py-12">
                                    <Icon name="Bot" size={40} className="mx-auto mb-3 text-gray-700" />
                                    <p className="text-gray-500 text-sm">아직 만든 페르소나가 없습니다.</p>
                                    <button onClick={() => setActiveTab('create')}
                                        className="mt-3 text-blue-400 hover:text-blue-300 text-sm transition-colors">
                                        첫 페르소나 만들기 →
                                    </button>
                                </div>
                            ) : myPersonas.map(p => {
                                const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.pending;
                                return (
                                    <div key={p.id} className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-4 flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.colorClass} text-white flex items-center justify-center shrink-0`}>
                                            <Icon name={p.iconName} size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className="text-sm font-bold text-white truncate">{p.name}</p>
                                                {p.jobTitle && <p className="text-xs text-gray-400 truncate">[{p.jobTitle}]</p>}
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${st.color}`}>{st.label}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 truncate">{p.description || p.systemInstruction.slice(0, 60)}</p>
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                            {p.status === 'approved' && onSelectPersona && (
                                                <button onClick={() => { onSelectPersona(p.id); onClose(); }}
                                                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors">
                                                    대화
                                                </button>
                                            )}
                                            {p.status !== 'archived' && p.status !== 'suspended' && (
                                                <button onClick={() => openEditMode(p)}
                                                    className="text-gray-400 hover:text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700">
                                                    수정
                                                </button>
                                            )}
                                            {p.status !== 'archived' && p.status !== 'suspended' && (
                                                <button onClick={() => handleArchive(p.id)}
                                                    className="text-gray-500 hover:text-red-400 text-xs px-2.5 py-1.5 rounded-lg hover:bg-red-400/10 transition-colors border border-gray-700">
                                                    아카이브
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── 새로 만들기 / 수정하기 탭 ── */}
                    {activeTab === 'create' && (
                        <div className="space-y-4">
                            {/* 슬롯 부족 경고 (생성 모드) */}
                            {!isEditing && !canCreate && (
                                <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl px-4 py-3 text-xs text-yellow-400">
                                    슬롯이 부족합니다. 목록 탭에서 슬롯 추가를 요청하거나 기존 페르소나를 아카이브하세요.
                                </div>
                            )}

                            {/* 수정 모드: 내부 탭 */}
                            {isEditing && (
                                <div className="flex border-b border-gray-700 -mx-5 px-5 gap-1">
                                    <button onClick={() => setEditTab('info')}
                                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${editTab === 'info' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                                        기본 정보
                                    </button>
                                    <button onClick={() => setEditTab('images')}
                                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px flex items-center gap-1.5 ${editTab === 'images' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                                        이미지
                                        {personaImages.length > 0 && (
                                            <span className="text-[10px] bg-gray-600 text-gray-300 rounded-full px-1.5 py-0.5 font-bold">
                                                {personaImages.length}
                                            </span>
                                        )}
                                    </button>
                                    <div className="flex-1" />
                                    <button onClick={() => { setEditingPersona(null); resetForm(); setActiveTab('list'); }}
                                        className="text-xs text-gray-500 hover:text-white pb-2 transition-colors">
                                        취소
                                    </button>
                                </div>
                            )}

                            {/* ── 기본 정보 (생성 모드 전체 / 수정 모드 info 탭) ── */}
                            {(!isEditing || editTab === 'info') && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">이름 <span className="text-red-400">*</span></label>
                                            <input type="text" value={name} onChange={e => setName(e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                placeholder="예: 이서연" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">직업 / 역할</label>
                                            <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                placeholder="예: 골프 코치" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">짧은 설명</label>
                                        <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            placeholder="예: 골프 레슨 및 스윙 교정 전문" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 bg-gray-800/40 border border-gray-700/50 rounded-xl p-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">아이콘</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {AVAILABLE_ICONS.map(icon => (
                                                    <button key={icon} onClick={() => setIconName(icon)}
                                                        className={`p-2 rounded-xl border transition-all ${iconName === icon ? 'bg-gray-700 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
                                                        <Icon name={icon} size={16} />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">테마 색상</label>
                                            <div className="flex flex-wrap gap-2">
                                                {AVAILABLE_COLORS.map(color => (
                                                    <button key={color.value} onClick={() => setColorClass(color.value)} title={color.label}
                                                        className={`w-8 h-8 rounded-full border-2 transition-all bg-gradient-to-br ${color.value} ${colorClass === color.value ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">행동 지침 <span className="text-red-400">*</span></label>
                                        <textarea value={instruction} onChange={e => setInstruction(e.target.value)} rows={6}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y"
                                            placeholder={`[역할]\n- 어떻게 행동할지 설명\n\n[말투]\n- 어떤 말투를 사용할지`}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1.5">정체성 <span className="text-gray-500 font-normal">(선택)</span></label>
                                        <textarea value={identityPrompt} onChange={e => setIdentityPrompt(e.target.value)} rows={3}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:outline-none resize-y"
                                            placeholder="당신은 AI가 아닌 실제 인물입니다..."
                                        />
                                    </div>

                                    {!isEditing && (
                                        <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl px-4 py-3 text-xs text-blue-300">
                                            제출 후 관리자 검토를 거쳐 공개됩니다. 이미지는 승인 후에 추가할 수 있습니다.
                                        </div>
                                    )}

                                    <button onClick={handleSave} disabled={isSaving || (!isEditing && !canCreate)}
                                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition-colors">
                                        {isSaving ? '저장 중...' : isEditing ? '수정 저장' : '페르소나 생성 요청'}
                                    </button>
                                </div>
                            )}

                            {/* ── 이미지 탭 (수정 모드 전용) ── */}
                            {isEditing && editTab === 'images' && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={newImageDesc}
                                            onChange={e => setNewImageDesc(e.target.value)}
                                            placeholder="이미지 설명 (선택)"
                                            className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        />
                                        {personaImages.some(img => img.status === 'draft') && (
                                            <button onClick={handleSubmitReview}
                                                className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0 font-semibold">
                                                <Icon name="Send" size={13} />
                                                검토 요청 ({personaImages.filter(img => img.status === 'draft').length})
                                            </button>
                                        )}
                                        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                                            className="flex items-center gap-1.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0">
                                            <Icon name="Upload" size={13} />
                                            {isUploading ? '업로드 중...' : '이미지 추가'}
                                        </button>
                                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    </div>

                                    <div className="flex gap-3">
                                        {/* 이미지 그리드 */}
                                        <div className="flex-1 min-w-0">
                                            {imagesLoading ? (
                                                <p className="text-xs text-gray-500 text-center py-8">로딩 중...</p>
                                            ) : personaImages.length === 0 ? (
                                                <div className="border-2 border-dashed border-gray-700 rounded-2xl py-10 text-center cursor-pointer hover:border-gray-500 transition-colors"
                                                    onClick={() => fileInputRef.current?.click()}>
                                                    <Icon name="ImageIcon" size={32} className="mx-auto mb-2 text-gray-600" />
                                                    <p className="text-sm text-gray-500">클릭하여 이미지 업로드</p>
                                                    <p className="text-xs text-gray-600 mt-1">JPG, PNG, WEBP 등 지원</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {personaImages.map(img => (
                                                        <div key={img.id}
                                                            onClick={() => handleSelectImage(img.id)}
                                                            className={`group flex flex-col rounded-xl border-2 cursor-pointer transition-all overflow-hidden ${
                                                                selectedImageId === img.id ? 'border-blue-400 ring-2 ring-blue-400/30'
                                                                : img.status === 'draft' ? 'border-gray-600'
                                                                : img.status === 'pending' ? 'border-yellow-500/60'
                                                                : img.isMain ? 'border-yellow-400' : 'border-gray-700 hover:border-gray-500'
                                                            }`}>
                                                            {/* 이미지 영역 */}
                                                            <div className="relative aspect-square">
                                                                <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                                                                <div className={`absolute top-1 left-1 text-[9px] px-1 py-0.5 rounded-full font-bold ${
                                                                    img.status === 'approved' ? 'bg-emerald-500/90 text-white'
                                                                    : img.status === 'pending' ? 'bg-yellow-500/90 text-gray-900'
                                                                    : 'bg-gray-500/90 text-gray-100'
                                                                }`}>
                                                                    {img.status === 'approved' ? '승인됨' : img.status === 'pending' ? '검토 중' : '작성 중'}
                                                                </div>
                                                                {img.isMain && (
                                                                    <div className="absolute top-1 right-1 text-[9px] px-1 py-0.5 rounded-full font-bold bg-yellow-400 text-gray-900">대표</div>
                                                                )}
                                                                {selectedImageId === img.id && (
                                                                    <span className="absolute bottom-1 right-1 bg-blue-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full">선택</span>
                                                                )}
                                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                                                                    {!img.isMain && (
                                                                        <button onClick={e => { e.stopPropagation(); handleSetMain(img.id); }}
                                                                            className="text-[10px] bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold px-2 py-1 rounded-lg transition-colors">
                                                                            대표 설정
                                                                        </button>
                                                                    )}
                                                                    <button onClick={e => { e.stopPropagation(); handleDeleteImage(img.id); }}
                                                                        className="text-[10px] bg-red-600/80 hover:bg-red-500 text-white px-2 py-1 rounded-lg transition-colors">
                                                                        삭제
                                                                    </button>
                                                                    <div className="flex gap-1">
                                                                        <button onClick={e => { e.stopPropagation(); handleReorderImage(img.id, 'left'); }}
                                                                            disabled={personaImages.findIndex(i => i.id === img.id) === 0}
                                                                            className="text-gray-300 hover:text-white disabled:opacity-20 text-[11px] bg-gray-900/80 px-2 py-1 rounded-lg transition-colors">←</button>
                                                                        <button onClick={e => { e.stopPropagation(); handleReorderImage(img.id, 'right'); }}
                                                                            disabled={personaImages.findIndex(i => i.id === img.id) === personaImages.length - 1}
                                                                            className="text-gray-300 hover:text-white disabled:opacity-20 text-[11px] bg-gray-900/80 px-2 py-1 rounded-lg transition-colors">→</button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {/* 설명 영역 — 항상 이미지 아래 표시 */}
                                                            <div className="px-1.5 py-1 bg-gray-900/80 min-h-[22px]">
                                                                <p className="text-[9px] text-gray-300 truncate leading-tight">
                                                                    {img.description || <span className="text-gray-600 italic">설명 없음</span>}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button onClick={() => fileInputRef.current?.click()}
                                                        className="flex flex-col rounded-xl border-2 border-dashed border-gray-700 hover:border-gray-500 overflow-hidden text-gray-600 hover:text-gray-400 transition-colors">
                                                        <div className="flex-1 aspect-square flex flex-col items-center justify-center gap-1">
                                                            <Icon name="Plus" size={20} />
                                                            <span className="text-[10px]">추가</span>
                                                        </div>
                                                        <div className="h-[22px]" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* 이미지 선택 시 오른쪽 설정 패널 */}
                                        {selectedImageId && (
                                            <div className="w-48 shrink-0 bg-gray-800/50 border border-gray-700 rounded-2xl p-3 flex flex-col gap-3">
                                                <p className="text-xs font-semibold text-gray-300">이미지 설정</p>

                                                {/* 이미지 설명 */}
                                                <div>
                                                    <label className="text-[11px] text-gray-500 block mb-1">이미지 설명</label>
                                                    <div className="flex gap-1">
                                                        <input
                                                            ref={descInputRef}
                                                            type="text"
                                                            value={imageDescInput}
                                                            onChange={e => setImageDescInput(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && handleSaveImageDescription()}
                                                            placeholder="설명 입력 후 저장"
                                                            className="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                        />
                                                        <button onClick={handleSaveImageDescription}
                                                            className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1.5 rounded-lg transition-colors shrink-0">
                                                            저장
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* 이미지 해제 단계 */}
                                                <div>
                                                    <label className="text-[11px] text-gray-500 block mb-1">공개 단계</label>
                                                    <select
                                                        value={personaImages.find(i => i.id === selectedImageId)?.requiredLevel ?? 1}
                                                        onChange={async e => {
                                                            const lv = Number(e.target.value);
                                                            if (!editingPersona) return;
                                                            try {
                                                                const updated = await personaImageApi.updateRequiredLevel(editingPersona.id, selectedImageId, lv);
                                                                setPersonaImages(prev => prev.map(img => img.id === selectedImageId ? { ...img, requiredLevel: updated.requiredLevel } : img));
                                                            } catch {}
                                                        }}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                    >
                                                        {STAGES.map(s => <option key={s.stage} value={s.stage}>{s.stage}단계 · {s.name}</option>)}
                                                    </select>
                                                </div>

                                                {/* 동영상 섹션 */}
                                                <div className="border-t border-gray-700 pt-2">
                                                    <p className="text-[11px] font-semibold text-blue-400 mb-2">연결된 동영상</p>
                                                    <div className="space-y-1.5 mb-2">
                                                        <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
                                                            placeholder="동영상 URL (mp4)"
                                                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                                                        <input type="text" value={videoTitle} onChange={e => setVideoTitle(e.target.value)}
                                                            placeholder="제목 (선택)"
                                                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                                                        <div className="flex gap-1">
                                                            <button onClick={handleAddVideo} disabled={isAddingVideo || !videoUrl.trim()}
                                                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors">
                                                                <Icon name="Plus" size={11} />URL
                                                            </button>
                                                            <button onClick={() => videoFileInputRef.current?.click()} disabled={isAddingVideo}
                                                                className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white text-xs py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors">
                                                                <Icon name="Upload" size={11} />파일
                                                            </button>
                                                            <input type="file" accept="video/*" className="hidden" ref={videoFileInputRef} onChange={handleVideoFileUpload} />
                                                        </div>
                                                        {isAddingVideo && <p className="text-[10px] text-blue-400 text-center">업로드 중...</p>}
                                                    </div>

                                                    <div className="flex flex-col gap-1.5 overflow-y-auto max-h-44">
                                                        {videos.length === 0 ? (
                                                            <p className="text-[11px] text-gray-600 text-center py-2">동영상 없음</p>
                                                        ) : videos.map(v => (
                                                            <div key={v.id} className={`flex flex-col rounded-xl px-2 py-1.5 gap-1 group ${
                                                                v.status === 'draft' ? 'bg-gray-700/40 border border-gray-600/60'
                                                                : v.status === 'pending' ? 'bg-yellow-900/20 border border-yellow-600/30'
                                                                : 'bg-gray-700/60'
                                                            }`}>
                                                                <div className="flex items-center gap-1.5">
                                                                    <button onClick={() => setPlayingVideo({ url: v.videoUrl, title: v.title || v.videoUrl.split('/').pop() })}
                                                                        className="flex items-center gap-1 flex-1 min-w-0 hover:text-blue-300 transition-colors text-left">
                                                                        <Icon name="Play" size={10} className={v.status === 'draft' ? 'text-gray-400' : v.status === 'pending' ? 'text-yellow-400' : 'text-blue-400'} />
                                                                        <span className="text-[10px] text-gray-300 truncate">{v.title || v.videoUrl.split('/').pop()}</span>
                                                                        {v.status === 'draft' && <span className="text-[8px] bg-gray-500 text-gray-100 px-1 py-0.5 rounded font-bold shrink-0">작성중</span>}
                                                                        {v.status === 'pending' && <span className="text-[8px] bg-yellow-500 text-gray-900 px-1 py-0.5 rounded font-bold shrink-0">검토중</span>}
                                                                    </button>
                                                                    <button onClick={() => handleDeleteVideo(v.id)}
                                                                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                                                        <Icon name="X" size={10} />
                                                                    </button>
                                                                </div>
                                                                <select value={v.requiredLevel ?? 1}
                                                                    onChange={async e => {
                                                                        const lv = Number(e.target.value);
                                                                        try {
                                                                            const updated = await personaVideoApi.update(v.id, { requiredLevel: lv });
                                                                            setVideos(prev => prev.map(vid => vid.id === v.id ? { ...vid, requiredLevel: updated.requiredLevel } : vid));
                                                                        } catch {}
                                                                    }}
                                                                    className="w-full bg-gray-600 border border-gray-500 rounded-lg px-1.5 py-0.5 text-[10px] text-white focus:ring-1 focus:ring-blue-500 focus:outline-none">
                                                                    {STAGES.map(s => <option key={s.stage} value={s.stage}>{s.stage}단계 · {s.name}</option>)}
                                                                </select>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-600">업로드한 이미지/동영상은 관리자 승인 후 채팅 화면에 공개됩니다.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── 대시보드 탭 ── */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-4">
                            <p className="text-xs text-gray-500">내가 만든 페르소나에 누적된 전체 사용자 XP 현황</p>
                            {dashLoading ? (
                                <div className="text-center py-8 text-gray-500 text-sm">로딩 중...</div>
                            ) : dashboard.length === 0 ? (
                                <div className="text-center py-12 text-gray-600">
                                    <Icon name="Bot" size={36} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">페르소나 데이터가 없습니다.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { label: '총 XP', value: dashboard.reduce((s, d) => s + d.totalXp, 0).toLocaleString() },
                                            { label: '총 사용자', value: dashboard.reduce((s, d) => s + d.totalUsers, 0).toLocaleString() },
                                            { label: '총 세션', value: dashboard.reduce((s, d) => s + d.totalSessions, 0).toLocaleString() },
                                        ].map(card => (
                                            <div key={card.label} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
                                                <p className="text-xl font-bold text-white">{card.value}</p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">{card.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                        {dashboard.map(d => {
                                            const st = STATUS_LABEL[d.status] ?? STATUS_LABEL.pending;
                                            return (
                                                <div key={d.id} className="bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3 flex items-center gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-semibold text-white truncate">{d.name}</p>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${st.color}`}>{st.label}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-5 shrink-0 text-right">
                                                        <div>
                                                            <p className="text-sm font-bold text-blue-400">{d.totalXp.toLocaleString()}</p>
                                                            <p className="text-[10px] text-gray-500">XP</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-white">{d.totalUsers}</p>
                                                            <p className="text-[10px] text-gray-500">사용자</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-white">{d.totalSessions}</p>
                                                            <p className="text-[10px] text-gray-500">세션</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 동영상 재생 모달 */}
            {playingVideo && (
                <div
                    className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setPlayingVideo(null)}
                >
                    <div
                        className="relative w-full max-w-2xl bg-gray-900 rounded-2xl overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                            <span className="text-sm font-medium text-white">{playingVideo.title || '동영상'}</span>
                            <button
                                onClick={() => setPlayingVideo(null)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <Icon name="X" size={20} />
                            </button>
                        </div>
                        <video
                            src={playingVideo.url}
                            controls
                            autoPlay
                            className="w-full max-h-[70vh] bg-black"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
