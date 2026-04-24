import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { Icon } from './Icons';

interface MessageBubbleProps {
    message: Message;
    personaName: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, personaName }) => {
    const isUser = message.role === 'user';

    return (
        <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                
                {/* Avatar */}
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mt-1 
                    ${isUser ? 'ml-3 bg-blue-600' : 'mr-3 bg-gray-700'}`}>
                    {isUser ? (
                        <span className="text-xs font-bold">나</span>
                    ) : (
                        <Icon name="Bot" size={16} className="text-gray-300" />
                    )}
                </div>

                {/* Message Content */}
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-gray-400 mb-1 px-1">
                        {isUser ? '나' : personaName}
                    </span>
                    
                    <div className={`relative px-4 py-3 rounded-2xl shadow-sm
                        ${isUser 
                            ? 'bg-blue-600 text-white rounded-tr-sm' 
                            : 'bg-gray-800 text-gray-100 rounded-tl-sm border border-gray-700'
                        }
                        ${message.error ? 'border-red-500 bg-red-900/20' : ''}
                    `}>
                        {message.error ? (
                            <div className="flex items-center text-red-400 text-sm">
                                <Icon name="AlertCircle" size={16} className="mr-2" />
                                {message.text}
                            </div>
                        ) : (
                            <div className="markdown-body text-sm md:text-base leading-relaxed break-words">
                                <ReactMarkdown>{message.text}</ReactMarkdown>
                            </div>
                        )}
                        
                        {/* Streaming indicator dot */}
                        {message.isStreaming && (
                            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse ml-2 mt-1 absolute bottom-3 right-3"></span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
