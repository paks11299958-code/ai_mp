import { useCallback, useEffect, useState } from 'react';
import { personaApi, quickMenuApi, userProfileApi } from '../../services/apiService';

// ★`QuickMenuItem` 은 App.tsx 안의 **지역 타입**이라 가져올 수 없다.
//   App.tsx 를 건드리지 않기로 했으므로(2026-07-29 전 화면 백지 사고) 필요한 필드만 여기 둔다.
//   DB `Persona.quickMenuJson` 이 정본이며, 여기 없는 필드는 이 화면이 쓰지 않는다는 뜻이다.
export interface SajuMenu {
    label: string;
    prompt?: string;
    resultCard?: boolean;
    placeholder?: string;
    faceModal?: boolean;
    palmModal?: boolean;
    tarotModal?: boolean;
    partnerModal?: boolean;
    subMenu?: {
        dialog?: string;
        // ★`twoPartnerModal`(친구 둘 궁합)이 빠져 있으면 그 항목이 **상대 정보 없이**
        //   그대로 실행돼 포인트만 차감된다(2026-09-07 실측). DB 정본에 있는 필드는 전부 둔다.
        items?: { label: string; prompt: string; partnerModal?: boolean; twoPartnerModal?: boolean }[];
    };
}

// 도결 선생 진입 화면 **안에서** 기능을 실행한다 — 채팅으로 나가지 않는다.
//
// 왜(2026-08-27 사장 지시): "진입 화면에서 다 처리하고 싶다. 기존 채팅창으로 들어가고
// 싶지 않다." 기존 경로는 칩을 누르면 goTo('chat') 으로 화면을 통째로 갈아치웠다.
//
// ★새 API 를 만들지 않았다. `quickMenuApi.generate()` 는 채팅 화면이 쓰던 것과 **같은**
//   엔드포인트다(`/quick-menu-result`). 과금·차감도 서버가 하던 그대로다 —
//   여기서 바뀌는 것은 "결과를 어디에 그리느냐" 하나뿐이다.
// ★1단계 대상은 `resultCard: true` 인 기능뿐이다(운세·재물·인연·전생·우정).
//   해몽(텍스트 입력)·관상/손금(사진 업로드)은 입력 UI 가 따로 필요해 기존 채팅 경로로 둔다.

export interface SajuBirth {
    name: string;
    year: string; month: string; day: string;
    time?: string;
    lunar?: boolean;
}

export interface SajuRunnerState {
    /** 서브메뉴 선택 중이면 그 메뉴(항목 목록·안내문) */
    picking: SajuMenu | null;
    /** 실행 중 */
    loading: boolean;
    /** 결과(제목·본문) */
    result: { title: string; body: string } | null;
    /** 사용자에게 보일 오류 */
    error: string | null;
}

const EMPTY: SajuRunnerState = { picking: null, loading: false, result: null, error: null };

/** 명부를 프롬프트 뒤에 붙인다 — 채팅 경로(App.tsx)와 **같은 문장 형식**을 쓴다.
 *  형식이 다르면 같은 기능인데 결과 품질이 달라진다. */
export const withBirth = (prompt: string, b: SajuBirth | null): string => {
    if (!b) return prompt;
    const t = b.time && b.time !== '모름' ? ` ${b.time}생` : '';
    const cal = b.lunar ? '음력' : '양력';
    return `${prompt}\n\n사용자 정보 — 이름: ${b.name}, 생년월일: ${cal} ${b.year}년 ${b.month}월 ${b.day}일${t}`;
};

/** 궁합 — 상대방 정보를 프롬프트 **앞에** 붙인다.
 *  ★채팅 경로(App.tsx `PartnerInfoModal.onComplete`)와 **같은 문장 형식**이다.
 *    형식이 다르면 같은 기능인데 결과가 달라진다(`withBirth` 와 같은 이유).
 *  ★★내 명부는 여기서 붙이지 않는다 — `run()` 이 `withBirth()` 로 붙이므로
 *    여기서도 붙이면 **사용자 정보가 두 번** 들어간다. 채팅 경로는 `runQuickMenuCard`
 *    가 명부를 안 붙이기 때문에 거기서 직접 붙이는 것이고, 여기는 통로가 다르다. */
export const withPartner = (prompt: string, p: SajuBirth): string => {
    const t = p.time && p.time !== '모름' ? ` ${p.time}생` : '';
    const cal = p.lunar ? '음력' : '양력';
    return `상대방: ${p.name}, ${cal} ${p.year}년 ${p.month}월 ${p.day}일${t}. ${prompt}`;
};

