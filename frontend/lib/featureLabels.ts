/**
 * 포인트를 차감하는 기능의 키 → 사람이 읽는 이름.
 *
 * 원래 AdminPanel.tsx 안에만 있었는데, 2026-08-08 포인트 부족 안내를 만들며
 * 회원 화면에서도 필요해졌다. **복사해서 두 벌로 두면 새 기능이 생겼을 때 한쪽만
 * 갱신돼 조용히 어긋난다**(어드민엔 이름이 나오는데 회원 화면엔 원문 키가 뜨는 식).
 * 그래서 여기로 옮기고 AdminPanel이 이 파일을 참조하게 했다 — 추가는 여기 한 곳에만.
 *
 * 키는 서버 checkMenuAccess의 feature 문자열과 1:1. 순서 = 어드민 표시 순서.
 */
export const FEATURE_LABELS: Record<string, string> = {
    'news':       '오늘 뉴스',
    'stock':      '주식 분석',
    'luxury':     '명품 감정',
    'used-item':  '중고판매 분석',
    'hot-keyword':'핫쇼핑 키워드',
    'insurance':  '보험 컨설팅',
    'face':       '얼굴 관상',
    'palm':       '손금',
    'quick-menu': '운세·사주(시운·재물·인연·꿈해몽)',
    'mathtutor':  'AI쌤 수학(풀이·출제)',
    'hair':       '헤어Style',
    'agetransform':'시간여행(나이변환)',
    'outfit':     '프로필 사진',
    'lookalike':  '연예인 매칭',
    'golf':       '골프 스윙 분석',
    'webtoon':    '웹툰 보기',
    'club':       '모임(출첵)',
    'ebook_docx_per1k': '전자책 문서 만들기(1,000자당)',
    'ebook_image_prompt': '전자책 그림 프롬프트 뽑기(일괄)',
    'ebook_image': '전자책 그림 이미지 생성(장당)',
    'ebook_cover': '전자책 AI 표지 생성(장당)',
    'marketing':  'AI 마케팅 글쓰기',
    'homepage':   '홈페이지 만들기',
    'homepage_edit_text':   '홈페이지 수정(텍스트)',
    'homepage_edit_image':  '홈페이지 수정(AI 사진)',
    'homepage_edit_upload': '홈페이지 수정(내 사진)',
    'shorts_maker_research': '쇼츠 만들기(리서치+시나리오5개)',
    'shorts_maker_produce':  '쇼츠 만들기(영상 제작)',
};

/**
 * 회원 안내용 짧은 이름. 위 라벨은 어드민용이라 괄호 설명이 붙어 길다 —
 * "운세·사주(시운·재물·인연·꿈해몽)에 500P가 필요해요"는 문장이 무너진다.
 * 괄호 앞부분만 잘라 쓰고, 없는 키는 undefined를 돌려 호출측이 문구를 생략하게 한다.
 */
export function shortFeatureLabel(key?: string): string | undefined {
    if (!key) return undefined;
    const full = FEATURE_LABELS[key];
    if (!full) return undefined;
    return full.split('(')[0].trim();
}
