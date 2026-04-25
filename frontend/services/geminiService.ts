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

export const generateImageDescription = async (base64Image: string): Promise<string | null> => {
    if (!aiInstance) return null;
    // base64Image는 "data:image/png;base64,..." 형식
    const mimeType = base64Image.split(';')[0].split(':')[1] || 'image/jpeg';
    const base64Data = base64Image.split(',')[1];

    try {
        const response = await aiInstance.models.generateContent({
            model: MODEL_NAME,
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: '이 이미지에 등장하는 인물의 모습을 한 문장으로 묘사해주세요. 복장, 자세, 배경, 표정을 포함해 구체적으로 설명하세요. "~모습입니다" 형식으로 끝내세요. 한국어로 작성하세요.' },
                ],
            }],
        });
        return response.text?.trim() || null;
    } catch (error) {
        console.error('[이미지 설명 생성 실패]', error);
        return null;
    }
};

export const extractMemories = async (userText: string, aiText: string): Promise<string[]> => {
    if (!aiInstance) return [];

    const content = aiText
        ? `사용자: ${userText}\nAI: ${aiText}`
        : `대화 요약: ${userText}`;

    const prompt = `다음 내용에서 사용자에 대한 장기 기억으로 저장할 중요한 사실을 추출하세요.
직업, 취미, 선호도, 목표, 가족, 거주지, 기술 스택 등 개인 정보만 추출하세요.
일반적인 대화 내용이나 질문은 제외하세요.
각 항목을 JSON 배열로 반환하세요. 추출할 내용이 없으면 빈 배열 []을 반환하세요.

${content}

반환 형식: ["사실1", "사실2"]`;

    try {
        const response = await aiInstance.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        const text = response.text?.trim() || '[]';
        const match = text.match(/\[[\s\S]*\]/);
        if (!match) return [];
        return JSON.parse(match[0]) as string[];
    } catch {
        return [];
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