/** 친구 둘 궁합 — 제3자 둘의 정보를 앞에 붙인다.
 *  ★채팅 경로(App.tsx `twoPartnerStep === 2`)와 **같은 문장 형식**이다.
 *  ★여기는 '나'가 주인공이 아니지만 `run()` 이 명부를 붙이는 것은 그대로 둔다 —
 *    채팅 경로도 `useBirthInfo` 페르소나면 같은 정보를 갖고 판단하며,
 *    형식을 여기서만 바꾸면 두 화면의 결과가 갈린다. */
export const withTwoPartners = (prompt: string, a: SajuBirth, b: SajuBirth): string => {
    const fmt = (p: SajuBirth) => {
        const t = p.time && p.time !== '모름' ? ` ${p.time}생` : '';
        const cal = p.lunar ? '음력' : '양력';
        return `${p.name}(${cal} ${p.year}년 ${p.month}월 ${p.day}일${t})`;
    };
    return `친구1: ${fmt(a)}, 친구2: ${fmt(b)}. ${prompt}`;
};

/** 포인트 부족은 apiService 가 이미 충전 모달을 띄운다 — 여기서 또 알리지 않는다. */
const messageFor = (e: any): string | null => {
    if (e?.code === 'INSUFFICIENT_POINTS') return null;
    return e?.message || '풀이를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.';
};

/** 저장된 명부를 서버에서 한 번 읽어온다.
 *  ★App.tsx 의 `useQuickMenu` 가 쓰는 것과 **같은 API**다 — 별도 저장소를 만들지 않는다.
 *  실패해도 조용히 null 로 둔다(명부 없이도 풀이는 나온다, 정확도만 떨어진다). */
export const useSavedBirth = (): [SajuBirth | null, (b: SajuBirth) => void] => {
    const [birth, setBirth] = useState<SajuBirth | null>(null);
    useEffect(() => {
        let alive = true;
        userProfileApi.getBirthInfo()
            .then(({ birthInfoJson }: any) => {
                if (!alive || !birthInfoJson) return;
                try { setBirth(typeof birthInfoJson === 'string' ? JSON.parse(birthInfoJson) : birthInfoJson); }
                catch { /* 형식이 깨졌으면 없는 것으로 둔다 */ }
            })
            .catch(() => { /* 비로그인·네트워크 실패 — 명부 없이 진행 */ });
        return () => { alive = false; };
    }, []);
    return [birth, setBirth];
};

/** 페르소나 **이름**으로 id 와 퀵메뉴를 찾아온다.
 *  ★왜 이름인가: 진입 시트가 받는 `guide` 에는 `personaId` 가 없다. App.tsx 에 필드를
 *    추가하면 될 일이지만 **그 파일은 건드리지 않기로 했다**(2026-07-29 전 화면 백지 사고).
 *    이름은 어드민에서 바뀔 수 있으나, 바뀌면 이 화면 분기(`startsWith('도결')`)도 함께
 *    안 걸리므로 **불일치가 조용히 남지 않는다**.
 *  ★정본은 DB `Persona.quickMenuJson` — 프롬프트를 화면에 하드코딩하지 않는다.
 *    어드민이 메뉴를 고치면 이 화면도 따라간다. */
export const usePersonaMenus = (personaName: string | undefined): { id?: string; menus: SajuMenu[] } => {
    const [found, setFound] = useState<{ id?: string; menus: SajuMenu[] }>({ menus: [] });
    useEffect(() => {
        if (!personaName) return;
        let alive = true;
        personaApi.getAll()
            .then((list: any[]) => {
                if (!alive) return;
                const p = list.find(x => x.name === personaName);
                if (!p) return;
                let menus: SajuMenu[] = [];
                try { menus = JSON.parse(p.quickMenuJson || '{}').menus ?? []; } catch { /* 형식 깨짐 */ }
                setFound({ id: p.id, menus });
            })
            .catch(() => { /* 실패하면 칩이 안 보일 뿐, '대화하기' 버튼은 그대로 동작한다 */ });
        return () => { alive = false; };
    }, [personaName]);
    return found;
};

