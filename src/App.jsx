import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Layout/Sidebar";
import Header from "./components/Layout/Header";
import MainPage from "./components/MainPage/MainPage";
import { Routes, Route } from "react-router-dom";
import InventoryTable from "./components/Inventory/Inventory";
import WarehousePage from "./components/Inventory/warehousepage";
// СТАРОЕ: import Tasks from "./components/Tasks/Tasks";
import TasksPage from "./components/Tasks/Tasks";          // НОВЫЙ универсальный
import Auth from "./components/Auth/Auth";
import Reports from "./components/Reports/Reports";
import UsersPage from "./components/Users/UsersPage";

const API_URL = "http://localhost:3001";

function App() {
  const [sideBarCollapsed, setSideBarCollapsed] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (token) => {
    const res = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Unauthorized");
    return res.json();
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const storedToken = localStorage.getItem("accessToken");
        const storedUser = localStorage.getItem("user");

        if (storedUser) {
          try { setUser(JSON.parse(storedUser)); } catch { /* ignore */ }
        }

        if (storedToken) {
          const me = await fetchMe(storedToken);
            // ожидается что /auth/me вернёт { id, role, firstName, lastName, ... }
          setUser(me);
          localStorage.setItem("user", JSON.stringify(me));
        } else {
          setUser(null);
        }
      } catch {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchMe]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
  };

  if (loading) return null;

  if (!user) {
    return (
      <Auth
        onLogin={(me) => {
          setUser(me);
          localStorage.setItem("user", JSON.stringify(me));
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-all duration-500">
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          collapsed={sideBarCollapsed}
          user={user}
          onLogout={handleLogout}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            user={user}
            onToggleSideBar={() => setSideBarCollapsed(!sideBarCollapsed)}
          />
          <main className="flex-1 overflow-y-auto bg-transparent">
            <div className="p-6 space-y-6">
              <Routes>
                <Route path="/" element={<MainPage />} />
                <Route path="/inventory" element={<WarehousePage />} />
                <Route path="/inventory/*" element={<InventoryTable />} />
                <Route
                  path="/tasks"
                  element={<TasksPage user={user} />}  // ПЕРЕДАЁМ user
                />
                <Route path="/reports" element={<Reports />} />
                <Route path="/users" element={<UsersPage />} />
                {/* можно добавить редирект для неизвестных */}
                {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;