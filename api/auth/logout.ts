import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearTokenCookie } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Set-Cookie', clearTokenCookie());
  return res.status(200).json({ message: '로그아웃 완료' });
}
