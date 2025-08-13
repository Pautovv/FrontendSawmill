import { ChevronDown, Menu, Search, Settings } from "lucide-react";
import React from "react";

function Header({ onToggleSideBar, user }) {
  return (
    <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Menu + Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSideBar}
            className="p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden md:block">
            <h1 className="text-xl font-black text-black dark:text-white tracking-tight">Панель</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Добро пожаловать, {user ? `${user.firstName} ${user.lastName}` : "Гость"}
            </p>
          </div>
        </div>

        {/* Center: Search */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по панели"
              className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-slate-800 text-sm border border-gray-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition"
            />
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-3">
          <button className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition">
            <Settings className="w-5 h-5" />
          </button>

          {/* Profile */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-slate-700">
            <img
              src={user?.avatarUrl || "/src/assets/default-ava.jpg"}
              alt="User"
              className="w-8 h-8 rounded-full ring-2 ring-black dark:ring-white object-cover"
            />
            <div className="hidden md:block">
              <p className="text-sm font-medium text-slate-700 dark:text-white">
                {user ? `${user.firstName} ${user.lastName}` : "Гость"}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{user?.role || "-"}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;
