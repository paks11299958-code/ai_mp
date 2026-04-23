export type Role = 'user' | 'model';

export interface Message {
    id: string;
    role: Role;
    text: string;
    isStreaming?: boolean;
    error?: boolean;
}

export interface Persona {
    id: string;
    name: string;
    description: string;
    iconName: string;
    systemInstruction: string;
    colorClass: string;
    order?: number;
    imageUrl?: string;
    isDefault?: boolean;
}

export interface ChatSessionState {
    messages: Message[];
    isTyping: boolean;
    dbSessionId?: number;
}

export interface User {
    id: number;
    email: string;
    username?: string;
    role: string;
}

export interface DbSession {
    id: number;
    personaId: string;
    title: string;
    updatedAt: string;
    persona: Pick<Persona, 'id' | 'name' | 'iconName' | 'colorClass'>;
}
