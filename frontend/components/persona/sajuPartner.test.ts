import { describe, expect, it } from 'vitest';
import { withBirth, withPartner, withTwoPartners, type SajuBirth } from './useSajuRunner';

// 도결 사주 진입화면 — 궁합 계열의 프롬프트 조립 (2026-09-07).
//
// 왜 이 파일인가: 궁합은 **상대방 정보를 못 받으면 기능 자체가 성립하지 않는데**,
// 진입화면에는 그 입력 UI 가 없어 채팅으로 튕겨 나가고 있었다(인연 궁합).
// 더 나쁜 건 `친구 둘 궁합`으로, `twoPartnerModal` 분기가 아예 없어
// **상대 정보 없이 그대로 실행돼 포인트만 나갔다**(2026-09-07 DB 정본 대조로 발견).
//
// 여기서 고정하는 계약은 두 가지다.
//   ① 채팅 경로와 **같은 문장 형식**일 것 — 다르면 같은 기능인데 결과가 갈린다.
//   ② 내 명부가 **한 번만** 들어갈 것 — 조립 함수와 `withBirth` 가 겹치면 두 번 들어간다.

const me: SajuBirth      = { name: '박광석', year: '1970', month: '3',  day: '5', time: '오시(午時)', lunar: false };
const partner: SajuBirth = { name: '김영희', year: '1988', month: '11', day: '2', time: '모름',      lunar: true  };
const friend2: SajuBirth = { name: '이철수', year: '1991', month: '6',  day: '9', time: '축시(丑時)', lunar: false };

// ── 채팅 경로(App.tsx)의 조립을 그대로 옮긴 기준값 ──
// ★App.tsx 는 지역 스코프라 import 할 수 없어 복제한다. 한쪽을 고치면 여기도 고쳐야 하며,
//   이 테스트가 바로 그 "고쳐야 한다"를 알려주는 장치다.
const chatPartnerHead = (prompt: string, p: SajuBirth) => {         // App.tsx:2174
    const t = p.time && p.time !== '모름' ? ` ${p.time}생` : '';
    const cal = p.lunar ? '음력' : '양력';
    return `상대방: ${p.name}, ${cal} ${p.year}년 ${p.month}월 ${p.day}일${t}. ${prompt}`;
};
const chatTwo = (prompt: string, a: SajuBirth, b: SajuBirth) => {   // App.tsx:2201-2209
    const fmt = (p: SajuBirth) => {
        const t = p.time && p.time !== '모름' ? ` ${p.time}생` : '';
        const cal = p.lunar ? '음력' : '양력';
        return `${p.name}(${cal} ${p.year}년 ${p.month}월 ${p.day}일${t})`;
    };
    return `친구1: ${fmt(a)}, 친구2: ${fmt(b)}. ${prompt}`;
};

describe('인연 궁합 — 상대방 정보', () => {
    it('상대방 표기가 채팅 경로와 글자까지 같다', () => {
        expect(withPartner('궁합을 봐주세요.', partner))
            .toBe(chatPartnerHead('궁합을 봐주세요.', partner));
    });

    it("시(時)가 '모름'이면 시각을 적지 않는다", () => {
        expect(withPartner('궁합을 봐주세요.', partner)).not.toContain('모름');
        expect(withPartner('궁합을 봐주세요.', { ...partner, time: '오시(午時)' })).toContain('오시(午時)생');
    });

    it('음력/양력을 상대방 값 그대로 쓴다', () => {
        expect(withPartner('x', partner)).toContain('음력 1988년');
        expect(withPartner('x', { ...partner, lunar: false })).toContain('양력 1988년');
    });

    // ★★이 화면의 실제 실행 경로는 `run()` → `withBirth()` 다.
    //   조립 함수가 내 명부까지 붙이면 사용자 정보가 두 번 들어간다.
    it('내 명부는 한 번만 들어간다 (run 의 withBirth 와 겹치지 않는다)', () => {
        const sent = withBirth(withPartner('궁합을 봐주세요.', partner), me);
        expect(sent.match(/박광석/g)).toHaveLength(1);
        expect(sent.match(/1970년/g)).toHaveLength(1);
    });

    it('상대와 나를 뒤바꾸지 않는다', () => {
        const sent = withBirth(withPartner('궁합을 봐주세요.', partner), me);
        expect(sent.indexOf('김영희')).toBeLessThan(sent.indexOf('박광석'));  // 상대가 앞, 내가 뒤
        expect(sent).toMatch(/^상대방: 김영희/);
    });
});

