/**
 * 개발AI 콘솔 — 어드민 API 진입점(정적 경로판).
 *
 * ★왜 [action].ts 와 따로 두는가
 *   vercel.json 의 마지막 rewrite 블록이 `/api/:d/:s1` 을 전부 `/api/router` 로 보낸다.
 *   `/api/devai/list` 같은 **동적 세그먼트 경로**는 그 rewrite 에 걸려 router.ts 의
 *   404 로 떨어진다. 반면 파일과 1:1로 대응하는 **정적 경로**는 rewrite 보다 먼저
 *   처리되어 실제로 동작한다(인버스 탭에서 같은 방식으로 확인됨).
 *   그래서 프런트는
 *     GET  /api/devai?action=list
 *     POST /api/devai?action=create
 *   형태로 이 파일을 호출한다. 처리 로직은 [action].ts 하나뿐이며 여기서는 재수출만 한다.
 */

import handler from './[action].js';

export default handler;
