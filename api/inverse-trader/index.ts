/**
 * 인버스 ETF 1호가 스캘핑 — 어드민 API 진입점(정적 경로판).
 *
 * ★왜 [action].ts 와 따로 두는가
 *   vercel.json 의 마지막 rewrite 블록이 `/api/:d/:s1` 을 전부 `/api/router` 로 보낸다.
 *   `/api/inverse-trader/status` 같은 **동적 세그먼트 경로**는 이 rewrite 에 걸려
 *   router.ts 의 404 로 떨어질 수 있다(라우터는 모든 도메인이 shared-api 로 이전된 뒤
 *   404 방어용으로만 남아 있다).
 *   반면 `/api/math-tutor-tts` 처럼 **파일과 1:1로 대응하는 정적 경로**는 rewrite 보다
 *   먼저 처리되어 실제로 운영에서 동작하고 있다. 그래서 프런트는
 *     GET  /api/inverse-trader?action=status
 *     POST /api/inverse-trader?action=start
 *   형태로 이 파일을 호출한다. 처리 로직은 [action].ts 하나뿐이며 여기서는 재수출만 한다.
 */

import handler from './[action].js';

export default handler;
