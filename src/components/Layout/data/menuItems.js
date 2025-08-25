import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Settings,
  BookCheck,
} from "lucide-react";

export const menuItems = [
  {
    id: "dashboard",
    label: "Панель",
    icon: LayoutDashboard,
    roles: ["ADMIN", "SELLER", "WAREHOUSE", "USER"],
  },
  {
    id: "inventory",
    label: "Склад",
    icon: Package,
    roles: ["ADMIN", "SELLER", "WAREHOUSE"],
  },
  {
    id: "tasks",
    label: "Задания",
    icon: BookCheck,
    roles: ["ADMIN", "SELLER", "WAREHOUSE"],
  },
  {
    id: "reports",
    label: "Отчеты",
    icon: FileText,
    roles: ["ADMIN"], 
  },
  {
    id: "users",
    label: "работники",
    icon: Users,
    roles: ["ADMIN"],
  },
];