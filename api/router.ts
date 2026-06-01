import type { VercelRequest, VercelResponse } from '@vercel/node';

// ai_mp/api 레거시 catch-all 핸들러.
// 과거 30여 개 도메인을 처리했으나 전부 shared-api(서버1)로 이전됨.
// vercel.json rewrites가 구체 경로를 모두 가로채므로 이 핸들러엔 도달하지 않는 게 정상.
// (매칭되지 않는 /api/* 요청에 대한 404 방어용으로만 유지)
export default async function handler(_req: VercelRequest, res: VercelResponse) {
    return res.status(404).json({ error: 'Not found' });
}
