import {
    LayoutDashboard, Users, Package,
    FileText, Settings, BookCheck
} from 'lucide-react';

export const menuItems = [
    {
        id: "dashboard",
        label: "Панель",
        icon: LayoutDashboard,
    },
    {
        id: "inventory",
        label: "Склад",
        icon: Package,
    },
    {
        id: "tasks",
        label: "Задания",
        icon: BookCheck,
    },
    {
        id: "reports",
        label: "Отчеты",
        icon: FileText,
    },
    {
        id: "settings",
        label: "Настройки",
        icon: Settings,
    },
];