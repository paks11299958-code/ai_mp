import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { getTokenFromRequest, verifyToken } from './_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
    try { verifyToken(token); } catch { return res.status(401).json({ error: '유효하지 않은 토큰입니다.' }); }

    const { text } = req.body || {};
    if (!text || typeof text !== 'string') return res.status(400).json({ error: '텍스트가 필요합니다.' });
    if (text.length > 2000) return res.status(400).json({ error: '텍스트가 너무 깁니다.' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

    const client = new OpenAI({ apiKey });
    const mp3 = await client.audio.speech.create({
        model: 'tts-1',
        voice: 'nova',
        input: text,
        speed: 0.9,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
}