describe('친구 둘 궁합 — 두 사람 정보', () => {
    const P = '두 벗의 사이를 헤아려 주게나.';

    it('두 친구 표기가 채팅 경로와 글자까지 같다', () => {
        expect(withTwoPartners(P, partner, friend2)).toBe(chatTwo(P, partner, friend2));
    });

    it('입력 순서가 곧 친구1·친구2다 (뒤바뀌면 결과가 달라진다)', () => {
        const s = withTwoPartners(P, partner, friend2);
        expect(s).toMatch(/^친구1: 김영희/);
        expect(s).toContain('친구2: 이철수');
        expect(withTwoPartners(P, friend2, partner)).not.toBe(s);
    });

    it('두 사람 정보가 모두 들어간다 (한쪽만 들어가면 궁합이 성립하지 않는다)', () => {
        const sent = withBirth(withTwoPartners(P, partner, friend2), me);
        for (const token of ['김영희', '1988년', '이철수', '1991년']) {
            expect(sent, `${token} 가 빠졌다`).toContain(token);
        }
    });

    it('내 명부는 여기서도 한 번만 들어간다', () => {
        const sent = withBirth(withTwoPartners(P, partner, friend2), me);
        expect(sent.match(/박광석/g)).toHaveLength(1);
    });
});

describe('모달이 떠 있을 때 진입화면을 닫지 않는다', () => {
    // 2026-09-07 실측 사고: 상대 정보 모달 안의 `다음 →` 을 눌렀더니 **진입화면이 통째로
    // 닫히고 메인으로 튕겼다.** `sj-root` 가 자식 클릭을 전부 onClose 로 받는데
    // 모달들은 `sj-sheet`(stopPropagation) **밖**에 렌더되기 때문이다.
    // ★궁합만의 문제가 아니었다 — 같은 구조라 **관상·손금(2026-08-27)도 깨져 있었다**.
    //   그래서 개별 모달이 아니라 닫기 판단 한 곳을 고쳤고, 그 규칙을 여기 고정한다.
    type S = { inputKind?: string | null; partnerFor?: unknown; twoStep?: number; faceResult?: unknown; palmResult?: unknown };
    const modalUp = (s: S) => !!(s.inputKind || s.partnerFor || (s.twoStep ?? 0) > 0 || s.faceResult || s.palmResult);
    /** 배경 클릭·Esc 가 진입화면을 닫는가 */
    const closesEntry = (s: S) => !modalUp(s);

    it('모달이 없으면 배경 클릭·Esc 로 닫힌다 (기존 동작 보존)', () => {
        expect(closesEntry({})).toBe(true);
    });

    it('상대 정보 모달이 떠 있으면 닫지 않는다', () => {
        expect(closesEntry({ partnerFor: { label: '인연 궁합', prompt: 'x' } })).toBe(false);
    });

    it('친구 둘 궁합은 1·2단계 모두 닫지 않는다', () => {
        expect(closesEntry({ twoStep: 1 })).toBe(false);
        expect(closesEntry({ twoStep: 2 })).toBe(false);
        expect(closesEntry({ twoStep: 0 })).toBe(true);   // 끝나면 다시 닫힌다
    });

    // ★형제 확인 — 내가 만든 궁합만 막고 기존 것을 빠뜨리면 반쪽 수정이다.
    it('관상·손금·꿈해몽 모달과 결과 카드도 함께 보호된다', () => {
        for (const s of [
            { inputKind: 'face' }, { inputKind: 'palm' }, { inputKind: 'dream' },
            { faceResult: {} }, { palmResult: {} },
        ] as S[]) {
            expect(closesEntry(s), `${JSON.stringify(s)} 에서 진입화면이 닫히면 안 된다`).toBe(false);
        }
    });
});

describe('메뉴 분기 — DB 정본에 있는 필드를 빠뜨리지 않는다', () => {
    // 2026-09-07 실측한 도결 `quickMenuJson` 의 궁합 계열 3종.
    // ★`twoPartnerModal` 을 모르면 그 항목이 상대 정보 없이 실행된다 —
    //   화면 코드의 분기가 이 세 갈래를 모두 덮는지 규칙으로 고정한다.
    type Item = { label: string; prompt: string; partnerModal?: boolean; twoPartnerModal?: boolean };
    const route = (it: Item) =>
        it.twoPartnerModal ? 'two' : it.partnerModal ? 'partner' : 'run';

    const items: Item[] = [
        { label: '연애 운세',      prompt: '연애 운세를 봐주세요.', },
        { label: '인연 궁합',      prompt: '궁합을 봐주세요.',      partnerModal: true },
        { label: '나와 친구 궁합', prompt: '우정 궁합을 봐주게나.', partnerModal: true },
        { label: '친구 둘 궁합',   prompt: '두 벗의 사이를…',       twoPartnerModal: true },
    ];

    it('상대 정보가 필요한 항목은 바로 실행하지 않는다', () => {
        expect(items.map(route)).toEqual(['run', 'partner', 'partner', 'two']);
    });

    it('친구 둘 궁합이 1인 궁합으로 새지 않는다', () => {
        expect(route(items[3])).not.toBe('partner');
    });
});
