/**
 * 홈페이지 요구사항(brief) 정의 — 2026-08-20.
 *
 * 개발AI 콘솔의 원래 폼은 `기능 / 참조사이트 / 명세본문` 3칸뿐이었다. 그건 **프로그램
 * 개발용** 틀이라, 홈페이지를 만들 때 개발AI가 상호명·연락처·주소를 **지어냈다**.
 * 홍보 홈페이지에 가짜 전화번호가 박히면 실제 고객이 잘못된 곳으로 연락한다.
 *
 * ★필드 정의를 여기 한 곳에만 둔다 — 폼·저장·프롬프트가 각자 목록을 갖고 있으면
 *   하나를 추가할 때 나머지가 조용히 빠진다.
 *
 * ★autofill 규칙(사장 지시 2026-08-20):
 *   - `autofill: true`  → 비워두면 **개발AI가 알아서 초안을 채운다**. 나중에 수정하면 된다.
 *   - `autofill: false` → 비워두면 **비워둔 채로 둔다**. 연락처·주소·사업자번호처럼
 *     지어내면 안 되는 값이다. 프롬프트에도 "지어내지 말 것"을 명시한다.
 */

export interface BriefField {
    /** brief JSON 의 키 */
    key: string;
    /** 화면 라벨 */
    label: string;
    /** 입력 힌트 */
    hint?: string;
    /** 여러 줄 입력인가 */
    multiline?: boolean;
    /** 비워두면 AI가 채워도 되는가. false = 지어내면 안 되는 값 */
    autofill: boolean;
}

export interface BriefSection {
    key: string;
    title: string;
    /** 섹션 설명 — 왜 이걸 묻는지 */
    desc: string;
    fields: BriefField[];
}

/** 홈페이지 요구사항 섹션 정의. 순서가 곧 화면 순서다. */
export const BRIEF_SECTIONS: BriefSection[] = [
    {
        key: 'basic',
        title: '기본 정보',
        desc: '누구의, 무엇을 위한 홈페이지인지',
        fields: [
            { key: 'bizName', label: '상호명', hint: '가게·회사 이름', autofill: true },
            { key: 'tagline', label: '한 줄 소개', hint: '무엇을 하는 곳인지 한 문장', autofill: true },
            { key: 'purpose', label: '홈페이지 목적', hint: '예: 문의 받기 / 예약 / 브랜드 알리기', autofill: true },
            { key: 'target', label: '주요 고객', hint: '예: 30~40대 직장인, 지역 주민, B2B 기업', autofill: true },
        ],
    },
    {
        key: 'service',
        title: '서비스·강점',
        desc: '무엇을 파는지, 왜 여기여야 하는지',
        fields: [
            { key: 'services', label: '제공 서비스·제품', hint: '한 줄씩', multiline: true, autofill: true },
            { key: 'strengths', label: '강점·차별점', hint: '경쟁사와 다른 점 · 한 줄씩', multiline: true, autofill: true },
            { key: 'priceInfo', label: '가격 안내', hint: '공개할 가격이 있으면. 없으면 비워두세요', autofill: true },
        ],
    },
    {
        key: 'brand',
        title: '브랜드·분위기',
        desc: '어떤 느낌으로 보이고 싶은지 (로고는 아래 참조 이미지로 올리세요)',
        fields: [
            { key: 'tone', label: '톤앤매너', hint: '예: 신뢰감 있고 전문적 / 따뜻하고 편안한', autofill: true },
            { key: 'mainColor', label: '메인 컬러', hint: '예: 남색, #1E40AF, 초록 계열', autofill: true },
            { key: 'avoid', label: '피하고 싶은 것', hint: '예: 너무 화려한 건 싫어요', autofill: true },
        ],
    },
    {
        key: 'contact',
        title: '연락처·푸터',
        // ★이 섹션만 자동 생성에서 뺀다. 지어낸 연락처는 실제 피해가 된다.
        desc: '★비워두면 비워둔 채로 나갑니다 — 지어내지 않습니다',
        fields: [
            { key: 'address', label: '주소', autofill: false },
            { key: 'phone', label: '전화번호', autofill: false },
            { key: 'email', label: '이메일', autofill: false },
            { key: 'hours', label: '영업시간', hint: '예: 평일 09:00~18:00', autofill: false },
            { key: 'bizNo', label: '사업자등록번호', autofill: false },
            { key: 'sns', label: 'SNS·채널', hint: '인스타·카톡채널 등 · 한 줄씩', multiline: true, autofill: false },
        ],
    },
    {
        key: 'structure',
        title: '구성',
        desc: '어떤 화면이 필요한지',
        fields: [
            { key: 'sections', label: '필수 섹션', hint: '예: 소개, 시술안내, 오시는길 · 한 줄씩', multiline: true, autofill: true },
            { key: 'cta', label: 'CTA 문구', hint: '방문자가 누를 버튼. 예: 상담 예약하기', autofill: true },
            { key: 'etc', label: '그 밖에 하고 싶은 말', multiline: true, autofill: true },
        ],
    },
];

/** 모든 필드를 평평하게 — 저장·프롬프트 생성이 이걸 돈다. */
export const BRIEF_FIELDS: BriefField[] = BRIEF_SECTIONS.flatMap(s => s.fields);

/** 지어내면 안 되는 필드 키 목록(연락처류). */
export const NO_AUTOFILL_KEYS: string[] = BRIEF_FIELDS.filter(f => !f.autofill).map(f => f.key);

export type BriefValues = Record<string, string>;

/** JSON 문자열 → 값 맵. 깨졌으면 빈 객체(폼이 죽으면 안 된다). */
export function parseBrief(json: string | null | undefined): BriefValues {
    if (!json) return {};
    try {
        const o = JSON.parse(json);
        if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
        const out: BriefValues = {};
        for (const f of BRIEF_FIELDS) {
            const v = (o as any)[f.key];
            if (typeof v === 'string' && v.trim()) out[f.key] = v;
        }
        return out;
    } catch {
        return {};
    }
}

/** 값 맵 → 저장용 JSON 문자열. 빈 값은 아예 넣지 않는다(무엇을 안 적었는지가 정보다). */
export function stringifyBrief(values: BriefValues): string {
    const out: BriefValues = {};
    for (const f of BRIEF_FIELDS) {
        const v = (values[f.key] ?? '').trim();
        if (v) out[f.key] = v.slice(0, 2000);
    }
    return JSON.stringify(out);
}

/** 하나라도 채워졌는가 — 홈페이지 프로젝트인지 판단하는 데 쓴다. */
export function hasAnyBrief(values: BriefValues): boolean {
    return BRIEF_FIELDS.some(f => (values[f.key] ?? '').trim());
}
