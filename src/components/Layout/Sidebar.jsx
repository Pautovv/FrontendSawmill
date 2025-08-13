import { ChevronDown, LogOut, Factory } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { menuItems } from "./data/menuItems";

export default function Sidebar({ collapsed, user, onLogout }) {
  const location = useLocation();
  const [expanded, setExpanded] = useState(new Set(["users"]));

  const toggleExpand = (id) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const isActive = (id) =>
    location.pathname === `/${id}` || (id === "dashboard" && location.pathname === "/");

  return (
    <aside
      className={`${
        collapsed ? "w-20" : "w-72"
      } transition-all duration-500 ease-in-out bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col shadow-sm`}
    >
      {/* Logo */}
      <div className="p-5 flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-inner">
          <Factory className="text-white w-5 h-5" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold text-black dark:text-white">Деревообработка</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Панель администратора</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.id);
          return (
            <div key={item.id} className="mb-1">
              {!item.submenu ? (
                <Link
                  to={item.id === "dashboard" ? "/" : `/${item.id}`}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-all relative group ${
                    active
                      ? "bg-black text-white shadow"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Icon className="w-5 h-5" />
                    {!collapsed && <span className="text-sm">{item.label}</span>}
                  </div>

                  {!collapsed && item.badge && (
                    <span className="text-[10px] font-semibold bg-black text-white rounded-full px-2 py-0.5">
                      {item.badge}
                    </span>
                  )}

                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-black rounded-r"></span>
                  )}
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <Icon className="w-5 h-5" />
                      {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                    </div>
                    {!collapsed && (
                      <ChevronDown
                        className={`w-4 h-4 transform transition-transform ${
                          expanded.has(item.id) ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </button>

                  {!collapsed && expanded.has(item.id) && (
                    <div className="ml-9 mt-1 space-y-1">
                      {item.submenu.map((sub) => (
                        <Link
                          key={sub.id}
                          to={`/${item.id}/${sub.id}`}
                          className={`block px-2 py-1.5 text-sm rounded-md transition-all ${
                            location.pathname === `/${item.id}/${sub.id}`
                              ? "bg-black text-white font-semibold shadow-inner"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white"
                          }`}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </nav>

      {/* Profile */}
      {!collapsed && (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center gap-3">
          <img
            src={user?.avatarUrl || "/src/assets/default-ava.jpg"}
            alt="User"
            className="w-10 h-10 rounded-full ring-2 ring-black dark:ring-white"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-black dark:text-white truncate">
              {user ? `${user.firstName} ${user.lastName}` : "Гость"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{user?.role || "-"}</p>
          </div>
          <button
            onClick={onLogout}
            className="text-zinc-400 hover:text-black dark:hover:text-white transition"
            title="Выйти"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
