import React from 'react';
import { Bot, Code2, PenTool, PenLine, Languages, Send, Menu, X, Trash2, AlertCircle, CheckCircle, Settings, Save, Plus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Image as ImageIcon, Upload, LogOut, Brain, Play, Search, Lock, Zap, MessageSquare, Bell, Megaphone, Pin, Eye, EyeOff, Newspaper, MoreVertical, ArrowLeftToLine, Handshake, UserCircle, TrendingUp, ShoppingBag, Shield, Activity, RefreshCw } from 'lucide-react';

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
        CheckCircle,
        Settings,
        Save,
        Plus,
        ChevronUp,
        ChevronDown,
        ChevronLeft,
        ChevronRight,
        ArrowLeftToLine,
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
        MoreVertical,
        Handshake,
        PenLine,
        UserCircle,
        TrendingUp,
        ShoppingBag,
        Shield,
        Activity,
        RefreshCw,
    };

    const SelectedIcon = icons[name] || Bot;
    return <SelectedIcon className={className} size={size} />;
};
