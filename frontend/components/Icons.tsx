import React from 'react';
import { Bot, Code2, PenTool, Languages, Send, Menu, X, Trash2, AlertCircle, Settings, Save, Plus, ChevronUp, ChevronDown, Image as ImageIcon, Upload, LogOut, Brain, Play, Search, Lock, Zap, MessageSquare, Bell, Megaphone, Pin, Eye, EyeOff, Newspaper } from 'lucide-react';

interface IconProps {
    name: string;
    className?: string;
    size?: number;
}

export const Icon: React.FC<IconProps> = ({ name, className, size = 24 }) => {
    const icons: Record<string, React.ElementType> = {
        Bot,
        Code2,
        PenTool,
        Languages,
        Send,
        Menu,
        X,
        Trash2,
        AlertCircle,
        Settings,
        Save,
        Plus,
        ChevronUp,
        ChevronDown,
        ImageIcon,
        Upload,
        LogOut,
        Brain,
        Play,
        Search,
        Lock,
        Zap,
        MessageSquare,
        Bell,
        Megaphone,
        Pin,
        Eye,
        EyeOff,
        Newspaper,
    };

    const SelectedIcon = icons[name] || Bot;
    return <SelectedIcon className={className} size={size} />;
};
