import React from 'react';
import { Bot, Code2, PenTool, PenLine, Languages, Send, Menu, X, Trash2, AlertCircle, AlertTriangle, CheckCircle, Settings, Save, Plus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Image as ImageIcon, Upload, LogOut, Brain, Play, Search, Lock, Zap, MessageSquare, Bell, Megaphone, Pin, Eye, EyeOff, Newspaper, MoreVertical, ArrowLeftToLine, Handshake, UserCircle, TrendingUp, ShoppingBag, Shield, Activity, RefreshCw, Package, BookOpen, Server, Cpu, Clock, GitCommit, Home, Users, Compass, Globe, Wrench, Tag, Coins, BarChart2, MapPin } from 'lucide-react';

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
        AlertTriangle,
        Globe,
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
        Image: ImageIcon,
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
        Package,
        BookOpen,
        Server,
        Cpu,
        Clock,
        GitCommit,
        Home,
        Users,
        Compass,
        Wrench,
        Tag,
        Coins,
        BarChart2,
        MapPin,
    };

    const SelectedIcon = icons[name] || Bot;
    return <SelectedIcon className={className} size={size} />;
};
