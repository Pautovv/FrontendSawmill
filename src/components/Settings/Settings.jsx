import React, { useState } from "react";
import { Moon, Sun, Bell, User, Globe, Building } from "lucide-react";

export default function Settings() {
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState("ru");

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white px-8 py-10 transition-all duration-300">
      <h1 className="text-3xl font-bold mb-8">Настройки</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Профиль пользователя */}
        <div className="p-6 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Профиль</h2>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Имя пользователя"
              className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900"
            />
            <input
              type="email"
              placeholder="Email"
              className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900"
            />
            <input
              type="password"
              placeholder="Новый пароль"
              className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900"
            />
            <button className="px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-lg font-medium hover:opacity-80 transition">
              Сохранить изменения
            </button>
          </div>
        </div>

        {/* Тема сайта */}
        <div className="p-6 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            {darkMode ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
            <h2 className="text-xl font-semibold">Тема</h2>
          </div>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            Переключение между светлой и тёмной темой
          </p>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="px-6 py-3 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 transition"
          >
            {darkMode ? "Тёмная" : "Светлая"}
          </button>
        </div>

        {/* Уведомления */}
        <div className="p-6 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Уведомления</h2>
          </div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={notifications}
              onChange={(e) => setNotifications(e.target.checked)}
              className="w-5 h-5"
            />
            <span>Получать email-уведомления</span>
          </label>
        </div>

        {/* Язык */}
        <div className="p-6 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Язык интерфейса</h2>
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900"
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Данные предприятия */}
        <div className="p-6 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-lg lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <Building className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Данные предприятия</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Название компании"
              className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900"
            />
            <input
              type="text"
              placeholder="Адрес"
              className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900"
            />
          </div>
          <button className="mt-4 px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-lg font-medium hover:opacity-80 transition">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
