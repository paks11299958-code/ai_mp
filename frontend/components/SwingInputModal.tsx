import React, { useRef, useState } from 'react';
import { X, Upload, Activity } from 'lucide-react';

interface SwingInputModalProps {
    onClose: () => void;
    onSubmit: (data: { title: string; gender: string; skillLevel: string; file: File }) => void;
    isUploading?: boolean;
}

const SKILL_LEVELS = ['초급', '중급', '고급', '프로'];

export const SwingInputModal: React.FC<SwingInputModalProps> = ({ onClose, onSubmit, isUploading }) => {
    const [title, setTitle] = useState('');
    const [gender, setGender] = useState<'남성' | '여성'>('남성');
    const [skillLevel, setSkillLevel] = useState('중급');
    const [file, setFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFile = (f: File) => {
        const allowed = ['video/mp4', 'video/quicktime', 'video/mov', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowed.includes(f.type)) {
            alert('MP4, MOV, JPG, PNG, GIF, WEBP 파일만 업로드 가능합니다.');
            return;
        }
        setFile(f);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
    };

    const handleSubmit = () => {
        if (!file) { alert('영상 또는 사진을 업로드해주세요.'); return; }
        const finalTitle = title.trim() || `스윙 분석 ${new Date().toLocaleDateString('ko-KR')}`;
        onSubmit({ title: finalTitle, gender, skillLevel, file });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
            <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#FBF8F3', border: '1px solid #EAE2D3' }}>

                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #EAE2D3' }}>
                    <div className="flex items-center gap-2">
                        <Activity size={18} style={{ color: '#8E6FB7' }} />
                        <span className="font-semibold text-sm" style={{ color: '#2D2438' }}>AI 스윙 분석</span>
                    </div>
                    <button onClick={onClose} className="rounded-full p-1 hover:bg-black/5 transition-colors">
                        <X size={18} style={{ color: '#9089A1' }} />
                    </button>
                </div>

                <div className="px-6 py-5 flex flex-col gap-5">

                    {/* 분석 제목 */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: '#5A5060' }}>
                            분석 제목 <span style={{ color: '#9089A1' }}>(선택)</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="예: 드라이버 스윙 분석"
                            maxLength={50}
                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                            style={{ background: '#fff', border: '1px solid #EAE2D3', color: '#2D2438' }}
                            onFocus={e => e.currentTarget.style.borderColor = '#8E6FB7'}
                            onBlur={e => e.currentTarget.style.borderColor = '#EAE2D3'}
                        />
                    </div>

                    {/* 골퍼 정보 */}
                    <div>
                        <label className="block text-xs font-medium mb-2" style={{ color: '#5A5060' }}>골퍼 정보</label>
                        <div className="flex gap-3">
                            {/* 성별 */}
                            <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #EAE2D3' }}>
                                {(['남성', '여성'] as const).map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setGender(g)}
                                        className="px-4 py-2 text-sm font-medium transition-all"
                                        style={{
                                            background: gender === g ? '#8E6FB7' : '#fff',
                                            color: gender === g ? '#fff' : '#5A5060',
                                        }}
                                    >
                                        {g === '남성' ? '♂ 남성' : '♀ 여성'}
                                    </button>
                                ))}
                            </div>

                            {/* 실력 레벨 */}
                            <div className="flex rounded-xl overflow-hidden flex-1" style={{ border: '1px solid #EAE2D3' }}>
                                {SKILL_LEVELS.map(lv => (
                                    <button
                                        key={lv}
                                        onClick={() => setSkillLevel(lv)}
                                        className="flex-1 py-2 text-xs font-medium transition-all"
                                        style={{
                                            background: skillLevel === lv ? '#8E6FB7' : '#fff',
                                            color: skillLevel === lv ? '#fff' : '#5A5060',
                                        }}
                                    >
                                        {lv}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 파일 업로드 */}
                    <div>
                        <label className="block text-xs font-medium mb-2" style={{ color: '#5A5060' }}>스윙 영상·사진 업로드</label>
                        <div
                            className="rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all"
                            style={{
                                border: `2px dashed ${dragOver ? '#8E6FB7' : file ? '#9EC4A0' : '#D4C9E0'}`,
                                background: dragOver ? 'rgba(142,111,183,0.06)' : file ? 'rgba(158,196,160,0.08)' : '#fff',
                                minHeight: '120px',
                                padding: '20px',
                            }}
                            onClick={() => fileRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                        >
                            {file ? (
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-2xl">{file.type.startsWith('video/') ? '🎬' : '🖼️'}</span>
                                    <span className="text-sm font-medium" style={{ color: '#2E6B32' }}>{file.name}</span>
                                    <span className="text-xs" style={{ color: '#9089A1' }}>
                                        {(file.size / (1024 * 1024)).toFixed(1)} MB — 클릭하여 변경
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <Upload size={28} style={{ color: '#B49AC9' }} />
                                    <span className="text-sm font-medium" style={{ color: '#5A5060' }}>
                                        드래그하거나 클릭하여 업로드
                                    </span>
                                    <span className="text-xs" style={{ color: '#9089A1' }}>
                                        MP4 · MOV · JPG · PNG · GIF · WEBP 파일 가능
                                    </span>
                                </div>
                            )}
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="video/mp4,video/quicktime,.mov,image/jpeg,image/png,image/gif,image/webp"
                            className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                        />
                    </div>

                    {/* 제출 버튼 */}
                    <button
                        onClick={handleSubmit}
                        disabled={!file || isUploading}
                        className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
                        style={{
                            background: !file || isUploading ? '#D4C9E0' : 'linear-gradient(135deg, #8E6FB7, #B49AC9)',
                            color: '#fff',
                            cursor: !file || isUploading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isUploading ? '분석 중...' : '🏌️ Vertex AI 스윙 분석 시작'}
                    </button>
                </div>
            </div>
        </div>
    );
};
