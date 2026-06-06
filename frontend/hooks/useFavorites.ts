import { useState, useEffect, useCallback, useRef } from 'react';
import { userProfileApi } from '../services/apiService';

/**
 * 즐겨찾기 목록 상태 훅(범용). 기능/페르소나 양쪽에서 재사용.
 * - 로그인 시 load()로 서버에서 키 목록을 불러온다.
 * - toggle 시 낙관적 업데이트 후 save()로 저장(실패하면 롤백).
 * 저장 형식: 문자열 배열의 JSON.
 */
function useFavoriteList(
    isLoggedIn: boolean,
    load: () => Promise<string | null>,
    save: (json: string) => Promise<unknown>,
) {
    const [favorites, setFavorites] = useState<string[]>([]);
    const [loaded, setLoaded] = useState(false);
    const savingRef = useRef(false);

    useEffect(() => {
        if (!isLoggedIn) { setFavorites([]); setLoaded(false); return; }
        let alive = true;
        load()
            .then(json => {
                if (!alive) return;
                try {
                    const arr = json ? JSON.parse(json) : [];
                    setFavorites(Array.isArray(arr) ? arr.filter(k => typeof k === 'string') : []);
                } catch { setFavorites([]); }
                setLoaded(true);
            })
            .catch(() => { if (alive) setLoaded(true); });
        return () => { alive = false; };
    }, [isLoggedIn]);

    const persist = useCallback(async (next: string[], prev: string[]) => {
        if (savingRef.current) return;
        savingRef.current = true;
        try {
            await save(JSON.stringify(next));
        } catch {
            setFavorites(prev); // 실패 시 롤백
        } finally {
            savingRef.current = false;
        }
    }, [save]);

    const toggleFavorite = useCallback((key: string) => {
        setFavorites(prev => {
            const exists = prev.includes(key);
            const next = exists ? prev.filter(k => k !== key) : [...prev, key];
            if (next.length > 20) return prev; // 최대 20개
            persist(next, prev);
            return next;
        });
    }, [persist]);

    const isFavorite = useCallback((key: string) => favorites.includes(key), [favorites]);

    return { favorites, isFavorite, toggleFavorite, favoritesLoaded: loaded };
}

/** 기능 즐겨찾기(자주가는 메뉴) */
export function useFavorites(isLoggedIn: boolean) {
    return useFavoriteList(
        isLoggedIn,
        () => userProfileApi.getFavorites().then(r => r.favoritesJson),
        (json) => userProfileApi.saveFavorites(json),
    );
}

/** 페르소나 즐겨찾기 */
export function useFavoritePersonas(isLoggedIn: boolean) {
    return useFavoriteList(
        isLoggedIn,
        () => userProfileApi.getFavoritePersonas().then(r => r.favoritePersonasJson),
        (json) => userProfileApi.saveFavoritePersonas(json),
    );
}
