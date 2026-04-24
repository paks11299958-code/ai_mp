import { GoogleGenAI, Chat } from '@google/genai';
import { MODEL_NAME } from '../constants';
import { Message } from '../types';

// Initialize the SDK. Assumes process.env.API_KEY is available in the environment.
let aiInstance: GoogleGenAI | null = null;

try {
    aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });
} catch (error) {
    console.error("Failed to initialize GoogleGenAI. Ensure API_KEY is set.", error);
}

export const getAIInstance = () => aiInstance;

export const createChatSession = (systemInstruction: string): Chat | null => {
    if (!aiInstance) return null;

    try {
        return aiInstance.chats.create({
            model: MODEL_NAME,
            config: { systemInstruction },
        });
    } catch (error) {
        console.error("Error creating chat session:", error);
        return null;
    }
};

export const generateSummary = async (messages: Message[]): Promise<string | null> => {
    if (!aiInstance || messages.length < 2) return null;

    // 최근 30개만 사용 (너무 긴 요약 방지)
    const recent = messages.slice(-30);
    const conversation = recent
        .map(m => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.text}`)
        .join('\n');

    const prompt = `다음은 사용자와 AI의 대화입니다. 핵심 내용, 사용자의 주요 관심사, 중요한 결정사항을 4~6문장으로 간결하게 요약하세요. 한국어로 작성하세요.\n\n[대화]\n${conversation}\n\n[요약]`;

    try {
        const chat = aiInstance.chats.create({ model: MODEL_NAME, config: {} });
        const stream = await chat.sendMessageStream({ message: prompt });
        let fullText = '';
        for await (const chunk of stream) {
            if (chunk.text) fullText += chunk.text;
        }
        console.log('[요약 생성 완료]', fullText.slice(0, 80) + '...');
        return fullText || null;
    } catch (error) {
        console.error('[요약 생성 실패]', error);
        return null;
    }
};
