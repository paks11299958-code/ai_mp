import React, { useState } from 'react';
import { Icon } from '../Icons';
import { ResearchBoard } from '../ResearchBoard';
import { InstagramLikerDialog } from '../InstagramLikerDialog';

// 기능연습(관리자 전용 도구) 탭 — 딥 리서치 + 인스타 자동 좋아요.
// AdminPanel #6 분해(2026-06-01). 다이얼로그 토글 상태가 이 탭에만 갇혀 있어
// 통째 추출. user는 ResearchBoard에 전달(권한/컨텍스트용).
// (※ ProductExtractDialog는 토글 버튼 없는 dead code였어서 분리 시 제거.
//    제품추출 기능은 별도 product-extract 탭(ProductExtractPanel)에 존재.)
export const ToolsPanel: React.FC<{ user?: any }> = ({ user }) => {
    const [showResearch, setShowResearch] = useState(false);
    const [showInstagramLiker, setShowInstagramLiker] = useState(false);

    return (
        <div className="flex-1 overflow-y-auto p-6">
            {showResearch && (
                <ResearchBoard onClose={() => setShowResearch(false)} user={user} />
            )}
            {showInstagramLiker && (
                <InstagramLikerDialog onClose={() => setShowInstagramLiker(false)} />
            )}

            <h3 className="text-sm font-bold text-white mb-1">기능연습</h3>
            <p className="text-gray-500 text-xs mb-6">관리자 전용 기능 테스트 공간입니다.</p>
            <div className="grid grid-cols-1 gap-4 max-w-md">
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <Icon name="BookOpen" size={16} className="text-blue-400" />
                        <span className="text-white font-medium text-sm">딥 리서치</span>
                    </div>
                    <p className="text-gray-500 text-xs mb-2">주제를 입력하면 웹 크롤링 → 원고 작성 → NotebookLM 업로드 → 이메일 발송</p>
                    <div className="bg-red-900/30 border border-red-700/40 rounded-lg px-3 py-2 mb-4">
                        <p className="text-red-300 text-[11px] leading-relaxed">
                            ⚠️ <strong>NotebookLM 업로드 현재 미작동</strong> — 크롤링+원고 작성+이메일까지만 동작<br />
                            수동 실행 전용 (자동 스케줄 없음)
                        </p>
                    </div>
                    <button
                        onClick={() => setShowResearch(true)}
                        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                    >
                        딥 리서치 실행
                    </button>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <Icon name="Heart" size={16} className="text-pink-400" />
                        <span className="text-white font-medium text-sm">인스타 자동 좋아요</span>
                    </div>
                    <p className="text-gray-500 text-xs mb-2">키워드(해시태그) 검색 → 게시물 좋아요 · 일일 10회 제한 · stealth 모드</p>
                    <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-lg px-3 py-2 mb-4">
                        <p className="text-yellow-400 text-[11px] leading-relaxed">
                            ⚠️ <strong>집 PC 작업 스케줄러</strong>에서 실행됨 (GCP 서버 아님)<br />
                            매일 새벽 3시 자동 실행 · <code className="bg-yellow-900/40 px-1 rounded">ai_mp/instagram/liker.js</code><br />
                            여기 버튼은 <strong>수동 즉시 실행</strong>용 (GCP에서 1회 실행)
                        </p>
                    </div>
                    <button
                        onClick={() => setShowInstagramLiker(true)}
                        className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:opacity-90 text-white text-sm font-medium transition-all"
                    >
                        좋아요 실행
                    </button>
                </div>
            </div>
        </div>
    );
};
