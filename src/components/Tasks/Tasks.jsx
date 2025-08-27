import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
} from 'react';
import { createPortal } from 'react-dom';

/* =========================================================
   CONFIG
========================================================= */
const API = 'http://localhost:3001';
const ISSUE_ROLES = ['ADMIN'];                // кто может выдавать задания
const ASSIGNED_ONLY_ROLES = ['WAREHOUSE', 'SELLER'];
const USE_CREDENTIALS = false;

/* =========================================================
   HELPERS
========================================================= */
function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v && Array.isArray(v.data)) return v.data;
  if (v && Array.isArray(v.items)) return v.items;
  return [];
}
async function safeJson(r) {
  try { return await r.json(); } catch { return null; }
}
function decodeJwt(token) {
  if (!token) return null;
  try {
    const [, b] = token.split('.');
    return JSON.parse(atob(b.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}
function initialsOf(u) {
  return `${(u?.lastName?.[0] || '').toUpperCase()}${(u?.firstName?.[0] || '').toUpperCase()}` || 'U';
}
function cls(...parts) {
  return parts.filter(Boolean).join(' ');
}

/* =========================================================
   SIZE / METRICS
========================================================= */
const SIZE_SEP_RE = /x|×|\*|х/gi;
function num(val) {
  if (val == null) return NaN;
  return Number(String(val).replace(',', '.'));
}
function tokenToMeters(raw) {
  const s = String(raw).trim().toLowerCase();
  const n = num(s.replace(/[^\d.,-]/g, ''));
  if (!isFinite(n)) return NaN;
  if (s.includes('мм') || s.includes('mm')) return n / 1000;
  if (s.includes('см') || s.includes('cm')) return n / 100;
  if (s.endsWith('м') || s.endsWith('m')) return n;
  return n / 1000;
}
function parseSize(sizeStr) {
  if (!sizeStr) return null;
  const parts = sizeStr.split(SIZE_SEP_RE).map(p => p.trim()).filter(Boolean);
  if (parts.length === 2) {
    const d = tokenToMeters(parts[0]);
    const l = tokenToMeters(parts[1]);
    if (d > 0 && l > 0 && isFinite(d) && isFinite(l)) return { kind: 'LOG', d, l };
    return null;
  }
  if (parts.length === 3) {
    const h = tokenToMeters(parts[0]);
    const w = tokenToMeters(parts[1]);
    const l = tokenToMeters(parts[2]);
    if (h > 0 && w > 0 && l > 0 && isFinite(h) && isFinite(w) && isFinite(l)) return { kind: 'LUMBER', h, w, l };
    return null;
  }
  return null;
}
function round3(n) { if (n == null || !isFinite(n)) return null; return Number(n.toFixed(3)); }
function metricsFromSize(sizeStr) {
  const p = parseSize(sizeStr);
  if (!p) return null;
  if (p.kind === 'LOG') {
    const m3 = Math.PI * Math.pow(p.d / 2, 2) * p.l;
    const lm = p.l;
    const m2 = Math.PI * p.d * p.l;
    return { lm: round3(lm), m3: round3(m3), m2: round3(m2) };
  }
  if (p.kind === 'LUMBER') {
    const m3 = p.h * p.w * p.l;
    const lm = p.l;
    const m2 = p.w * p.l;
    return { lm: round3(lm), m3: round3(m3), m2: round3(m2) };
  }
  return null;
}
function extractField(item, keys) {
  if (!item?.fields) return null;
  const f = item.fields.find(ff => keys.includes(ff.key.toLowerCase()));
  return f?.value || null;
}
function buildDisplayName(item) {
  if (!item) return '';
  const breed = extractField(item, ['порода', 'breed']);
  const size = extractField(item, ['размер', 'size']);
  let name = item.name;
  if (breed) name += ' ' + breed;
  if (size) name += ' ' + size;
  return name.trim();
}

/* =========================================================
   UNREAD HOOK
========================================================= */
function useUnread(user) {
  const [unread, setUnread] = useState(0);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const refetch = useCallback(async () => {
    if (!user || !token) return;
    try {
      const r = await fetch(`${API}/tasks/my-unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const data = await safeJson(r);
      setUnread(data?.unread ?? 0);
    } catch { /* ignore */ }
  }, [token, user]);

  useEffect(() => { refetch(); }, [refetch]);
  return { unread, refetchUnread: refetch };
}

/* =========================================================
   ERROR BOUNDARY
========================================================= */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(err, info) {
    console.error('[Tasks ErrorBoundary]', err, info);
  }
  render() {
    if (this.state.error != null) {
      return (
        <div className="p-6">
          <div className="text-red-600 font-semibold mb-2">Произошла ошибка интерфейса</div>
            <pre className="text-xs whitespace-pre-wrap bg-red-50 p-3 rounded max-h-64 overflow-auto">
              {String(this.state.error?.message || this.state.error)}
            </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded bg-black text-white text-sm"
          >
            Перезагрузить страницу
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* =========================================================
   PORTAL ROOT
========================================================= */
function ensurePortalRoot() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById('tasks-modal-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tasks-modal-root';
    document.body.appendChild(el);
  }
  return el;
}

/* =========================================================
   ROOT Tasks
========================================================= */
export default function Tasks({ user: outerUser }) {
  return (
    <ErrorBoundary>
      <TasksInner user={outerUser} />
    </ErrorBoundary>
  );
}

function TasksInner({ user: outerUser }) {
  const [user, setUser] = useState(outerUser || null);
  const [userLoading, setUserLoading] = useState(!outerUser);
  const [userErr, setUserErr] = useState('');

  useEffect(() => {
    if (outerUser) return;
    let ignore = false;
    (async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) { setUserLoading(false); return; }
      const quick = decodeJwt(token);
      if (quick?.role && !ignore) {
        setUser(prev => prev || {
          id: quick.userId || quick.id || quick.sub,
          role: quick.role,
          firstName: quick.firstName || '',
          lastName: quick.lastName || '',
        });
      }
      try {
        setUserLoading(true);
        setUserErr('');
        const r = await fetch(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: USE_CREDENTIALS ? 'include' : 'same-origin',
        });
        if (!r.ok) throw new Error((await r.text()) || 'Не авторизован');
        const data = await safeJson(r);
        if (!ignore) setUser(data);
      } catch (e) {
        if (!ignore) setUserErr(e.message || 'Ошибка пользователя');
      } finally {
        if (!ignore) setUserLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [outerUser]);

  const role = user?.role;
  const { unread, refetchUnread } = useUnread(user);

  if (userLoading) return <LoadingSkeleton />;
  if (userErr && !user) return <ErrorState message={userErr} />;
  if (!role) return <div className="p-6 text-sm text-neutral-500">Нет роли.</div>;

  const canIssue = ISSUE_ROLES.includes(role);
  const assignedOnly = ASSIGNED_ONLY_ROLES.includes(role);

  if (!canIssue || assignedOnly) {
    return (
      <div className="relative">
        <DebugBanner role={role} mode="MY" />
        <MyAssignedTasksView
          user={user}
          unread={unread}
          onViewed={refetchUnread}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <DebugBanner role={role} mode="ISSUE" />
      <IssueTasksView user={user} />
    </div>
  );
}

/* =========================================================
   SIMPLE UI PARTIALS
========================================================= */
function LoadingSkeleton() {
  return (
    <div className="p-6 animate-pulse space-y-4">
      <div className="h-6 w-40 bg-neutral-200 dark:bg-neutral-800 rounded" />
      <div className="h-10 w-full max-w-md bg-neutral-200 dark:bg-neutral-800 rounded" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
        ))}
      </div>
      <div className="text-xs text-neutral-400">Загрузка…</div>
    </div>
  );
}
function ErrorState({ message }) {
  return (
    <div className="p-6">
      <div className="text-red-600 text-sm mb-3">{message}</div>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 rounded bg-black text-white text-sm"
      >
        Повторить
      </button>
    </div>
  );
}
function DebugBanner({ role, mode }) {
  return (
    <div className="sticky top-0 z-40 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-4 py-1 text-[11px] flex items-center gap-3">
      <span>Role: {role}</span>
      <span>UI Mode: {mode}</span>
      <span className="opacity-70">(/tasks)</span>
    </div>
  );
}

/* =========================================================
   ISSUE TASKS VIEW (ADMIN)
========================================================= */
function IssueTasksView({ user }) {
  const [search, setSearch] = useState('');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [selectedCardId, setSelectedCardId] = useState(null);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setErr('');
      setLoading(true);
      try {
        const token = localStorage.getItem('accessToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const url = `${API}/tasks/tech-cards?search=${encodeURIComponent(search)}`;
        const r = await fetch(url, {
          headers,
          credentials: USE_CREDENTIALS ? 'include' : 'same-origin',
        });
        if (!r.ok) throw new Error((await r.text()) || `Ошибка ${r.status}`);
        const data = await safeJson(r);
        if (!ignore) setCards(toArray(data));
      } catch (e) {
        if (!ignore) { setErr(e.message || 'Ошибка'); setCards([]); }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    const t = setTimeout(load, 300);
    return () => { ignore = true; clearTimeout(t); };
  }, [search]);

  return (
    <div className="p-6">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
        <div className="flex-1 min-w-[240px]">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск паспорта..."
            className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>
        <div className="text-xs text-neutral-500">Роль: {user.role}</div>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          {err}
        </div>
      )}
      {loading && !err && <div className="text-neutral-500">Загрузка…</div>}
      {!loading && !err && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map(c => (
            <div
              key={c.id}
              className="rounded-2xl border border-neutral-200 dark:border-neutral-700 p-5 bg-white dark:bg-neutral-900 shadow-sm hover:shadow-md transition"
            >
              <div className="font-semibold mb-1 line-clamp-2">{c.name}</div>
              <div className="text-sm text-neutral-500 mb-4">
                Шагов: {c._count?.steps ?? 0}
              </div>
              <button
                onClick={() => setSelectedCardId(c.id)}
                className="px-4 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition text-sm"
              >
                Выдать задание
              </button>
            </div>
          ))}
          {cards.length === 0 && (
            <div className="text-neutral-500">Ничего не найдено</div>
          )}
        </div>
      )}

      {selectedCardId && (
        <AssignTaskModal
          techCardId={selectedCardId}
          onClose={() => setSelectedCardId(null)}
          onSaved={() => setSelectedCardId(null)}
        />
      )}
    </div>
  );
}

/* =========================================================
   ASSIGN TASK MODAL (исходная логика сохранена)
========================================================= */
function AssignTaskModal({ techCardId, onClose, onSaved }) {
  const [card, setCard] = useState(null);
  const [users, setUsers] = useState([]);
  const [searchUser, setSearchUser] = useState('');
  const [taskName, setTaskName] = useState('');
  const [fields, setFields] = useState([{ key: '', value: '' }]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [usersError, setUsersError] = useState('');
  const [shortages, setShortages] = useState({});
  const [showShortagePanel, setShowShortagePanel] = useState(true);
  const lastFieldRef = useRef(null);
  const saveInFlightRef = useRef(false);

  const ALLOW_SAVE_WITH_SHORTAGES = false;

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    setUsersError('');
    setOk('');
    (async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const r = await fetch(`${API}/tasks/tech-cards/${techCardId}`, {
          headers,
          credentials: USE_CREDENTIALS ? 'include' : 'same-origin',
        });
        if (!r.ok) throw new Error((await r.text()) || `Ошибка ${r.status}`);
        const data = await safeJson(r);
        if (!ignore) {
          setCard(data);
          setAssignments(
            (data?.steps || []).map(s => ({
              stepId: s.id,
              plannedQuantity: 1,
              leadUserIds: [],
              memberUserIds: [],
            }))
          );
          setTaskName(`${data?.name || 'Задание'} — задание`);
        }
      } catch (e) {
        if (!ignore) setError(e.message || 'Ошибка загрузки техкарты');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    (async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const r = await fetch(`${API}/tasks/assignable-users`, {
          headers,
          credentials: USE_CREDENTIALS ? 'include' : 'same-origin',
        });
        if (!r.ok) throw new Error((await r.text()) || `Ошибка ${r.status}`);
        const data = await safeJson(r);
        if (!ignore) setUsers(toArray(data));
      } catch (e) {
        if (!ignore) { setUsersError(e.message || 'Ошибка пользователей'); setUsers([]); }
      } finally {
        if (!ignore) setLoadingUsers(false);
      }
    })();
    return () => { ignore = true; };
  }, [techCardId]);

  const safeAssignments =
    (card?.steps?.length || 0) === assignments.length
      ? assignments
      : (card?.steps || []).map(s => ({
        stepId: s.id,
        plannedQuantity: 1,
        leadUserIds: [],
        memberUserIds: [],
      }));

  useEffect(() => {
    if (!card) return;
    setShortages(computeShortages(card, safeAssignments));
  }, [card, safeAssignments]);

  const anyShortages = useMemo(
    () => Object.values(shortages).some(arr => arr.length > 0),
    [shortages]
  );

  const filteredUsers = useMemo(() => {
    const base = Array.isArray(users) ? users : [];
    const q = searchUser.trim().toLowerCase();
    if (!q) return base;
    return base.filter(u =>
      `${u.lastName || ''} ${u.firstName || ''} ${u.email || ''} ${u.role || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [users, searchUser]);

  const toggleUser = (stepIndex, t, id) => {
    setAssignments(prev => {
      const base = (card?.steps?.length || 0) === prev.length ? prev : safeAssignments;
      const copy = [...base];
      if (!copy[stepIndex]) return copy;
      const mainKey = t === 'lead' ? 'leadUserIds' : 'memberUserIds';
      const otherKey = t === 'lead' ? 'memberUserIds' : 'leadUserIds';
      const main = new Set(copy[stepIndex][mainKey]);
      const other = new Set(copy[stepIndex][otherKey]);
      if (main.has(id)) {
        main.delete(id);
      } else {
        other.delete(id);
        main.add(id);
      }
      copy[stepIndex] = {
        ...copy[stepIndex],
        [mainKey]: Array.from(main),
        [otherKey]: Array.from(other),
      };
      return copy;
    });
  };
  const updatePlannedQuantity = (i, val) => {
    setAssignments(prev => {
      const base = (card?.steps?.length || 0) === prev.length ? prev : safeAssignments;
      const copy = [...base];
      if (!copy[i]) return copy;
      const n = parseFloat(val);
      copy[i].plannedQuantity = isNaN(n) || n <= 0 ? 1 : Math.floor(n);
      return copy;
    });
  };
  const setField = (i, k, v) =>
    setFields(prev => {
      const c = [...prev];
      c[i] = { ...c[i], [k]: v };
      return c;
    });
  const addField = () =>
    setFields(prev => {
      const next = [...prev, { key: '', value: '' }];
      setTimeout(() => lastFieldRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
      return next;
    });
  const removeField = i => setFields(prev => prev.filter((_, idx) => idx !== i));

  const hasAssignments = safeAssignments.some(a => a.leadUserIds.length + a.memberUserIds.length > 0);
  const shortagesBlock = anyShortages && !ALLOW_SAVE_WITH_SHORTAGES;
  const nameValid = !!taskName.trim();
  const isSaveDisabled =
    saving || !!usersError || !hasAssignments || shortagesBlock || !nameValid || !card;

  const handleSave = async () => {
    if (isSaveDisabled) {
      if (!hasAssignments) setError('Назначьте хотя бы одного сотрудника.');
      if (shortagesBlock) setError('Есть дефициты материалов.');
      if (!nameValid) setError('Введите название задания.');
      return;
    }
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setError('');
    setOk('');
    setSaving(true);
    try {
      const payload = {
        techCardId: card.id,
        name: taskName.trim() || undefined,
        fields: fields.filter(f => f.key && f.value),
        assignments: safeAssignments.map(a => ({
          stepId: a.stepId,
          plannedQuantity: a.plannedQuantity ?? 1,
          leadUserIds: a.leadUserIds,
          memberUserIds: a.memberUserIds,
        })),
        preGeneratePdfs: true,
      };
      const token = localStorage.getItem('accessToken');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`${API}/tasks`, {
        method: 'POST',
        headers,
        credentials: USE_CREDENTIALS ? 'include' : 'same-origin',
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error((await r.text()) || 'Ошибка сохранения');
      const data = await safeJson(r);
      if (data?.printAllUrl) {
        window.open(`${API}${data.printAllUrl}`, '_blank', 'noopener');
      }
      setOk('Задание сохранено');
      setTimeout(() => onSaved?.(), 600);
    } catch (e) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
      saveInFlightRef.current = false;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-xl">
          Загрузка…
        </div>
      </div>
    );
  }
  if (!card) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-4">
          <div className="text-red-600 dark:text-red-400 text-sm">
            {error || 'Не удалось загрузить техкарту'}
          </div>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    );
  }

  const steps = card.steps || [];
  const disableUserActions = !!usersError || loadingUsers;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-6xl p-0 relative max-h-[92vh] flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Выдача задания: {card.name}</h2>
              <p className="text-sm text-neutral-500">
                Шагов: {steps.length}
                {card.item ? ` • Изделие: ${card.item.name}` : ''}
              </p>
            </div>
            <button
              onClick={() => !saving && onClose()}
              className="text-2xl leading-none hover:opacity-70"
              title="Закрыть"
            >
              ✕
            </button>
          </div>
        </div>

        {(error || usersError || shortagesBlock || !hasAssignments || !nameValid || ok) && (
          <div className="px-6 pt-3 pb-2 border-b border-neutral-200 dark:border-neutral-800 space-y-2 bg-neutral-50 dark:bg-neutral-800/40 text-xs">
            {ok && <div className="text-emerald-600 dark:text-emerald-400">{ok}</div>}
            {error && <div className="text-red-600 dark:text-red-400">Ошибка: {error}</div>}
            {usersError && <div className="text-red-600 dark:text-red-400">Пользователи: {usersError}</div>}
            {shortagesBlock && <div className="text-red-600 dark:text-red-400">Дефициты — сохранение запрещено</div>}
            {!hasAssignments && <div className="text-amber-600 dark:text-amber-400">Нужно назначить хотя бы одного пользователя</div>}
            {!nameValid && <div className="text-amber-600 dark:text-amber-400">Введите название</div>}
          </div>
        )}

        <div className="px-6 py-4 overflow-y-auto space-y-8">
          <label className="block">
            <span className="text-sm text-neutral-500">Название задания</span>
            <input
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              disabled={saving}
              className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </label>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <input
                value={searchUser}
                onChange={e => setSearchUser(e.target.value)}
                placeholder="Поиск сотрудника…"
                disabled={saving || loadingUsers}
                className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 w-full max-w-lg outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
              <span className="text-xs text-neutral-500">
                {loadingUsers ? 'Загрузка...' : usersError ? 'Ошибка' : `Всего: ${users.length}`}
              </span>
            </div>
          </div>

          <div className="space-y-7">
            {steps.map((s, i) => {
              const assign = safeAssignments[i];
              const stepShortages = shortages[s.id] || [];
              const hasShort = stepShortages.length > 0;

              const leadSelected = assign.leadUserIds;
              const memberSelected = assign.memberUserIds;
              const leadAvailable = filteredUsers.filter(
                u => !memberSelected.includes(u.id)
              );
              const memberAvailable = filteredUsers.filter(
                u => !leadSelected.includes(u.id)
              );
              const selLead = users.filter(u => leadSelected.includes(u.id));
              const selMember = users.filter(u => memberSelected.includes(u.id));

              const materials = s.materials || [];

              return (
                <div
                  key={s.id}
                  className={cls(
                    'rounded-2xl border p-5 bg-white dark:bg-neutral-900 transition relative',
                    hasShort
                      ? 'border-red-300 dark:border-red-700 shadow-sm'
                      : 'border-neutral-200 dark:border-neutral-800'
                  )}
                >
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs">
                      Шаг {s.order}
                    </span>
                    <div className="font-medium">{s.name}</div>
                    <div className="flex items-center gap-1 text-xs ml-2">
                      <label className="flex items-center gap-1">
                        <span className="opacity-70">Повторы:</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={assign.plannedQuantity}
                          onChange={e => updatePlannedQuantity(i, e.target.value)}
                          disabled={saving}
                          className={cls(
                            'w-20 border rounded px-2 py-0.5 text-xs bg-white dark:bg-neutral-800',
                            hasShort
                              ? 'border-red-400 dark:border-red-600'
                              : 'border-neutral-300 dark:border-neutral-700'
                          )}
                        />
                      </label>
                    </div>
                    {s.operation && (
                      <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
                        Операция: {s.operation.name}
                      </span>
                    )}
                    {s.machine && (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">
                        Станок: {s.machine.name}
                      </span>
                    )}
                    {hasShort && (
                      <span className="px-2 py-0.5 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs font-medium">
                        Дефицит
                      </span>
                    )}
                  </div>

                  {materials.length ? (
                    <div className="mb-5 text-xs flex flex-col gap-2">
                      <div className="text-neutral-500">
                        Материалы (по 1 шт на повтор если множитель не указан):
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-[720px] text-[11px] border border-neutral-200 dark:border-neutral-700">
                          <thead>
                            <tr className="bg-neutral-100 dark:bg-neutral-800">
                              <th className="px-2 py-1 text-left">Материал</th>
                              <th className="px-2 py-1 text-left">Размер</th>
                              <th className="px-2 py-1 text-right">На повтор</th>
                              <th className="px-2 py-1 text-right">Всего</th>
                              <th className="px-2 py-1 text-right">Пог.м</th>
                              <th className="px-2 py-1 text-right">м³</th>
                              <th className="px-2 py-1 text-right">м²</th>
                              <th className="px-2 py-1 text-right">Остаток</th>
                              <th className="px-2 py-1 text-right">Дефицит</th>
                            </tr>
                          </thead>
                          <tbody>
                            {materials.map(m => {
                              const perUnit = m.perUnit || m.quantityPerUnit || 1;
                              const total = perUnit * assign.plannedQuantity;
                              const available = m.Item?.quantity ?? 0;
                              const size = extractField(m.Item, ['размер', 'size']);
                              const met = metricsFromSize(size);
                              const lm = met?.lm != null ? round3(met.lm * total) : null;
                              const m3 = met?.m3 != null ? round3(met.m3 * total) : null;
                              const m2 = met?.m2 != null ? round3(met.m2 * total) : null;
                              const shortage = total > available;
                              const name = buildDisplayName(m.Item) || m.material?.name || m.displayName || 'Материал';

                              return (
                                <tr key={m.id} className={shortage ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                                  <td className="px-2 py-1">{name}</td>
                                  <td className="px-2 py-1">{size || '—'}</td>
                                  <td className="px-2 py-1 text-right">{perUnit}</td>
                                  <td className="px-2 py-1 text-right">{total}</td>
                                  <td className="px-2 py-1 text-right">{lm ?? '—'}</td>
                                  <td className="px-2 py-1 text-right">{m3 ?? '—'}</td>
                                  <td className="px-2 py-1 text-right">{m2 ?? '—'}</td>
                                  <td className="px-2 py-1 text-right">{available}</td>
                                  <td className="px-2 py-1 text-right">
                                    {shortage ? total - available : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-400 mb-5">
                      Материалы не указаны
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <UserRoleColumn
                      title="Главные"
                      usersSelected={selLead}
                      available={leadAvailable}
                      checkedIds={leadSelected}
                      onToggle={uid => !disableUserActions && toggleUser(i, 'lead', uid)}
                      formatUserName={u => `${u.lastName || ''} ${u.firstName || ''}`.trim() || u.email || `ID ${u.id}`}
                      initials={initialsOf}
                      roleLabel="lead"
                      disabled={saving || disableUserActions}
                    />
                    <UserRoleColumn
                      title="Остальные"
                      usersSelected={selMember}
                      available={memberAvailable}
                      checkedIds={memberSelected}
                      onToggle={uid => !disableUserActions && toggleUser(i, 'member', uid)}
                      formatUserName={u => `${u.lastName || ''} ${u.firstName || ''}`.trim() || u.email || `ID ${u.id}`}
                      initials={initialsOf}
                      roleLabel="member"
                      disabled={saving || disableUserActions}
                    />
                  </div>

                  {hasShort && (
                    <div className="mt-4 text-[11px] text-red-600 dark:text-red-400 space-y-1">
                      {stepShortages.map(sh => (
                        <div key={sh.materialId}>
                          • {sh.name}: требуется {sh.required}, доступно {sh.available} (не хватает {sh.required - sh.available})
                        </div>
                      ))}
                      <div>Снизьте «Повторы» или пополните остаток.</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <div className="mb-2 text-sm text-neutral-500">Произвольные поля задания</div>
            <div className="space-y-2">
              {fields.map((f, i) => {
                const isLast = i === fields.length - 1;
                return (
                  <div
                    key={i}
                    ref={isLast ? lastFieldRef : undefined}
                    className="flex gap-2 flex-wrap"
                  >
                    <input
                      placeholder="Ключ"
                      value={f.key}
                      disabled={saving}
                      onChange={e => setField(i, 'key', e.target.value)}
                      className="flex-1 min-w-[160px] px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                    <input
                      placeholder="Значение"
                      value={f.value}
                      disabled={saving}
                      onChange={e => setField(i, 'value', e.target.value)}
                      className="flex-1 min-w-[200px] px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                    <button
                      onClick={() => removeField(i)}
                      disabled={saving}
                      className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                      title="Удалить"
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={addField}
              disabled={saving}
              className="mt-3 text-sm text-blue-600 hover:underline disabled:opacity-50"
              type="button"
            >
              + Добавить поле
            </button>
          </div>
        </div>

        {anyShortages && showShortagePanel && (
          <div className="absolute left-4 right-4 bottom-24 md:bottom-24">
            <div className="rounded-2xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-4 text-xs flex flex-col gap-2 shadow">
              <div className="font-semibold text-red-700 dark:text-red-300">
                Есть дефициты — сохранение заблокировано.
              </div>
              <div className="flex flex-wrap gap-3">
                {Object.entries(shortages).map(([stepId, arr]) =>
                  arr.length > 0 && (
                    <div
                      key={stepId}
                      className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-red-200 dark:border-red-600"
                    >
                      Шаг {findStepOrder(card, Number(stepId))}: {arr.length} поз.
                    </div>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowShortagePanel(false)}
                className="self-end text-[10px] text-red-600 dark:text-red-300 hover:underline"
              >
                Скрыть
              </button>
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3 relative">
          <button
            onClick={() => !saving && onClose()}
            className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
            disabled={saving}
            type="button"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className={cls(
              'px-5 py-2.5 rounded-xl text-white dark:text-black disabled:opacity-60',
              shortagesBlock
                ? 'bg-red-500 dark:bg-red-500'
                : 'bg-black dark:bg-white'
            )}
            type="button"
          >
            {saving
              ? 'Сохранение…'
              : shortagesBlock
                ? 'Есть дефициты'
                : !hasAssignments
                  ? 'Назначьте сотрудников'
                  : !nameValid
                    ? 'Введите название'
                    : 'Сохранить'}
          </button>
        </div>

        {saving && (
          <div className="absolute inset-0 bg-black/20 dark:bg-black/40 flex items-center justify-center pointer-events-none">
            <div className="px-4 py-2 rounded-lg bg-white dark:bg-neutral-800 text-sm shadow">
              Отправка запроса…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Shortages computation */
function computeShortages(card, assignments) {
  const map = {};
  const steps = card?.steps || [];
  for (const step of steps) {
    const assign = assignments.find(a => a.stepId === step.id);
    const planned = assign?.plannedQuantity ?? 1;
    const materials = step.materials || [];
    for (const m of materials) {
      const perUnit = m.perUnit || m.quantityPerUnit || 1;
      const required = planned * perUnit;
      const available = (m.Item && (m.Item.quantity ?? 0)) ?? 0;
      if (required > available) {
        if (!map[step.id]) map[step.id] = [];
        map[step.id].push({
          materialId: m.id,
          name: m.material?.name || m.displayName || m.Item?.name || 'Материал',
          required,
          available,
        });
      }
    }
  }
  return map;
}
function findStepOrder(card, stepId) {
  const s = (card?.steps || []).find(x => x.id === stepId);
  return s?.order ?? '?';
}

/* =========================================================
   USER SELECT SUBCOMPONENTS
========================================================= */
function UserRoleColumn({
  title,
  usersSelected,
  available,
  checkedIds,
  onToggle,
  formatUserName,
  initials,
  roleLabel,
  disabled,
}) {
  const sel = usersSelected || [];
  const avail = available || [];
  const checked = checkedIds || [];
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        {sel.length > 0 && (
          <span className="text-xs text-neutral-500">выбрано: {sel.length}</span>
        )}
      </div>
      {sel.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {sel.map(u => (
            <UserChip
              key={`${roleLabel}-chip-${u.id}`}
              user={u}
              onRemove={() => onToggle(u.id)}
              tone={roleLabel === 'lead' ? 'lead' : 'member'}
              initials={initials(u)}
              disabled={disabled}
            >
              {formatUserName(u)}
            </UserChip>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-neutral-500">Никто не выбран</div>
      )}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {avail.map(u => {
          const isChecked = checked.includes(u.id);
          return (
            <UserSelectButton
              key={`${roleLabel}-${u.id}`}
              user={u}
              checked={isChecked}
              onClick={() => onToggle(u.id)}
              initials={initials(u)}
              disabled={disabled}
            >
              {formatUserName(u)} <span className="opacity-60 text-xs">({u.role})</span>
            </UserSelectButton>
          );
        })}
      </div>
    </div>
  );
}
function UserChip({ user, onRemove, tone = 'lead', children, initials, disabled }) {
  const toneStyles =
    tone === 'lead'
      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs border ${toneStyles}`}
      title={user.email}
    >
      <Avatar initials={initials} />
      {children}
      <button
        onClick={() => !disabled && onRemove()}
        className="ml-1 text-xs opacity-70 hover:opacity-100"
        aria-label="Удалить"
        disabled={disabled}
        type="button"
      >
        ✕
      </button>
    </span>
  );
}
function UserSelectButton({ user, checked, onClick, children, initials, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onClick()}
      disabled={disabled}
      className={cls(
        'flex items-center gap-3 p-3 rounded-xl border transition text-left text-xs',
        checked
          ? 'bg-black text-white border-black dark:bg-white dark:text-black'
          : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700',
        disabled && 'opacity-50'
      )}
    >
      <span
        className={cls(
          'w-5 h-5 rounded-md border-2 flex items-center justify-center text-[10px]',
          checked
            ? 'border-white bg-white text-black dark:border-black dark:bg-black dark:text-white'
            : 'border-neutral-400 text-transparent'
        )}
      >
        ✓
      </span>
      <Avatar initials={initials} />
      <div className="flex-1">{children}</div>
    </button>
  );
}
function Avatar({ initials }) {
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-700 text-xs font-semibold">
      {initials || '—'}
    </span>
  );
}

/* =========================================================
   MY ASSIGNED TASKS VIEW (with modal details)
========================================================= */
function MyAssignedTasksView({ user, unread, onViewed }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState('');
  const [savingStep, setSavingStep] = useState(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const isWarehouse = user.role === 'WAREHOUSE';
  const isSeller = user.role === 'SELLER';

  // FIX: ref to avoid state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // FIX: stable abort controller to avoid race causing removeChild
  const detailAbortRef = useRef(null);

  const recomputeProgress = task => {
    const done = task.mySteps.filter(s => s.hasResult || s.result || s.resultQuantity != null).length;
    return { done, total: task.mySteps.length };
  };

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true); setErr('');
      try {
        const r = await fetch(`${API}/tasks/my`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!r.ok) throw new Error((await r.text()) || 'Ошибка загрузки');
        const data = await safeJson(r);
        if (!ignore && mountedRef.current) setList((data || []).map(t => ({
          ...t,
          progress: t.progress || {
            done: t.mySteps.filter(s => s.hasResult).length,
            total: t.mySteps.length
          },
        })));
      } catch (e) {
        if (!ignore && mountedRef.current) { setErr(e.message || 'Ошибка'); setList([]); }
      } finally {
        if (!ignore && mountedRef.current) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [token]);

  const openTask = async id => {
    if (detailLoading && selectedTaskId === id) return;
    setSelectedTaskId(id);
    setDetail(null);
    setDetailErr('');
    setDetailLoading(true);

    // abort previous
    if (detailAbortRef.current) {
      try { detailAbortRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    detailAbortRef.current = controller;

    try {
      const r = await fetch(`${API}/tasks/my/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      if (!r.ok) throw new Error((await r.text()) || 'Ошибка детали');
      const data = await safeJson(r);
      if (mountedRef.current) setDetail(data);
      if (data?.document && data.document.status === 'NEW') {
        fetch(`${API}/tasks/documents/${data.document.id}/view`, {
          method: 'PATCH',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then(() => onViewed?.()).catch(() => {});
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      if (mountedRef.current) setDetailErr(e.message || 'Ошибка');
    } finally {
      if (mountedRef.current) setDetailLoading(false);
    }
  };

  const closeTaskModal = () => {
    setSelectedTaskId(null);
    setDetail(null);
    setDetailErr('');
  };

  // Scroll lock only when modal open
  useLayoutEffect(() => {
    if (selectedTaskId != null) {
      const prev = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      return () => { document.documentElement.style.overflow = prev; };
    }
  }, [selectedTaskId]);

  const applyStepResultLocally = (stepAssignmentId, result) => {
    setDetail(prev => {
      if (!prev) return prev;
      const newSteps = prev.mySteps.map(s =>
        s.stepAssignmentId === stepAssignmentId
          ? { ...s, result }
          : s
      );
      return { ...prev, mySteps: newSteps };
    });

    setList(prev => prev.map(t => {
      if (t.id !== (detail?.id)) return t;
      const newMySteps = t.mySteps.map(s =>
        s.stepAssignmentId === stepAssignmentId
          ? { ...s, hasResult: true, resultQuantity: result.quantity, resultNotes: result.notes }
          : s
      );
      return {
        ...t,
        mySteps: newMySteps,
        progress: recomputeProgress({ ...t, mySteps: newMySteps }),
      };
    }));
  };

  const submitStep = async (stepAssignmentId, form) => {
    setSavingStep(stepAssignmentId);
    try {
      const r = await fetch(`${API}/tasks/my/steps/${stepAssignmentId}/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.text()) || 'Ошибка сохранения');
      const data = await safeJson(r);
      applyStepResultLocally(stepAssignmentId, {
        quantity: data.result.quantity,
        notes: data.result.notes
      });
      onViewed?.();
    } catch (e) {
      alert(e.message || 'Ошибка');
    } finally {
      setSavingStep(null);
    }
  };

  const iconForMode = mode => {
    if (mode === 'ISSUE') return '📤';
    if (mode === 'RECEIVE') return '📥';
    return '📦';
  };

  // RENDER
  return (
    <div className="p-6 flex flex-col gap-6" key="assigned-root">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <h2 className="text-xl font-semibold">Мои задания</h2>
        <div className="text-xs text-neutral-500">
          Роль: {user.role} {unread > 0 && `• Новых: ${unread}`}
        </div>
      </div>
      {loading && <div className="text-sm text-neutral-500">Загрузка...</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}
      {!loading && !err && list.length === 0 && (
        <div className="text-sm text-neutral-500">Нет назначенных задач.</div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map(t => {
          const pct = t.progress.total
            ? Math.round((t.progress.done / t.progress.total) * 100)
            : 0;
          return (
            <div
              key={`task-card-${t.id}`}
              className={cls(
                'rounded-xl border p-4 cursor-pointer hover:shadow transition',
                selectedTaskId === t.id
                  ? 'border-black dark:border-white'
                  : 'border-neutral-200 dark:border-neutral-700',
                'bg-white dark:bg-neutral-900'
              )}
              onClick={() => openTask(t.id)}
            >
              <div className="font-medium line-clamp-2">{t.name}</div>
              <div className="mt-1 text-xs text-neutral-500">
                Прогресс: {t.progress.done}/{t.progress.total} ({pct}%)
              </div>
              <div className="mt-1 text-[11px] text-neutral-400">
                Создано: {new Date(t.createdAt).toLocaleDateString()}
              </div>
              <div className="mt-2 space-y-1">
                {t.mySteps.slice(0, 3).map(s => (
                  <div
                    key={`mini-step-${s.stepAssignmentId}`}
                    className="text-[11px] truncate flex items-center gap-1"
                  >
                    <span className="font-medium">Шаг {s.order}:</span>
                    <span className="truncate">{s.name}</span>
                    {s.hasResult || s.result
                      ? '✅'
                      : ((isWarehouse || isSeller) && s.inventoryMode && s.inventoryMode !== 'NONE'
                        ? iconForMode(s.inventoryMode)
                        : '')}
                  </div>
                ))}
                {t.mySteps.length > 3 && (
                  <div className="text-[11px] text-neutral-400">
                    +{t.mySteps.length - 3} ещё
                  </div>
                )}
              </div>
              <div className="mt-3 h-1.5 rounded bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                <div
                  className="h-full bg-black dark:bg-white transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {selectedTaskId != null && (
        <TaskDetailModal
          key={`modal-${selectedTaskId}`}
          loading={detailLoading}
          error={detailErr}
          detail={detail}
          onClose={closeTaskModal}
          savingStep={savingStep}
          submitStep={submitStep}
          userRole={user.role}
          isWarehouse={isWarehouse}
          isSeller={isSeller}
        />
      )}
    </div>
  );
}

/* =========================================================
   TASK DETAIL MODAL (portal)
========================================================= */
function TaskDetailModal({
  loading,
  error,
  detail,
  onClose,
  savingStep,
  submitStep,
  userRole,
  isWarehouse,
  isSeller,
}) {
  const portalRoot = ensurePortalRoot();
  const iconForMode = mode => {
    if (mode === 'ISSUE') return '📤';
    if (mode === 'RECEIVE') return '📥';
    return '📦';
  };
  if (!portalRoot) return null;

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/55"
        onClick={() => !savingStep && onClose()}
      />
      <div className="relative w-[min(1200px,95vw)] max-h-[92vh] flex flex-col bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="text-lg font-semibold">
            {loading ? 'Загрузка...' : error ? 'Ошибка' : `Задание: ${detail?.name || ''}`}
          </h3>
          <button
            onClick={() => !savingStep && onClose()}
            className="text-sm px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {loading && <div className="text-sm text-neutral-500">Загрузка…</div>}
          {error && !loading && (
            <div className="text-sm text-red-600">{error}</div>
          )}
          {!loading && !error && detail && (
            <div className="space-y-5">
              {detail.document && (
                <div className="text-xs px-3 py-1 rounded-full inline-block bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 mb-2">
                  Документ: {detail.document.status}
                </div>
              )}
              {detail.mySteps.map(s => {
                const issuing = savingStep === s.stepAssignmentId;
                const isDone = !!s.result;
                if ((isWarehouse || isSeller) && s.inventoryMode && s.inventoryMode !== 'NONE') {
                  return (
                    <InventoryStepCard
                      key={s.stepAssignmentId}
                      step={s}
                      role={userRole}
                      mode={s.inventoryMode}
                      disabled={issuing}
                      onSubmit={payload => submitStep(s.stepAssignmentId, payload)}
                    />
                  );
                }
                return (
                  <div
                    key={s.stepAssignmentId}
                    className={cls(
                      'rounded-xl border p-4 bg-white dark:bg-neutral-900',
                      isDone
                        ? 'border-emerald-300 dark:border-emerald-600'
                        : 'border-neutral-200 dark:border-neutral-700'
                    )}
                  >
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-xs">
                        Шаг {s.order}
                      </span>
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-neutral-500">
                        План: {s.plannedQuantity}
                      </span>
                      {!isDone && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700">
                          Выполнить
                        </span>
                      )}
                      {isDone && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Сдано
                        </span>
                      )}
                      {s.inventoryMode && s.inventoryMode !== 'NONE' && !isDone && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                          {iconForMode(s.inventoryMode)}
                        </span>
                      )}
                    </div>
                    {!isDone && (
                      <div className="mt-3">
                        <StepResultForm
                          disabled={issuing}
                          onSubmit={form => submitStep(s.stepAssignmentId, form)}
                        />
                      </div>
                    )}
                    {s.result && (
                      <div className="mt-3 text-xs text-neutral-600 dark:text-neutral-300 space-y-1">
                        <div>
                          Кол-во:{' '}
                          {s.result.quantity != null ? s.result.quantity : '—'}
                        </div>
                        {s.result.notes && (
                          <div>Примечание: {s.result.notes}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button
            onClick={() => !savingStep && onClose()}
            className="px-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, portalRoot);
}

/* =========================================================
   INVENTORY STEP CARD
========================================================= */
function InventoryStepCard({ step, role, mode, disabled, onSubmit }) {
  const [quantity, setQuantity] = useState(step.plannedQuantity);
  const [notes, setNotes] = useState('');
  const isDone = !!step.result;

  const actionVerb = (() => {
    if (mode === 'RECEIVE') return role === 'SELLER' ? 'Принять (возврат)' : 'Принять';
    if (mode === 'ISSUE') return role === 'SELLER' ? 'Продать' : 'Выдать';
    return 'Выполнить';
  })();

  const noun = inferNoun(step.name);
  const materials = step.materials || [];
  const getStock = m =>
    m?.Item?.quantity ?? m?.item?.quantity ?? (typeof m?.available === 'number' ? m.available : 0);

  const shortages = mode === 'ISSUE' && role !== 'SELLER'
    ? materials
      .map(m => {
        const perUnit = m.perUnit || m.quantityPerUnit || 1;
        const required = step.plannedQuantity * perUnit;
        const available = getStock(m);
        if (required > available) {
          return {
            id: m.id,
            name: m.name ||
              m.material?.name ||
              m.displayName ||
              m.Item?.name ||
              'Материал',
            required,
            available,
          };
        }
        return null;
      })
      .filter(Boolean)
    : [];

  const wrapperCls = (() => {
    if (isDone) return 'border-emerald-300 dark:border-emerald-600 bg-emerald-50/60 dark:bg-emerald-900/20';
    if (mode === 'RECEIVE') return 'border-teal-300 dark:border-teal-600 bg-teal-50 dark:bg-teal-900/10';
    if (mode === 'ISSUE' && shortages.length > 0) return 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/10';
    if (mode === 'ISSUE') return 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/10';
    return 'border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50';
  })();

  const autoNoteBase =
    mode === 'ISSUE'
      ? (role === 'SELLER' ? 'Продано' : 'Выдано')
      : mode === 'RECEIVE'
        ? (role === 'SELLER' ? 'Возврат принят' : 'Принято')
        : 'Выполнено';

  return (
    <div className={cls('rounded-xl border p-4 relative overflow-hidden', wrapperCls)}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="px-2 py-0.5 rounded bg-white/60 dark:bg-neutral-800/60 text-[11px] border border-neutral-300 dark:border-neutral-600">
          Шаг {step.order}
        </span>
        <span className="font-medium">{step.name}</span>
        {!isDone && mode === 'ISSUE' && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-200 text-amber-900 dark:bg-amber-600 dark:text-amber-50">
            {role === 'SELLER' ? 'Продажа' : 'Выдача'}
          </span>
        )}
        {!isDone && mode === 'RECEIVE' && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-teal-200 text-teal-900 dark:bg-teal-600 dark:text-teal-50">
            Приём
          </span>
        )}
        {isDone && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-200 text-emerald-800 dark:bg-emerald-600 dark:text-emerald-50">
            Завершено
          </span>
        )}
        {!isDone && shortages.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-red-200 text-red-900 dark:bg-red-600 dark:text-red-50">
            Дефицит
          </span>
        )}
      </div>

      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        {actionVerb} <strong>{step.plannedQuantity}</strong> {noun}.
      </p>

      {shortages.length > 0 && !isDone && (
        <div className="mt-3 text-[11px] text-red-700 dark:text-red-300 space-y-1">
          {shortages.map(s => (
            <div key={s.id}>
              • {s.name}: нужно {s.required}, есть {s.available} (не хватает {s.required - s.available})
            </div>
          ))}
          <div>Сообщите руководителю / скорректируйте.</div>
        </div>
      )}

      {isDone && (
        <div className="mt-3 text-xs text-neutral-600 dark:text-neutral-300 space-y-1">
          <div>Факт: {step.result.quantity != null ? step.result.quantity : '—'}</div>
          {step.result.notes && <div>Примечание: {step.result.notes}</div>}
        </div>
      )}

      {!isDone && (
        <form
          onSubmit={e => {
            e.preventDefault();
            const qNum = quantity === '' ? undefined : Number(quantity);
            onSubmit({
              quantity: qNum,
              notes: notes.trim() || `${autoNoteBase} ${qNum ?? step.plannedQuantity} ${noun}`,
            });
          }}
          className="mt-4 space-y-3"
        >
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                Сколько {actionVerb.toLowerCase()} (шт)
              </span>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                disabled={disabled}
                className="w-32 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
            </label>
            <label className="flex-1 flex flex-col gap-1 min-w-[200px]">
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                Примечание
              </span>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={disabled}
                placeholder={
                  mode === 'ISSUE'
                    ? role === 'SELLER'
                      ? 'Продано клиенту'
                      : 'Выдано со склада'
                    : role === 'SELLER'
                      ? 'Возврат'
                      : 'Принято на склад'
                }
                className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
            </label>
            <button
              type="submit"
              disabled={disabled}
              className={cls(
                'px-5 h-[42px] rounded-lg text-white text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition',
                mode === 'RECEIVE'
                  ? 'bg-teal-600 hover:bg-teal-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              )}
            >
              {disabled ? '...' : 'Отправить'}
            </button>
          </div>
          {mode === 'RECEIVE' && (
            <div className="text-[11px] text-neutral-500">
              Количество будет добавлено к остатку.
            </div>
          )}
          {mode === 'ISSUE' && shortages.length === 0 && (
            <div className="text-[11px] text-neutral-500">
              Остатка достаточно.
            </div>
          )}
        </form>
      )}
    </div>
  );
}

/* =========================================================
   STEP RESULT FORM
========================================================= */
function StepResultForm({ onSubmit, disabled }) {
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSubmit({
          quantity: quantity !== '' ? Number(quantity) : undefined,
          notes: notes.trim() || undefined,
        });
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex gap-2 flex-wrap">
        <input
          type="number"
          min="0"
          step="1"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          placeholder="Кол-во"
          disabled={disabled}
          className="w-28 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
        />
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Комментарий"
          disabled={disabled}
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
        />
        <button
          disabled={disabled}
          className="px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm font-medium disabled:opacity-50"
          type="submit"
        >
          Сдать
        </button>
      </div>
    </form>
  );
}

/* =========================================================
   NOUN HELPER
========================================================= */
function inferNoun(stepName = '') {
  const n = stepName.toLowerCase();
  if (n.includes('дос')) return 'досок';
  if (n.includes('панел')) return 'панелей';
  if (n.includes('лист')) return 'листов';
  if (n.includes('детал')) return 'деталей';
  return 'единиц';
}