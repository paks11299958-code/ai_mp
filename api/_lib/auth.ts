import jwt from 'jsonwebtoken';
import type { VercelRequest } from '@vercel/node';

const JWT_SECRET = process.env.JWT_SECRET!;

export function signToken(userId: number) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: number } {
  return jwt.verify(token, JWT_SECRET) as { userId: number };
}

export function getTokenFromRequest(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies.token || null;
}

function parseCookies(cookieStr: string): Record<string, string> {
  return Object.fromEntries(
    cookieStr.split(';')
      .filter(Boolean)
      .map(c => {
        const [k, ...v] = c.trim().split('=');
        return [k.trim(), v.join('=')];
      })
  );
}

export function setTokenCookie(token: string) {
  return `token=${token}; HttpOnly; Secure; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict`;
}

export function clearTokenCookie() {
  return `token=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=Strict`;
}
