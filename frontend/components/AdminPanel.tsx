import React, { useState, useEffect, useRef } from 'react';
import { Persona } from '../types';
import { Icon } from './Icons';

interface AdminPanelProps {
    personas: Persona[];
    onSave: (persona: Persona) => Promise<void>;
    onDelete: (id: string) => void;
    onClose: () => void;
}

const AVAILABLE_ICONS = ['Bot', 'Code2', 'PenTool', 'Languages', 'Send', 'Settings'];
const AVAILABLE_COLORS = [
    { label: '파랑-청록', value: 'from-blue-500 to-cyan-500' },
    { label: '초록-청록', value: 'from-emerald-500 to-teal-500' },
    { label: '보라-분홍', value: 'from-purple-500 to-pink-500' },
    { label: '주황-호박', value: 'from-orange-500 to-amber-500' },
    { label: '빨강-장미', value: 'from-red-500 to-rose-500' },
    { label: '남색-보라', value: 'from-indigo-500 to-violet-500' },
];

// 기본 제공되는 AI는 삭제하지 못하도록 보호
const DEFAULT_IDS = ['general', 'coder', 'writer', 'translator'];

export const AdminPanel: React.FC<AdminPanelProps> = ({ personas, onSave, onDelete, onClose }) => {
    const [selectedId, setSelectedId] = useState<string>(personas[0]?.id || '');
    
    // Form states
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [instruction, setInstruction] = useState('');
    const [iconName, setIconName] = useState('Bot');
    const [colorClass, setColorClass] = useState(AVAILABLE_COLORS[0].value);
    const [imageUrl, setImageUrl] = useState('');
    
    const [isVisible, setIsVisible] = useState(true);
    const [showSuccess, setShowSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (selectedId === 'new') {
            setName('');
            setDescription('');
            setInstruction('');
            setIconName('Bot');
            setColorClass(AVAILABLE_COLORS[0].value);
            setImageUrl('');
            setIsVisible(true);
            setShowSuccess(false);
        } else {
            const p = personas.find(p => p.id === selectedId);
            if (p) {
                setName(p.name);
                setDescription(p.description || '');
                setInstruction(p.systemInstruction);
                setIconName(p.iconName || 'Bot');
                setColorClass(p.colorClass || AVAILABLE_COLORS[0].value);
                setImageUrl(p.imageUrl || '');
                setIsVisible(p.isVisible !== false);
                setShowSuccess(false);
            }
        }
    }, [selectedId, personas]);

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim() || !instruction.trim()) {
            alert('이름과 시스템 프롬프트를 입력해주세요.');
            return;
        }

        const isNew = selectedId === 'new';
        const idToSave = isNew ? `custom-${Date.now()}` : selectedId;

        setIsSaving(true);
        try {
            await onSave({
                id: idToSave,
                name,
                description,
                systemInstruction: instruction,
                iconName,
                colorClass,
                imageUrl,
                isVisible,
            });

            if (isNew) {
                setSelectedId(idToSave);
            }

            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (window.confirm(`'${name}' AI를 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
            onDelete(selectedId);
            setSelectedId(personas[0]?.id || 'new');
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert("이미지 크기는 5MB 이하로 업로드해주세요.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const isDefaultPersona = DEFAULT_IDS.includes(selectedId);

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-900 z-40 relative animate-in fade-in duration-200">
            <header className="h-16 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-6 shrink-0">
                <h2 className="text-xl font-bold text-white flex items-center">
                    <Icon name="Settings" className="mr-3 text-blue-400" /> 
                    관리자 설정 (데이터베이스 연동됨)
                </h2>
                <button 
                    onClick={onClose} 
                    className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition-colors"
                    title="닫기"
                >
                    <Icon name="X" size={20} />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto">
                    
                    {/* AI Selector Tabs */}
                    <div className="mb-8">
                        <label className="block text-sm font-medium text-gray-400 mb-3">편집할 AI 선택 또는 새 AI 추가</label>
                        <div className="flex flex-wrap gap-2">
                            {personas.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedId(p.id)}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center
                                        ${selectedId === p.id 
                                            ? `bg-gradient-to-r ${p.colorClass} text-white shadow-md` 
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700'
                                        }
                                    `}
                                >
                                    <Icon name={p.iconName} size={16} className="mr-2" />
                                    {p.name}
                                </button>
                            ))}
                            <button
                                onClick={() => setSelectedId('new')}
                                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center border border-dashed
                                    ${selectedId === 'new' 
                                        ? 'bg-gray-800 text-white border-blue-500 shadow-md' 
                                        : 'bg-transparent text-gray-400 hover:bg-gray-800 hover:text-gray-200 border-gray-600'
                                    }
                                `}
                            >
                                <Icon name="Plus" size={16} className="mr-2" />
                                새 AI 추가
                            </button>
                        </div>
                    </div>

                    {/* Edit Form */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    페르소나 이름 <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-all"
                                    placeholder="예: 마케팅 전문가"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    짧은 설명
                                </label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-all"
                                    placeholder="예: 마케팅 카피와 전략을 기획합니다."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    아이콘 선택
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_ICONS.map(icon => (
                                        <button
                                            key={icon}
                                            onClick={() => setIconName(icon)}
                                            className={`p-3 rounded-xl border transition-all ${
                                                iconName === icon 
                                                ? 'bg-gray-700 border-blue-500 text-white' 
                                                : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'
                                            }`}
                                        >
                                            <Icon name={icon} size={20} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    테마 색상
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_COLORS.map(color => (
                                        <button
                                            key={color.value}
                                            onClick={() => setColorClass(color.value)}
                                            className={`w-10 h-10 rounded-full border-2 transition-all bg-gradient-to-br ${color.value} ${
                                                colorClass === color.value 
                                                ? 'border-white scale-110 shadow-lg' 
                                                : 'border-transparent hover:scale-105 opacity-70 hover:opacity-100'
                                            }`}
                                            title={color.label}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Image Upload Section */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                AI 프로필 이미지 (선택사항)
                            </label>
                            <div className="flex items-start gap-4">
                                <div 
                                    className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center bg-gray-900 overflow-hidden relative group cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {imageUrl ? (
                                        <>
                                            {/* object-cover 대신 object-contain을 사용하여 이미지가 잘리지 않게 함 */}
                                            <img src={imageUrl} alt="Preview" className="w-full h-full object-contain p-1" />
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Icon name="Upload" size={20} className="text-white" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center text-gray-500">
                                            <Icon name="ImageIcon" size={24} className="mb-1" />
                                            <span className="text-[10px]">업로드</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        ref={fileInputRef}
                                        onChange={handleImageUpload}
                                    />
                                    <p className="text-xs text-gray-500 mb-2">
                                        AI를 대표하는 이미지를 업로드하세요. 이 이미지는 사이드바 하단에 표시됩니다. (권장: 5MB 이하)
                                    </p>
                                    {imageUrl && (
                                        <button 
                                            onClick={() => setImageUrl('')}
                                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            이미지 제거
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                시스템 프롬프트 (페르소나 지시사항) <span className="text-red-400">*</span>
                            </label>
                            <p className="text-xs text-gray-500 mb-3">
                                이 지시사항은 AI가 어떻게 행동하고 답변해야 하는지 결정합니다. 기존 AI 변경 시 대화 기록이 초기화됩니다.
                            </p>
                            <textarea
                                value={instruction}
                                onChange={e => setInstruction(e.target.value)}
                                rows={6}
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none resize-y transition-all leading-relaxed"
                                placeholder="AI에게 부여할 역할과 규칙을 상세히 입력하세요..."
                            />
                        </div>

                        {/* 공개 여부 */}
                        <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-xl border border-gray-700/50">
                            <input
                                type="checkbox"
                                id="isVisible"
                                checked={isVisible}
                                onChange={e => setIsVisible(e.target.checked)}
                                className="w-4 h-4 accent-blue-500 cursor-pointer"
                            />
                            <label htmlFor="isVisible" className="text-sm text-gray-300 cursor-pointer select-none">
                                페르소나 목록에 표시
                            </label>
                            {!isVisible && (
                                <span className="text-xs text-yellow-500 ml-1">숨김 — 대화 데이터는 보존됩니다</span>
                            )}
                        </div>

                        <div className="pt-4 flex items-center justify-between border-t border-gray-700/50">
                            <div className="flex items-center gap-4">
                                {selectedId !== 'new' && !isDefaultPersona && (
                                    <button
                                        onClick={handleDelete}
                                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10 px-4 py-2.5 rounded-xl transition-colors flex items-center text-sm font-medium"
                                    >
                                        <Icon name="Trash2" size={16} className="mr-1.5" />
                                        삭제
                                    </button>
                                )}
                                {showSuccess && (
                                    <span className="text-emerald-400 flex items-center text-sm animate-in fade-in slide-in-from-left-2">
                                        <Icon name="Bot" size={16} className="mr-1.5" />
                                        DB에 저장되었습니다!
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 px-6 rounded-xl flex items-center transition-colors shadow-lg shadow-blue-900/20"
                            >
                                <Icon name="Save" size={18} className="mr-2" />
                                {isSaving ? '저장 중...' : (selectedId === 'new' ? '새 AI 추가하기' : '변경사항 저장')}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
