import React, { useState, useEffect } from 'react';
import { Persona, Category } from '../../types';
import { Icon } from '../Icons';
import { PersonaInfoTab } from '../PersonaInfoTab';
import { PersonaGalleryTab } from '../PersonaGalleryTab';
import { PersonaKnowledgeTab } from '../PersonaKnowledgeTab';
import { PersonaTriggersTab } from '../PersonaTriggersTab';

const DEFAULT_IDS = ['general', 'coder', 'writer', 'translator'];

interface PersonasPanelProps {
    personas: Persona[];
    // categories는 카테고리 탭과 공유되어 AdminPanel 본체가 소유 → 읽기용으로 주입.
    categories: Category[];
    onSave: (persona: Persona) => Promise<void>;
    onDelete: (id: string) => void;
    onImagesChanged?: (personaId: string) => void;
}

export const PersonasPanel: React.FC<PersonasPanelProps> = ({ personas, categories, onSave, onDelete, onImagesChanged }) => {
    const [selectedId, setSelectedId] = useState<string>(personas[0]?.id || '');
    const [activeTab, setActiveTab] = useState<'info' | 'gallery' | 'knowledge' | 'triggers'>('info');

    useEffect(() => {
        setActiveTab('info');
    }, [selectedId]);

    const isDefaultPersona = DEFAULT_IDS.includes(selectedId);

    return (
        <div className="flex-1 flex overflow-hidden">

            {/* 좌측: 페르소나 목록 */}
            <aside className="w-52 shrink-0 border-r border-gray-800 flex flex-col bg-gray-900/60">
                <div className="px-4 py-3 border-b border-gray-800">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">페르소나</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {personas.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setSelectedId(p.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all group
                                ${selectedId === p.id
                                    ? `bg-gradient-to-r ${p.colorClass} text-white shadow-md`
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                }`}
                        >
                            {p.imageUrl ? (
                                <img
                                    src={p.imageUrl}
                                    alt={p.name}
                                    className={`w-8 h-8 rounded-lg object-cover shrink-0 border-2 transition-all ${
                                        selectedId === p.id ? 'border-white/40' : 'border-transparent'
                                    }`}
                                />
                            ) : (
                                <div className={`p-1.5 rounded-lg shrink-0 transition-colors
                                    ${selectedId === p.id ? 'bg-white/20' : 'bg-gray-800 group-hover:bg-gray-700'}`}>
                                    <Icon name={p.iconName} size={15} />
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{p.name}</p>
                                {p.description && (
                                    <p className={`text-[10px] truncate ${selectedId === p.id ? 'text-white/70' : 'text-gray-600'}`}>
                                        {p.description}
                                    </p>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
                <div className="p-2 border-t border-gray-800">
                    <button
                        onClick={() => setSelectedId('new')}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border border-dashed
                            ${selectedId === 'new'
                                ? 'bg-gray-800 text-white border-blue-500'
                                : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300 border-gray-700'
                            }`}
                    >
                        <Icon name="Plus" size={15} />
                        새 AI 추가
                    </button>
                </div>
            </aside>

            {/* 우측: 탭 콘텐츠 */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* 탭 바 */}
                {selectedId !== 'new' && (
                    <div className="border-b border-gray-800 px-6 flex shrink-0">
                        {(['info', 'gallery', 'knowledge', 'triggers'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-all
                                    ${activeTab === tab
                                        ? 'border-blue-500 text-white'
                                        : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
                                    }`}
                            >
                                {tab === 'info' ? '기본 정보' : tab === 'gallery' ? '이미지 / 동영상' : tab === 'knowledge' ? '지식 창고' : '트리거 영상'}
                            </button>
                        ))}
                    </div>
                )}

                {/* 콘텐츠 영역 */}
                <div className="flex-1 overflow-y-auto">

                    {/* ── 기본 정보 탭 ── */}
                    {(activeTab === 'info' || selectedId === 'new') && (
                        <PersonaInfoTab
                            selectedId={selectedId}
                            personas={personas}
                            categories={categories}
                            isDefaultPersona={isDefaultPersona}
                            onSave={onSave}
                            onDelete={(id) => { onDelete(id); setSelectedId(personas[0]?.id || 'new'); }}
                            onSelectId={setSelectedId}
                        />
                    )}

                    {/* ── 이미지 / 동영상 탭 ── */}
                    {activeTab === 'gallery' && selectedId !== 'new' && (
                        <PersonaGalleryTab personaId={selectedId} onImagesChanged={onImagesChanged} />
                    )}

                    {/* ── 지식 창고 탭 ── */}
                    {activeTab === 'knowledge' && selectedId !== 'new' && (
                        <PersonaKnowledgeTab personaId={selectedId} personas={personas} />
                    )}

                    {/* ── 트리거 영상 탭 ── */}
                    {activeTab === 'triggers' && selectedId !== 'new' && (
                        <PersonaTriggersTab personaId={selectedId} />
                    )}

                </div>
            </div>
        </div>
    );
};
