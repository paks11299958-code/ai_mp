export type Role = 'user' | 'model';

export interface Category {
    id: number;
    name: string;
    order: number;
    createdAt: string;
    _count?: { personas: number };
}

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
    jobTitle?: string;
    description: string;
    /** 공유 딥링크 안내 모달용 소개문(비면 description 폴백). 어드민에서 편집. */
    introText?: string;
    iconName: string;
    systemInstruction: string;
    identityPrompt?: string;
    colorClass: string;
    order?: number;
    imageUrl?: string;
    introVideoUrl?: string;
    starVideoUrl?: string;
    faceReadingBgUrl?: string;
    chatBgUrl?: string;
    quickMenuJson?: string;
    features?: string;  // 활성 기능 키 JSON 배열 문자열, 예: '["stock","hotkeyword"]'. 없으면 이름 기반 폴백
    isDefault?: boolean;
    isVisible?: boolean;
    adminOnly?: boolean;
    useGrounding?: boolean;
    categoryId?: number | null;
    category?: Category | null;
    createdAt?: string;
}

export interface UserMemory {
    id: number;
    userId: number;
    content: string;
    category?: string;
    similarity?: number;
    createdAt: string;
}

export interface PersonaImage {
    id: number;
    personaId: string;
    imageUrl: string;
    description?: string;
    isMain: boolean;
    order: number;
    requiredLevel: number;
    createdAt: string;
    _count?: { videos: number };
}

export interface PersonaVideo {
    id: number;
    imageId: number;
    videoUrl: string;
    title?: string;
    order: number;
    requiredLevel: number;
    createdAt: string;
}

export interface ConversationSummary {
    id: number;
    sessionId: number;
    summary: string;
    messageCount: number;
    updatedAt: string;
}

export interface ChatSessionState {
    messages: Message[];
    isTyping: boolean;
    dbSessionId?: number;
    hasMoreMessages?: boolean;
    oldestMessageId?: number;
    summary?: ConversationSummary | null;
    isSummarizing?: boolean;
}

export interface User {
    id: number;
    email?: string;
    phone?: string;
    username?: string;
    role: string;
    paidPoints: number;
    bonusPoints: number;
    personaXp: Record<string, number>;
    provider?: string;
}

export interface PointsInfo {
    balance: number;
    paidBalance: number;
    bonusBalance: number;
    cost: number;
    leveledUp: boolean;
    newStage: number;
    levelupBonus: number;
}

export interface DbSession {
    id: number;
    personaId: string;
    title: string;
    updatedAt: string;
    persona: Pick<Persona, 'id' | 'name' | 'iconName' | 'colorClass'>;
}

export interface TriggerVideo {
    id: number;
    personaId: string;
    videoUrl: string;
    title?: string;
    description?: string;
    keywords: string;
    tag?: string;
    order: number;
    createdAt: string;
}

export interface SwingAnalysisSection {
    name: string;
    score: number;
    comment: string;
    good: string[];
    improve: string[];
}

export interface SwingAnalysis {
    overallScore: number;
    overallComment: string;
    sections: SwingAnalysisSection[];
    topPriorities: string[];
    recommendedDrills: string[];
}

export interface UserSwingAnalysis {
    id: number;
    fileName?: string;
    title?: string;
    gender?: string;
    skillLevel?: string;
    createdAt: string;
    analysis: SwingAnalysis;
}

export interface BoardReply {
    id: number;
    postId: number;
    userId: number;
    isAdminReply: boolean;
    content: string;
    createdAt: string;
    user: { username?: string; email: string };
}

export interface Announcement {
    id: number;
    title: string;
    content: string;
    category: 'persona' | 'update' | 'news';
    isPinned: boolean;
    isVisible: boolean;
    personaId?: string | null;
    persona?: { id: string; name: string; introVideoUrl?: string | null; imageUrl?: string | null } | null;
    createdAt: string;
    updatedAt: string;
}

export interface BoardPost {
    id: number;
    userId: number;
    personaId: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    user: { username?: string; email: string };
    replies: BoardReply[];
    _count?: { replies: number };
}

export interface PartnerReply {
    id: number;
    postId: number;
    userId: number;
    isAdminReply: boolean;
    content: string;
    createdAt: string;
    user: { username?: string; email: string };
}

export interface PartnerPost {
    id: number;
    userId: number;
    title: string;
    content: string;
    contact?: string | null;
    createdAt: string;
    updatedAt: string;
    user: { username?: string; email: string };
    replies: PartnerReply[];
    _count?: { replies: number };
}
