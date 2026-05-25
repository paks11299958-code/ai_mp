import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

/**
 * 토큰 검증 후 userId 반환. 실패 시 401 응답 후 null 반환.
 * 호출 측에서 null 체크 후 즉시 return해야 함.
 *
 * if (userId === null) return;
 */
export function requireAuth(req: VercelRequest, res: VercelResponse): number | null {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return null;
  }
  try {
    const { userId } = verifyToken(token);
    return userId;
  } catch {
    res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    return null;
  }
}
