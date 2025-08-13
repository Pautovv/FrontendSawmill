import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Layout/Sidebar";
import Header from "./components/Layout/Header";
import Dashboard from "./components/Dashboard/Dashboard";
import { Routes, Route } from "react-router-dom";
import Inventory from "./components/Inventory/Inventory";
import Tasks from "./components/Tasks/Tasks";
import Auth from "./components/Auth/Auth";
import Reports from "./components/Reports/Reports";
import Settings from "./components/Settings/Settings";
import ToolsStorage from "./components/Inventory/pages/ToolsStorage";
import MachineStorage from "./components/Inventory/pages/MachineStorage";
import LogStorage from "./components/Inventory/pages/LogStorage";
import BoardNaturalHumidyStorage from "./components/Inventory/pages/BoardNaturalHumidyStorage";
import DryLumberStorage from "./components/Inventory/pages/DryLumberStorage";
import PlanedProductsStorage from "./components/Inventory/pages/PlanedProductsStorage";
import PaintsVarnishesStorage from "./components/Inventory/pages/PaintsVarnishesStorage";
import FurnitureStorage from "./components/Inventory/pages/FurnitureStorage";

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
          try {
            setUser(JSON.parse(storedUser));
          } catch {}
        }

        if (storedToken) {
          const me = await fetchMe(storedToken);
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
                <Route path="/" element={<Dashboard />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/inventory/log_storage" element={<LogStorage />} />
                <Route path="/inventory/lumber_nathum_storage" element={<BoardNaturalHumidyStorage />} />
                <Route path="/inventory/dry_lumber_storage" element={<DryLumberStorage />} />
                <Route path="/inventory/planed_products_storage" element={<PlanedProductsStorage />} />
                <Route path="/inventory/paintsvarnishes_storage" element={<PaintsVarnishesStorage />} />
                <Route path="/inventory/furniture_storage" element={<FurnitureStorage />} />
                <Route path="/inventory/tools_storage" element={<ToolsStorage />} />
                <Route path="/inventory/machine_storage" element={<MachineStorage />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
