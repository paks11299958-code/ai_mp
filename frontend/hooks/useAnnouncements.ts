import { useState, useEffect } from 'react';
import { announcementApi } from '../services/apiService';
import { Announcement } from '../types';

/**
 * 공지 로드·읽음 처리 훅 (App.tsx #1 분해 — T3).
 *
 * - mount 시 공지 목록을 1회 fetch하고, 미읽음 공지가 있으면 모달을 자동 오픈.
 * - 읽음 ID는 localStorage('readAnnouncements')에 Set으로 직렬화/복원.
 * - 동작 변경 없음: 원본 App.tsx의 lazy init·effect·핸들러를 그대로 이동.
 */
export function useAnnouncements() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
    const [readAnnouncementIds, setReadAnnouncementIds] = useState<Set<number>>(() => {
        try { return new Set(JSON.parse(localStorage.getItem('readAnnouncements') || '[]')); } catch { return new Set(); }
    });

    useEffect(() => {
        // 공지 목록만 불러옴(미읽음 배지용). 자동 팝업은 하지 않음
        // — 사용자 요청: 공지는 종(🔔) 버튼 클릭 시에만 표시.
        announcementApi.getAll().then(setAnnouncements).catch(() => {});
    }, []);

    const handleReadAnnouncements = (ids: number[]) => {
        setReadAnnouncementIds(prev => {
            const next = new Set([...prev, ...ids]);
            localStorage.setItem('readAnnouncements', JSON.stringify([...next]));
            return next;
        });
    };

    const unreadAnnouncementCount = announcements.filter(a => !readAnnouncementIds.has(a.id)).length;

    return {
        announcements,
        readAnnouncementIds,
        showAnnouncementModal,
        setShowAnnouncementModal,
        handleReadAnnouncements,
        unreadAnnouncementCount,
    };
}
