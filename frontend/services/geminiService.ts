import { GoogleGenAI, Chat } from '@google/genai';
import { MODEL_NAME } from '../constants';

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