export const useSajuRunner = (personaId: string | undefined, birth: SajuBirth | null) => {
    const [state, setState] = useState<SajuRunnerState>(EMPTY);

    /** 프롬프트 하나를 실행해 결과를 창 안에 담는다. */
    const run = useCallback((title: string, prompt: string) => {
        if (!personaId) return;
        setState({ picking: null, loading: true, result: null, error: null });
        quickMenuApi.generate(personaId, withBirth(prompt, birth))
            .then(({ result }) => setState({ picking: null, loading: false, result: { title, body: result }, error: null }))
            .catch(e => setState({ picking: null, loading: false, result: null, error: messageFor(e) }));
    }, [personaId, birth]);

    /** 칩·카드 클릭. 서브메뉴가 있으면 항목 선택을 먼저 띄운다. */
    const select = useCallback((menu: SajuMenu) => {
        if (menu.subMenu) { setState({ ...EMPTY, picking: menu }); return; }
        run(menu.label, menu.prompt ?? '');
    }, [run]);

    /** 서브메뉴 항목 선택 */
    const pick = useCallback((label: string, prompt: string) => run(label, prompt), [run]);

    const reset = useCallback(() => setState(EMPTY), []);

    return { ...state, select, pick, run, reset };
};

/** 이 메뉴를 창 안에서 처리할 수 있는가.
 *  ★`resultCard` 가 아닌 것(해몽·관상·손금)은 입력 UI 가 따로 필요하므로 채팅으로 보낸다. */
export const canRunInSheet = (menu: SajuMenu): boolean =>
    !!menu.resultCard && !menu.faceModal && !menu.palmModal && !menu.placeholder && !menu.tarotModal;

/** 기능키 → 퀵메뉴 라벨.
 *  ★FEATURES_GRID 의 이름(`시운의 흐름`)과 DB 퀵메뉴 라벨(`📅 운세`)이 **다르다.**
 *    이름으로 맞추려 하면 안 된다 — App.tsx 의 `FEATURE_QUICK_MENU_LABEL` 과 **같은 표**를 쓴다.
 *    (그 표는 App.tsx 안의 지역 상수라 가져올 수 없어 여기 복제한다. 어느 한쪽을 고치면
 *     다른 쪽도 고쳐야 한다 — 기능키가 추가되는 일은 드물어 복제 비용이 더 싸다.) */
const KEY_TO_LABEL: Record<string, string> = {
    siwoon: '📅 운세',
    wealth: '💰 재물',
    yeonn: '❤️ 인연',
    rebirth: '🕉️ 전생',
    friendship: '🤝 우정',
    // 아래는 창 안에서 못 돌린다(입력 UI 필요) — 표에는 두되 canRunInSheet 가 걸러낸다.
    dream: '🌙 해몽',
    gwansang: '🔮 관상',
    palm: '🖐 손금',
};

/** 기능키로 창 안에서 돌릴 수 있는 메뉴를 찾는다. 없으면 undefined(→ 채팅 경로). */
export const sheetMenuFor = (menus: SajuMenu[], featureKey: string): SajuMenu | undefined => {
    const label = KEY_TO_LABEL[featureKey];
    if (!label) return undefined;
    const m = menus.find(x => x.label === label);
    return m && canRunInSheet(m) ? m : undefined;
};

/** 2단계 — 입력 UI 가 필요한 기능도 창 안에서 처리한다(2026-08-27).
 *  ★관상·손금은 **기존 모달·결과 카드를 그대로** 띄운다(FaceReadingModal 등은 독립
 *    컴포넌트라 personaId 만 주면 된다). 새로 만들 이유가 없다.
 *  ★꿈해몽만 입력창이 없다 — 채팅 입력창에 의존하던 것이라 창 안에 textarea 를 둔다. */
export type SajuInputKind = 'face' | 'palm' | 'dream';

export const inputKindFor = (menus: SajuMenu[], featureKey: string): SajuInputKind | undefined => {
    const label = KEY_TO_LABEL[featureKey];
    const m = label ? menus.find(x => x.label === label) : undefined;
    if (!m) return undefined;
    if (m.faceModal) return 'face';
    if (m.palmModal) return 'palm';
    if (m.placeholder) return 'dream';
    return undefined;
};

/** 꿈해몽 안내 문구 — DB 의 placeholder 를 그대로 쓴다(문구 창작 금지). */
export const dreamPlaceholder = (menus: SajuMenu[]): string =>
    menus.find(m => m.label === KEY_TO_LABEL.dream)?.placeholder
    ?? '어젯밤 꾼 꿈의 내용을 들려주세요.';
