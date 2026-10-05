import React, { useRef, useState } from 'react';
import { X, Upload, Activity } from 'lucide-react';

interface SwingInputModalProps {
    onClose: () => void;
    onSubmit: (data: { title: string | null; gender: string; skillLevel: string; file: File }) => void;
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
        const finalTitle = title.trim() || null;
        onSubmit({ title: finalTitle, gender, skillLevel, file });
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(2,11,18,0.87)' }}>
            <div className="seola-input relative w-full max-w-md rounded-2xl overflow-y-auto max-h-[90dvh] shadow-2xl" style={{ background: '#071821', border: '1px solid #28404a' }}>

                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #28404a' }}>
                    <div className="flex items-center gap-2">
                        <Activity size={18} style={{ color: '#d8ba81' }} />
                        <span className="font-semibold text-sm" style={{ color: '#f2eee5' }}>내 스윙을 보여주세요</span>
                    </div>
                    <button aria-label="스윙 입력 닫기" onClick={onClose} className="rounded-full p-1 hover:bg-black/5 transition-colors">
                        <X size={18} style={{ color: '#aab9bd' }} />
                    </button>
                </div>

                <div className="px-6 py-5 flex flex-col gap-5">

                    {/* 파일 업로드 */}
                    <div>
                        <label className="block text-xs font-medium mb-2" style={{ color: '#c4d0d2' }}>스윙 영상·사진 업로드</label>
                        <div
                            role="button" tabIndex={0} aria-label="스윙 영상·사진 선택"
                            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
                            className="rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all"
                            style={{
                                border: `2px dashed ${dragOver ? '#d8ba81' : file ? '#9EC4A0' : '#28404a'}`,
                                background: dragOver ? 'rgba(142,111,183,0.06)' : file ? 'rgba(158,196,160,0.08)' : '#102630',
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
                                    <span className="text-sm font-medium" style={{ color: '#d8ba81' }}>{file.name}</span>
                                    <span className="text-xs" style={{ color: '#aab9bd' }}>
                                        {(file.size / (1024 * 1024)).toFixed(1)} MB — 클릭하여 변경
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <Upload size={28} style={{ color: '#d8ba81' }} />
                                    <span className="text-sm font-medium" style={{ color: '#c4d0d2' }}>
                                        드래그하거나 클릭하여 업로드
                                    </span>
                                    <span className="text-xs" style={{ color: '#aab9bd' }}>
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

                    {/* 점검 이름 */}
                    <div>
                        <label htmlFor="seola-swing-title" className="block text-xs font-medium mb-1.5" style={{ color: '#c4d0d2' }}>
                            점검 이름 <span style={{ color: '#aab9bd' }}>(선택)</span>
                        </label>
                        <input
                            id="seola-swing-title"
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="비워두면 설아가 지어줘요"
                            maxLength={50}
                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                            style={{ background: '#102630', border: '1px solid #28404a', color: '#f2eee5' }}
                            onFocus={e => e.currentTarget.style.borderColor = '#d8ba81'}
                            onBlur={e => e.currentTarget.style.borderColor = '#28404a'}
                        />
                    </div>

                    <p className="text-xs" style={{color: "#aab9bd", marginTop: -12}}>비워두면 설아가 지어줘요</p>

                    {/* 골퍼 정보 */}
                    <div>
                        <label className="block text-xs font-medium mb-2" style={{ color: '#c4d0d2' }}>골퍼 정보</label>
                        <div className="flex flex-wrap gap-3">
                            {/* 성별 */}
                            <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #28404a' }}>
                                {(['남성', '여성'] as const).map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setGender(g)}
                                        className="px-4 py-3 text-sm font-medium transition-all"
                                        style={{
                                            background: gender === g ? '#d8ba81' : '#102630',
                                            color: gender === g ? '#102630' : '#c4d0d2',
                                        }}
                                    >
                                        {g === '남성' ? '♂ 남성' : '♀ 여성'}
                                    </button>
                                ))}
                            </div>

                            {/* 실력 레벨 */}
                            <div className="flex rounded-xl overflow-hidden w-full" style={{ border: '1px solid #28404a' }}>
                                {SKILL_LEVELS.map(lv => (
                                    <button
                                        key={lv}
                                        onClick={() => setSkillLevel(lv)}
                                        className="flex-1 py-3 text-xs font-medium transition-all"
                                        style={{
                                            background: skillLevel === lv ? '#d8ba81' : '#102630',
                                            color: skillLevel === lv ? '#102630' : '#c4d0d2',
                                        }}
                                    >
                                        {lv}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 제출 버튼 */}
                    <button
                        onClick={handleSubmit}
                        disabled={!file || isUploading}
                        className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
                        style={{
                            background: !file || isUploading ? '#28404a' : 'linear-gradient(135deg, #d8ba81, #d8ba81)',
                            color: '#102630',
                            cursor: !file || isUploading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isUploading ? '분석 중...' : '내 스윙 보여주기'}
                    </button>
                </div>
            </div>
        </div>
    );
};
