import { useState } from "react";

const API_URL = "http://localhost:3001";

export default function Auth({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "" });
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const fetchMe = async (token) => {
    const res = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Не удалось получить профиль");
    return res.json();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email || !form.password || (!isLoginMode && (!form.firstName || !form.lastName))) {
      setError("Заполните все поля");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/${isLoginMode ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isLoginMode
            ? { email: form.email, password: form.password }
            : {
              email: form.email,
              password: form.password,
              firstName: form.firstName,
              lastName: form.lastName,
            }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Ошибка авторизации");
        setLoading(false);
        return;
      }

      localStorage.setItem("accessToken", data.accessToken);
      if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);

      const me = await fetchMe(data.accessToken);

      localStorage.setItem("user", JSON.stringify(me));
      onLogin(me);
    } catch (err) {
      console.error(err);
      setError("Ошибка подключения к серверу");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 space-y-6">
        {/* Заголовок */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
            {isLoginMode ? "Вход" : "Регистрация"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isLoginMode ? "Введите email и пароль для входа" : "Заполните форму для создания аккаунта"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Имя и фамилия */}
          {!isLoginMode && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Имя</label>
                <input
                  type="text"
                  name="firstName"
                  placeholder="Иван"
                  value={form.firstName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Фамилия</label>
                <input
                  type="text"
                  name="lastName"
                  placeholder="Петров"
                  value={form.lastName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>

          {/* Пароль */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Пароль</label>
            <input
              type="password"
              name="password"
              placeholder="******"
              value={form.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>

          {/* Ошибка */}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {/* Кнопка */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-black text-white text-sm font-medium rounded-md transition-all hover:opacity-90 hover:shadow-md hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (isLoginMode ? "Вход..." : "Регистрация...") : (isLoginMode ? "Войти" : "Зарегистрироваться")}
          </button>
        </form>

        {/* Переключение режима */}
        <p className="text-sm text-center text-slate-600 dark:text-slate-400">
          {isLoginMode ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setError("");
            }}
            className="text-gray-500 hover:underline font-medium"
          >
            {isLoginMode ? "Зарегистрироваться" : "Войти"}
          </button>
        </p>
      </div>
    </div>
  );
}