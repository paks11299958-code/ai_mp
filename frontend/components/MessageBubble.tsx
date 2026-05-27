import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { Icon } from './Icons';

interface MessageBubbleProps {
    message: Message;
    personaName: string;
    personaImageUrl?: string;
    newUi?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, personaName, personaImageUrl, newUi = false }) => {
    const isUser = message.role === 'user';

    // 뉴UI 스타일
    if (newUi) {
        return (
            <div className={`flex w-full mb-5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[82%] md:max-w-[72%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-2`}>

                    {/* 아바타 */}
                    <div className="flex-shrink-0 mt-1">
                        {isUser ? (
                            <div style={{
                                width: 34, height: 34, borderRadius: '50%',
                                background: 'linear-gradient(135deg, #8E6FB7, #E48BB0)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 700, color: '#fff',
                            }}>나</div>
                        ) : (
                            <div style={{
                                width: 34, height: 34, borderRadius: '50%',
                                overflow: 'hidden',
                                border: '1.5px solid #EAE2D3',
                                boxShadow: '0 2px 8px rgba(80,50,110,0.15)',
                                flexShrink: 0,
                            }}>
                                {personaImageUrl ? (
                                    <img src={personaImageUrl} alt={personaName}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                                ) : (
                                    <div style={{
                                        width: '100%', height: '100%',
                                        background: 'linear-gradient(135deg, #F5E6F7, #B49AC9)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 14, color: '#8E6FB7',
                                    }}>✦</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 버블 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 3 }}>
                        <span style={{ fontSize: 11, color: isUser ? '#9089A1' : '#8E6FB7', fontWeight: 600, paddingLeft: isUser ? 0 : 2 }}>
                            {isUser ? '나' : personaName}
                        </span>

                        <div style={{
                            padding: '11px 16px',
                            borderRadius: 18,
                            borderTopLeftRadius: isUser ? 18 : 5,
                            borderTopRightRadius: isUser ? 5 : 18,
                            fontSize: 14, lineHeight: 1.6,
                            ...(isUser ? {
                                background: 'linear-gradient(135deg, #8E6FB7, #B49AC9)',
                                color: '#ffffff',
                                boxShadow: '0 8px 20px -8px rgba(142,111,183,0.55)',
                            } : {
                                background: 'rgba(255,255,255,0.92)',
                                border: '1px solid #EAE2D3',
                                color: '#2D2438',
                                boxShadow: '0 4px 14px -6px rgba(60,40,90,0.1)',
                            }),
                            ...(message.error ? {
                                background: '#FDE8E8',
                                border: '1px solid #F4A4A4',
                                color: '#C0392B',
                            } : {}),
                        }}>
                            {message.error ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                                    <Icon name="AlertCircle" size={15} />
                                    {message.text}
                                </div>
                            ) : message.isStreaming && !message.text ? (
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, padding: '4px 2px', height: 24 }}>
                                    {[0, 150, 300].map(delay => (
                                        <span key={delay} style={{
                                            width: 7, height: 7, borderRadius: '50%',
                                            background: '#8E6FB7', opacity: 0.5,
                                            animation: `mpn-pulse 1.2s ease-in-out ${delay}ms infinite`,
                                            display: 'inline-block',
                                        }} />
                                    ))}
                                </div>
                            ) : (
                                <div className={`markdown-body text-sm md:text-base break-words ${isUser ? 'leading-relaxed' : 'leading-loose'}`}>
                                    <ReactMarkdown>{message.text}</ReactMarkdown>
                                    {message.isStreaming && (
                                        <span style={{
                                            display: 'inline-block', width: 6, height: 16,
                                            background: '#8E6FB7', borderRadius: 3,
                                            animation: 'mpn-pulse 0.8s ease-in-out infinite',
                                            marginLeft: 2, verticalAlign: 'middle',
                                        }} />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 올드UI 스타일 (기존 그대로)
    const userGradient = 'bg-gradient-to-br from-violet-600 to-purple-500';
    return (
        <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mt-1
                    ${isUser ? `ml-3 ${userGradient}` : 'mr-3 bg-gray-700'}`}>
                    {isUser ? (
                        <span className="text-xs font-bold text-white">나</span>
                    ) : personaImageUrl ? (
                        <img src={personaImageUrl} alt={personaName} className="w-full h-full object-cover object-top rounded-full" />
                    ) : (
                        <Icon name="Bot" size={16} className="text-gray-300" />
                    )}
                </div>
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-gray-400 mb-1 px-1">
                        {isUser ? '나' : personaName}
                    </span>
                    <div className={`relative px-4 py-3 shadow-sm
                        ${isUser
                            ? `${userGradient} text-white rounded-2xl rounded-tr-sm`
                            : 'bg-gray-800/90 text-gray-100 rounded-2xl rounded-tl-sm border border-gray-700/60'
                        }
                        ${message.error ? 'border-red-500 bg-red-900/20' : ''}
                    `}>
                        {message.error ? (
                            <div className="flex items-center text-red-400 text-sm">
                                <Icon name="AlertCircle" size={16} className="mr-2" />
                                {message.text}
                            </div>
                        ) : message.isStreaming && !message.text ? (
                            <div className="flex items-end gap-1.5 py-1 px-1 h-8">
                                <span className="w-3 h-3 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                                <span className="w-3 h-3 bg-purple-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                                <span className="w-3 h-3 bg-pink-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                            </div>
                        ) : (
                            <div className={`markdown-body text-sm md:text-base break-words ${isUser ? 'leading-relaxed' : 'leading-loose'}`}>
                                <ReactMarkdown>{message.text}</ReactMarkdown>
                                {message.isStreaming && (
                                    <span className="inline-block w-1.5 h-4 bg-gray-400 rounded-sm animate-pulse ml-0.5 align-middle"></span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
