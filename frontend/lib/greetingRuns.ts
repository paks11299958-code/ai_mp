/** 연속된 인사(role 'assistant')는 마지막 하나만 보여준다 — 화면 표시만, 저장 데이터는 그대로.
 *  ★10-03 서버 수정(인사 교체, shared-api greetPolicy) 이전에는 재방문마다 인사가 새로 쌓여
 *    "다시 뵙게 되어 반갑네요"가 여러 개 연달아 보였다(사장 승인 2026-10-05 "전부다").
 *  ★운영 DB 실측: role 'assistant' = 인사만(546건·최장 211자), 실제 답변은 'model'.
 *    프론트 타입(Role)은 'user'|'model' 이지만 런타임엔 서버 role 문자열이 그대로 들어온다. */
export const collapseGreetingRuns = <T extends { role: string }>(messages: T[]): T[] =>
    messages.filter((m, i) => !(m.role === 'assistant' && messages[i + 1]?.role === 'assistant'));
