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

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, personaName, personaImageUrl, newUi }) => {
    const isUser = message.role === 'user';

    if (newUi) {
        return (
            <div className={`flex w-full mb-5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

                    {/* Avatar */}
                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mt-1 overflow-hidden
                        ${isUser ? 'ml-3' : 'mr-3'}`}
                        style={isUser ? { background: 'linear-gradient(135deg, #C49A6C, #E48BB0, #8E6FB7)', boxShadow: '0 2px 8px rgba(142,111,183,0.4)' } : { background: '#F0E9DE' }}
                    >
                        {isUser ? (
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>나</span>
                        ) : personaImageUrl ? (
                            <img src={personaImageUrl} alt={personaName} className="w-full h-full object-cover object-top" />
                        ) : (
                            <Icon name="Bot" size={16} style={{ color: '#8E6FB7' }} />
                        )}
                    </div>

                    {/* Message Content */}
                    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                        <span className="text-xs mb-1 px-1" style={{ color: '#9089A1' }}>
                            {isUser ? '나' : personaName}
                        </span>

                        <div className={`relative px-4 py-3 new-ui-bubble-${isUser ? 'user' : 'ai'}
                            ${message.error ? 'border-red-400' : ''}
                        `}>
                            {message.error ? (
                                <div className="flex items-center text-red-500 text-sm">
                                    <Icon name="AlertCircle" size={16} className="mr-2" />
                                    {message.text}
                                </div>
                            ) : message.isStreaming && !message.text ? (
                                <div className="flex items-end gap-1.5 py-1 px-1 h-8">
                                    <span className="w-2.5 h-2.5 rounded-full animate-bounce [animation-delay:0ms]" style={{ background: '#8E6FB7' }}></span>
                                    <span className="w-2.5 h-2.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: '#B49AC9' }}></span>
                                    <span className="w-2.5 h-2.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: '#E48BB0' }}></span>
                                </div>
                            ) : (
                                <div className={`markdown-body text-sm md:text-base break-words ${isUser ? 'leading-relaxed' : 'leading-loose'}`}>
                                    <ReactMarkdown>{message.text}</ReactMarkdown>
                                    {message.isStreaming && (
                                        <span className="inline-block w-1.5 h-4 rounded-sm animate-pulse ml-0.5 align-middle" style={{ background: '#B49AC9' }}></span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 기존 다크 UI
    const userGradient = 'bg-gradient-to-br from-violet-600 to-purple-500';
    return (
        <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

                {/* Avatar */}
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

                {/* Message Content */}
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
