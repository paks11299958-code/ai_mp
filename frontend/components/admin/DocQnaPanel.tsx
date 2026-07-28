import React, { useEffect, useState, useRef } from 'react';
import { docQnaApi, type DocQnaDocRow, type DocQnaQuestionRow } from '../../services/apiService';

// 🛠️ 문서 QnA — 뼈대(2026-07-24 사장 발안).
// GCP 결제계정의 "Trial credit for GenAI App Builder" 크레딧이 Vertex AI Search and
// Conversation 전용임을 실측 확인 → 이 크레딧이 실제로 소진되는지 검증하는 최소 골격.
// 실제 인제스트/질의(discoveryengine 호출)는 서버2 rag/doc_qna_worker.py를 수동 실행해야
// 진행된다(뼈대 단계 — 크론 자동화 없음). 포인트 과금·기능카드 없음, 어드민 전용.

const STATUS_META: Record<string, { label: string; cls: string }> = {
    pending:   { label: '대기중', cls: 'bg-gray-700 text-gray-300' },
    ingesting: { label: '인제스트중', cls: 'bg-amber-950 text-amber-100' },
    ready:     { label: '준비완료', cls: 'bg-green-950 text-green-100' },
    answered:  { label: '답변완료', cls: 'bg-green-950 text-green-100' },
    failed:    { label: '실패', cls: 'bg-red-950 text-red-100' },
};

function fmtDate(s?: string | null): string {
    if (!s) return '';
    try { return new Date(s).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul',  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return s; }
}

export const DocQnaPanel: React.FC = () => {
    const [docs, setDocs] = useState<DocQnaDocRow[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
    const [questions, setQuestions] = useState<DocQnaQuestionRow[]>([]);
    const [newQuestion, setNewQuestion] = useState('');
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [err, setErr] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const loadDocs = React.useCallback(() => {
        setLoading(true);
        docQnaApi.docs()
            .then(rows => { setDocs(rows); setErr(''); })
            .catch(e => setErr(e?.message || '문서 목록을 불러오지 못했어요.'))
            .finally(() => setLoading(false));
    }, []);
    useEffect(loadDocs, [loadDocs]);

    const loadQuestions = React.useCallback((docId: number) => {
        docQnaApi.questions(docId).then(setQuestions).catch(() => {});
    }, []);
    useEffect(() => {
        if (selectedDocId != null) loadQuestions(selectedDocId);
    }, [selectedDocId, loadQuestions]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) { setErr('파일은 20MB 이내로 올려주세요.'); return; }
        setUploading(true);
        try {
            const b64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            await docQnaApi.upload(file.name, b64);
            loadDocs();
        } catch (e: any) {
            setErr(e?.message || '업로드에 실패했어요.');
        } finally {
            setUploading(false);
        }
    };

    const handleAsk = async () => {
        const q = newQuestion.trim();
        if (!q || selectedDocId == null) return;
        try {
            await docQnaApi.ask(selectedDocId, q);
            setNewQuestion('');
            loadQuestions(selectedDocId);
        } catch (e: any) {
            setErr(e?.message || '질문 등록에 실패했어요.');
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-lg font-bold text-white">📄 문서 QnA(뼈대)</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        문서를 업로드하면 Vertex AI Search로 인제스트 후 질문에 답합니다.
                        인제스트·질의는 서버2에서 수동 실행해야 진행돼요(뼈대 단계 — 자동화 전).
                    </p>
                </div>
                <button onClick={loadDocs} className="text-xs font-bold px-3 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800">🔄 새로고침</button>
            </div>

            <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-100">
                ⚠️ 개인정보가 민감한 자료(주민번호·계좌번호 등)는 피하고, 있다면 먼저 가려서(마스킹) 올려주세요.
            </div>

            {err && (
                <div className="bg-red-950 border border-red-500/40 rounded-xl px-4 py-3 text-sm text-red-100 flex justify-between gap-3">
                    <span>{err}</span>
                    <button onClick={() => setErr('')} className="text-xs font-bold underline flex-shrink-0">닫기</button>
                </div>
            )}

            {/* 문서 업로드 */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-gray-100">문서 업로드(PDF)</h3>
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="text-sm font-bold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
                    {uploading ? '업로드 중...' : '📎 PDF 선택'}
                </button>
                <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
            </div>

            {/* 업로드된 문서 목록 */}
            <div className="space-y-2">
                {docs.map(d => {
                    const meta = STATUS_META[d.status] || { label: d.status, cls: 'bg-gray-800 text-gray-200' };
                    const selected = selectedDocId === d.id;
                    return (
                        <button key={d.id} onClick={() => setSelectedDocId(selected ? null : d.id)}
                            className={`w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-left border ${selected ? 'border-indigo-500 bg-indigo-950/30' : 'border-gray-700 bg-gray-800/60'}`}>
                            <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-md ${meta.cls}`}>{meta.label}</span>
                            <div className="min-w-0 flex-1">
                                <div className="font-bold text-sm truncate text-gray-100">{d.fileName}</div>
                                <div className="text-[11px] text-gray-400">id={d.id} · {fmtDate(d.createdAt)}</div>
                            </div>
                        </button>
                    );
                })}
                {docs.length === 0 && !loading && (
                    <p className="text-sm text-gray-500 py-4 text-center">업로드된 문서가 없어요.</p>
                )}
            </div>

            {/* 선택된 문서의 질문/답변 */}
            {selectedDocId != null && (
                <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-bold text-gray-100">질문하기 (문서 id={selectedDocId})</h3>
                    <p className="text-[11px] text-gray-500">
                        "이 문서는", "이 약관에서" 같은 지시어보다, 문서 속 키워드를 직접 넣은 문장형
                        질문이 답변이 더 잘 나와요. 또한 "면책 조항" 같은 법률 용어만 짧게 묻기보다,
                        "천재지변으로 서비스가 중단되면 회사 책임은?"처럼 구체적 상황을 풀어서
                        물어야 안정적으로 답변돼요(실측 확인, 2026-07-24). 예: "포인트 환불 수수료에
                        대해 알려줘"
                    </p>
                    <div className="flex gap-2">
                        <input value={newQuestion} onChange={e => setNewQuestion(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAsk()}
                            placeholder="예: 포인트 환불 수수료에 대해 알려줘"
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" />
                        <button onClick={handleAsk} className="text-sm font-bold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">질문</button>
                    </div>
                    <div className="space-y-2">
                        {questions.map(q => {
                            const meta = STATUS_META[q.status] || { label: q.status, cls: 'bg-gray-800 text-gray-200' };
                            return (
                                <div key={q.id} className="bg-gray-900/60 border border-gray-700 rounded-lg p-3 text-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${meta.cls}`}>{meta.label}</span>
                                        <span className="text-[11px] text-gray-500">{fmtDate(q.createdAt)}</span>
                                    </div>
                                    <p className="text-gray-100 font-medium">{q.question}</p>
                                    {q.answer && <p className="text-gray-300 mt-1 whitespace-pre-wrap">{q.answer}</p>}
                                    {q.errorMessage && <p className="text-red-300 mt-1 text-xs">❌ {q.errorMessage}</p>}
                                </div>
                            );
                        })}
                        {questions.length === 0 && (
                            <p className="text-xs text-gray-500 py-2 text-center">아직 질문이 없어요.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
