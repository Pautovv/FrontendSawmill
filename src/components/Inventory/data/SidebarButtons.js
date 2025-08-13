import { Factory, Hammer, Cuboid, House, Pyramid } from "lucide-react";

export const sidebarButtons = [
  {
    id: "operation",
    label: "Добавить операцию",
    icon: Hammer,
    color: "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700",
  },
  {
    id: "profile",
    label: "Добавить профиль",
    icon: Cuboid,
    color: "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700",
  },
  {
    id: "raw",
    label: "Добавить предмет",
    icon: Pyramid,
    color: "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700",
  },
  {
    id: "passport",
    label: "Добавить паспорт",
    icon: House,
    color: "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700",
  },
];