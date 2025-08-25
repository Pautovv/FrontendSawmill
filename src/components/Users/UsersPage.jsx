import React, { useEffect, useState, useCallback, useRef } from 'react';

const BASE = 'http://localhost:3001';
const ROLE_OPTIONS = ['ADMIN', 'WAREHOUSE', 'SELLER', 'USER'];

const ROLE_LABEL = {
  ADMIN: 'Администратор',
  WAREHOUSE: 'Кладовщик',
  SELLER: 'Продавец',
  USER: 'Пользователь',
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [changed, setChanged] = useState({}); // id -> true подсветка
  const [pendingWarehouseUser, setPendingWarehouseUser] = useState(null); // userId
  const [pendingWarehouseSelect, setPendingWarehouseSelect] = useState(''); // склад для назначения
  const [assigning, setAssigning] = useState(false);

  const assignmentPopoverRef = useRef(null);

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError('');
    try {
      const qs = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : '';
      const res = await fetch(`${BASE}/users${qs}`, {
        headers,
        credentials: 'include',
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Ошибка загрузки пользователей');
      }
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      setError(e.message || 'Ошибка загрузки');
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [search, token]);

  const loadWarehouses = useCallback(async () => {
    setLoadingWarehouses(true);
    try {
      const res = await fetch(`${BASE}/warehouses`, {
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data);
      } else {
        setWarehouses([]);
      }
    } catch {
      setWarehouses([]);
    } finally {
      setLoadingWarehouses(false);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(loadUsers, 300); // debounce
    return () => clearTimeout(t);
  }, [loadUsers]);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  // Клик вне поповера — закрыть (если открыт)
  useEffect(() => {
    function onDocClick(e) {
      if (
        pendingWarehouseUser &&
        assignmentPopoverRef.current &&
        !assignmentPopoverRef.current.contains(e.target)
      ) {
        cancelWarehouseSelection();
      }
    }
    if (pendingWarehouseUser) {
      document.addEventListener('mousedown', onDocClick);
    }
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [pendingWarehouseUser]);

  function highlightUser(id) {
    setChanged((c) => ({ ...c, [id]: true }));
    setTimeout(() => {
      setChanged((c) => {
        const cp = { ...c };
        delete cp[id];
        return cp;
      });
    }, 1600);
  }

  async function patchRole(userId, body) {
    setSavingId(userId);
    setError('');
    const prev = users;
    // оптимистично (только для НЕ warehouse назначения)
    if (body.role && body.role !== 'WAREHOUSE') {
      setUsers((u) =>
        u.map((x) =>
          x.id === userId ? { ...x, role: body.role, responsibleWarehouses: body.role === 'WAREHOUSE' ? x.responsibleWarehouses : x.responsibleWarehouses } : x
        )
      );
    }
    try {
      const res = await fetch(`${BASE}/users/${userId}/role`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Ошибка сохранения');
      }
      // перезагрузим (точная консистентность и список складов)
      await Promise.all([loadUsers(), loadWarehouses()]);
      highlightUser(userId);
    } catch (e) {
      setError(e.message || 'Ошибка сохранения');
      setUsers(prev); // откат
    } finally {
      setSavingId(null);
    }
  }

  // Обработчик выбора роли в селекте
  function handleRoleSelect(user, newRole) {
    if (savingId) return;
    if (newRole === user.role) return;
    if (newRole === 'WAREHOUSE') {
      // Открываем поповер выбора склада
      setPendingWarehouseUser(user.id);
      setPendingWarehouseSelect('');
      return;
    }
    // Любая другая роль — простое обновление
    patchRole(user.id, { role: newRole });
  }

  async function confirmWarehouseAssignment() {
    if (!pendingWarehouseUser) return;
    if (!pendingWarehouseSelect) {
      setError('Выберите склад для кладовщика');
      return;
    }
    setAssigning(true);
    try {
      await patchRole(pendingWarehouseUser, {
        role: 'WAREHOUSE',
        warehouseId: Number(pendingWarehouseSelect),
      });
      setPendingWarehouseUser(null);
      setPendingWarehouseSelect('');
    } finally {
      setAssigning(false);
    }
  }

  function cancelWarehouseSelection() {
    setPendingWarehouseUser(null);
    setPendingWarehouseSelect('');
  }

  const loadingAny = loadingUsers || loadingWarehouses;

  return (
    <div className="p-6 relative">
      <div className="mb-6 flex flex-col lg:flex-row gap-4 lg:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Пользователи
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Управление ролями и ответственными за склады
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex gap-2">
          <button
            onClick={() => {
              loadUsers();
              loadWarehouses();
            }}
            className="px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-sm font-medium shadow hover:shadow-md transition"
          >
            ↻ Обновить
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск (имя / email / роль)"
            className="flex-1 px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-sm hover:bg-zinc-300 dark:hover:bg-zinc-600"
            >
              Сброс
            </button>
          )}
        </div>
        <div className="flex items-center text-xs text-zinc-500">
          {loadingAny && (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Обновление данных...
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-300 dark:border-red-700 bg-red-50/80 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur shadow-sm">
        <table className="w-full text-sm leading-relaxed">
          <thead>
            <tr className="text-zinc-600 dark:text-zinc-300 bg-zinc-100/60 dark:bg-zinc-800/70">
              <Th>ID</Th>
              <Th>Аватар</Th>
              <Th>ФИО</Th>
              <Th>Email</Th>
              <Th>Роль</Th>
              <Th>Склады (ответственность)</Th>
              <Th>Создан</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loadingUsers && users.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-10 text-center text-zinc-500 text-sm"
                >
                  Загрузка...
                </td>
              </tr>
            )}
            {!loadingUsers && users.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-10 text-center text-zinc-500 text-sm"
                >
                  Нет пользователей
                </td>
              </tr>
            )}

            {users.map((u, idx) => {
              const fullName =
                [u.lastName, u.firstName].filter(Boolean).join(' ') || '—';
              const highlight = !!changed[u.id];
              const isPending = pendingWarehouseUser === u.id;

              return (
                <tr
                  key={u.id}
                  className={`relative ${highlight
                      ? 'ring-1 ring-emerald-400'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    } transition-colors`}
                >
                  <Td>
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">
                      {u.id}
                    </span>
                  </Td>
                  <Td>
                    <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-zinc-300 dark:ring-zinc-600 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] text-zinc-600 dark:text-zinc-300">
                          —
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td className="min-w-[140px]">
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {fullName}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {u.firstName || u.lastName ? '' : '—'}
                      </span>
                    </div>
                  </Td>
                  <Td className="break-all">{u.email}</Td>
                  <Td>
                    <div className="flex items-center gap-2 flex-wrap max-w-[220px]">
                      <select
                        disabled={savingId === u.id || isPending}
                        value={u.role}
                        onChange={(e) => handleRoleSelect(u, e.target.value)}
                        className={`px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none ${savingId === u.id ? 'opacity-60 cursor-wait' : ''
                          }`}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <RoleBadge role={u.role} />
                    </div>
                  </Td>
                  <Td className="align-top">
                    {u.role === 'WAREHOUSE' && u.responsibleWarehouses?.length
                      ? (
                        <div className="flex flex-wrap gap-1">
                          {u.responsibleWarehouses.map((w) => (
                            <span
                              key={w.id}
                              className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-[11px] text-blue-700 dark:text-blue-300 font-medium"
                            >
                              {w.name}
                            </span>
                          ))}
                        </div>
                      )
                      : u.role === 'WAREHOUSE'
                        ? <span className="text-xs text-amber-600 dark:text-amber-400">Не назначен</span>
                        : <span className="text-xs text-zinc-400">—</span>}
                  </Td>
                  <Td>
                    <span className="text-xs text-zinc-500">
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString()
                        : '—'}
                    </span>
                  </Td>

                  {isPending && (
                    <WarehouseSelectPopover
                      ref={assignmentPopoverRef}
                      warehouses={warehouses}
                      loadingWarehouses={loadingWarehouses}
                      value={pendingWarehouseSelect}
                      onChange={setPendingWarehouseSelect}
                      onConfirm={confirmWarehouseAssignment}
                      onCancel={cancelWarehouseSelection}
                      assigning={assigning}
                      user={u}
                    />
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-3 text-[13px] text-zinc-600 dark:text-zinc-400 md:grid-cols-2 lg:grid-cols-4">
        <LegendCard
          title="ADMIN"
          desc="Полный доступ ко всем разделам, управление ролями."
        />
        <LegendCard
          title="WAREHOUSE"
          desc="Управление назначенными складами и их содержимым."
        />
        <LegendCard
          title="SELLER"
          desc="Просмотр склада, операции продаж (ограничено)."
        />
        <LegendCard
          title="USER"
          desc="Базовый доступ: просмотр ограниченной информации."
        />
      </div>
    </div>
  );
}

/* ---------- Reusable Components ---------- */

function Th({ children }) {
  return (
    <th className="px-4 py-3 text-left font-semibold text-xs tracking-wide uppercase">
      {children}
    </th>
  );
}
function Td({ children, className = '' }) {
  return (
    <td className={`px-4 py-3 align-middle ${className}`}>
      {children}
    </td>
  );
}

function RoleBadge({ role }) {
  const map = {
    ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    WAREHOUSE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    SELLER: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    USER: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${map[role] || map.USER}`}
    >
      {ROLE_LABEL[role] || role}
    </span>
  );
}

const WarehouseSelectPopover = React.forwardRef(
  (
    {
      warehouses,
      loadingWarehouses,
      value,
      onChange,
      onConfirm,
      onCancel,
      assigning,
      user,
    },
    ref
  ) => {
    return (
      <td
        ref={ref}
        colSpan={7}
        className="absolute left-0 top-full z-20 px-4 pt-2 pb-4"
      >
        <div className="w-full max-w-md rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-4 animate-fade-in">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-semibold text-sm mb-0.5">
                Назначение склада
              </h4>
              <p className="text-xs text-zinc-500">
                Пользователь: {user.email}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-sm"
              title="Отмена"
            >
              ✕
            </button>
          </div>

          <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
            Склад (обязательно)
          </label>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={loadingWarehouses || assigning}
            className="w-full mb-4 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
          >
            <option value="">-- выберите склад --</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              disabled={assigning}
              className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-sm hover:bg-zinc-300 dark:hover:bg-zinc-600 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={onConfirm}
              disabled={!value || assigning}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium shadow hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assigning ? 'Назначение...' : 'Назначить'}
            </button>
          </div>
        </div>
      </td>
    );
  }
);
WarehouseSelectPopover.displayName = 'WarehouseSelectPopover';

function LegendCard({ title, desc }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur px-4 py-3">
      <div className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm mb-1">
        {title}
      </div>
      <div className="text-xs leading-relaxed">{desc}</div>
    </div>
  );
}

/* ---------- Tailwind helper animation (если используешь) ----------
Добавь в global.css (если нужно):
@keyframes fade-in { from { opacity:0; transform:translateY(4px)} to { opacity:1; transform:translateY(0)} }
.animate-fade-in { animation: fade-in .18s ease-out; }
*/