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
            config: {
                systemInstruction: systemInstruction,
                // Optional: Add other configs here if needed, like temperature
            }
        });
    } catch (error) {
        console.error("Error creating chat session:", error);
        return null;
    }
};
