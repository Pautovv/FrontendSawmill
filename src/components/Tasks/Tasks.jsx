import React, { useEffect, useMemo, useRef, useState } from 'react';

const API = 'http://localhost:3001';

// Если нужна передача cookie с сессией (passport-session / cookie auth) -> true
const USE_CREDENTIALS = false; // поставь true если backend ждёт cookie

// Функция нормализации в массив
function toArray(val) {
    if (Array.isArray(val)) return val;
    if (val && Array.isArray(val.data)) return val.data;
    if (val && Array.isArray(val.items)) return val.items;
    return [];
}

// Универсально получить JSON без падения
async function safeJson(res) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

export default function TasksPage() {
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
                const url = `${API}/tasks/tech-cards?search=${encodeURIComponent(search)}`;
                const res = await fetch(url, {
                    credentials: USE_CREDENTIALS ? 'include' : 'same-origin',
                });
                if (!res.ok) {
                    const txt = await res.text().catch(() => '');
                    throw new Error(txt || `Ошибка загрузки (${res.status})`);
                }
                const data = await safeJson(res);
                if (!ignore) setCards(toArray(data));
            } catch (e) {
                console.error('[TasksPage] load error', e);
                if (!ignore) {
                    setErr(e.message || 'Ошибка загрузки');
                    setCards([]);
                }
            } finally {
                if (!ignore) setLoading(false);
            }
        };
        const t = setTimeout(load, 350); // debounce поиска
        return () => { ignore = true; clearTimeout(t); };
    }, [search]);

    return (
        <div className="p-6">
            <div className="mb-5 flex items-center gap-2">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск паспорта по названию..."
                    className="w-full max-w-xl px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
            </div>

            {err && (
                <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
                    {err}
                </div>
            )}

            {loading && !err && (
                <div className="text-neutral-500">Загрузка...</div>
            )}

            {!loading && !err && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {cards.map((c) => (
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

function AssignTaskModal({ techCardId, onClose, onSaved }) {
    const [card, setCard] = useState(null);
    const [users, setUsers] = useState([]); // всегда массив
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
    const lastFieldRef = useRef(null);

    // Загрузка карточки + пользователей параллельно
    useEffect(() => {
        let ignore = false;
        setLoading(true);
        setError('');
        setOk('');
        setUsersError('');
        setLoadingUsers(true);

        // 1. Tech card
        (async () => {
            try {
                const res = await fetch(`${API}/tasks/tech-cards/${techCardId}`, {
                    credentials: USE_CREDENTIALS ? 'include' : 'same-origin',
                });
                if (!res.ok) {
                    const txt = await res.text().catch(() => '');
                    throw new Error(txt || `Ошибка загрузки техкарты (${res.status})`);
                }
                const data = await safeJson(res);
                if (!ignore) {
                    setCard(data);
                    setAssignments(
                        (data?.steps || []).map((s) => ({
                            stepId: s.id,
                            leadUserIds: [],
                            memberUserIds: [],
                        }))
                    );
                    setTaskName(`${data?.name || 'Задание'} — задание`);
                }
            } catch (e) {
                console.error('[AssignTaskModal] card load error', e);
                if (!ignore) setError(e.message || 'Ошибка загрузки техкарты');
            } finally {
                if (!ignore) setLoading(false);
            }
        })();

        // 2. Users (отдельно, чтобы даже при ошибке пользователей модалка не полностью ломалась)
        (async () => {
            try {
                const token = localStorage.getItem('token'); // поменяй ключ если у тебя другой
                const headers = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const res = await fetch(`${API}/users`, {
                    headers,
                    credentials: USE_CREDENTIALS ? 'include' : 'same-origin',
                });

                if (res.status === 401) {
                    throw new Error('Не авторизовано (401). Выполни вход.');
                }
                if (!res.ok) {
                    const txt = await res.text().catch(() => '');
                    throw new Error(txt || `Ошибка загрузки пользователей (${res.status})`);
                }
                const raw = await safeJson(res);
                if (!ignore) {
                    setUsers(toArray(raw));
                }
            } catch (e) {
                console.error('[AssignTaskModal] users load error', e);
                if (!ignore) {
                    setUsersError(e.message || 'Ошибка загрузки пользователей');
                    setUsers([]); // пусто чтобы не падать
                }
            } finally {
                if (!ignore) setLoadingUsers(false);
            }
        })();

        return () => { ignore = true; };
    }, [techCardId]);

    // Если количество assignments не совпадает с шагами, создаём безопасный массив
    const safeAssignments =
        (card?.steps?.length || 0) === assignments.length
            ? assignments
            : (card?.steps || []).map((s) => ({
                stepId: s.id,
                leadUserIds: [],
                memberUserIds: [],
            }));

    // Фильтр пользователей
    const filteredUsers = useMemo(() => {
        const base = Array.isArray(users) ? users : [];
        const q = searchUser.trim().toLowerCase();
        if (!q) return base;
        return base.filter((u) =>
            `${u.lastName || ''} ${u.firstName || ''} ${u.email || ''} ${u.role || ''}`
                .toLowerCase()
                .includes(q),
        );
    }, [users, searchUser]);

    const formatUserName = (u) => `${u.lastName || ''} ${u.firstName || ''}`.trim();
    const initials = (u) =>
        `${(u.lastName?.[0] ?? '').toUpperCase()}${(u.firstName?.[0] ?? '').toUpperCase()}` || 'U';

    const toggleUser = (stepIndex, type, userId) => {
        setAssignments((prev) => {
            const base =
                (card?.steps?.length || 0) === prev.length ? prev : safeAssignments;
            const copy = [...base];
            if (!copy[stepIndex]) return copy;

            const targetKey = type === 'lead' ? 'leadUserIds' : 'memberUserIds';
            const otherKey = type === 'lead' ? 'memberUserIds' : 'leadUserIds';
            const target = new Set(copy[stepIndex][targetKey]);
            const other = new Set(copy[stepIndex][otherKey]);

            if (target.has(userId)) {
                target.delete(userId);
            } else {
                other.delete(userId);
                target.add(userId);
            }

            copy[stepIndex] = {
                ...copy[stepIndex],
                [targetKey]: Array.from(target),
                [otherKey]: Array.from(other),
            };
            return copy;
        });
    };

    const setField = (idx, key, value) => {
        setFields((prev) => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [key]: value };
            return copy;
        });
    };

    const addField = () => {
        setFields((f) => {
            const next = [...f, { key: '', value: '' }];
            setTimeout(() => {
                lastFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 0);
            return next;
        });
    };

    const removeField = (idx) => {
        setFields((f) => f.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        if (!card) return;
        setError('');
        setOk('');

        const anyAssigned = safeAssignments.some(
            (a) => (a.leadUserIds.length + a.memberUserIds.length) > 0
        );
        if (!anyAssigned) {
            setError('Назначьте хотя бы одного сотрудника хотя бы на один шаг');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                techCardId: card.id,
                name: taskName.trim() || undefined,
                fields: fields.filter((f) => f.key && f.value),
                assignments: safeAssignments,
                preGeneratePdfs: false,
            };
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API}/tasks`, {
                method: 'POST',
                headers,
                credentials: USE_CREDENTIALS ? 'include' : 'same-origin',
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                let txt = '';
                try { txt = await res.text(); } catch { }
                throw new Error(txt || `Ошибка сохранения (${res.status})`);
            }
            const data = await safeJson(res);
            if (data?.printAllUrl) {
                window.open(`${API}${data.printAllUrl}`, '_blank', 'noopener');
            }
            setOk('Задание успешно сохранено');
            setTimeout(() => onSaved?.(), 650);
        } catch (e) {
            console.error('[AssignTaskModal] save error', e);
            setError(e.message || 'Ошибка сохранения задания');
        } finally {
            setSaving(false);
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

    const steps = Array.isArray(card.steps) ? card.steps : [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-5xl p-0 relative max-h-[92vh] flex flex-col">
                {/* Header */}
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

                {/* Body */}
                <div className="px-6 py-4 overflow-y-auto space-y-6">
                    <label className="block">
                        <span className="text-sm text-neutral-500">Название задания</span>
                        <input
                            value={taskName}
                            onChange={(e) => setTaskName(e.target.value)}
                            disabled={saving}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                        />
                    </label>

                    {/* Users search + статус загрузки / ошибки */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <input
                                value={searchUser}
                                onChange={(e) => setSearchUser(e.target.value)}
                                placeholder="Поиск сотрудника…"
                                disabled={saving || loadingUsers}
                                className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 w-full max-w-lg outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                            />
                            <span className="text-xs text-neutral-500">
                                {loadingUsers
                                    ? 'Загрузка пользователей...'
                                    : usersError
                                        ? 'Пользователи: ошибка'
                                        : `Всего: ${users.length}`}
                            </span>
                        </div>
                        {usersError && (
                            <div className="text-xs text-red-600 dark:text-red-400">
                                {usersError}
                            </div>
                        )}
                    </div>

                    {/* Steps */}
                    <div className="space-y-5">
                        {steps.map((s, i) => {
                            const assign = safeAssignments[i] || { leadUserIds: [], memberUserIds: [] };
                            const leadSelected = assign.leadUserIds;
                            const memberSelected = assign.memberUserIds;

                            // Если пользователей нет (ошибка 401), всё равно рендерим шаги — просто не даём выбирать
                            const baseUsers = filteredUsers;
                            const disableUserActions = !!usersError || loadingUsers;

                            const leadAvailableUsers = baseUsers.filter((u) => !memberSelected.includes(u.id));
                            const memberAvailableUsers = baseUsers.filter((u) => !leadSelected.includes(u.id));

                            const selectedLeadUsers = users.filter((u) => leadSelected.includes(u.id));
                            const selectedMemberUsers = users.filter((u) => memberSelected.includes(u.id));

                            return (
                                <div
                                    key={s.id}
                                    className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900"
                                >
                                    <div className="mb-3 flex flex-wrap items-center gap-2">
                                        <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs">
                                            Шаг {s.order}
                                        </span>
                                        <div className="font-medium">{s.name}</div>
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
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <UserRoleColumn
                                            title="Главные"
                                            usersSelected={selectedLeadUsers}
                                            available={leadAvailableUsers}
                                            checkedIds={leadSelected}
                                            onToggle={(uid) => !disableUserActions && toggleUser(i, 'lead', uid)}
                                            formatUserName={formatUserName}
                                            initials={initials}
                                            roleLabel="lead"
                                            disabled={saving || disableUserActions}
                                        />
                                        <UserRoleColumn
                                            title="Остальные"
                                            usersSelected={selectedMemberUsers}
                                            available={memberAvailableUsers}
                                            checkedIds={memberSelected}
                                            onToggle={(uid) => !disableUserActions && toggleUser(i, 'member', uid)}
                                            formatUserName={formatUserName}
                                            initials={initials}
                                            roleLabel="member"
                                            disabled={saving || disableUserActions}
                                        />
                                    </div>

                                    {s.materials?.length ? (
                                        <div className="mt-4 text-xs text-neutral-500">
                                            Материалы:{' '}
                                            {s.materials
                                                .map((m) => {
                                                    const nm =
                                                        m.material?.name ||
                                                        m.Item?.name ||
                                                        m.nomenclature?.name ||
                                                        m.materialName ||
                                                        '—';
                                                    if (m.quantity != null) {
                                                        return `${nm} (${m.quantity}${m.unit?.unit ? ' ' + m.unit.unit : ''})`;
                                                    }
                                                    return nm;
                                                })
                                                .join(', ')}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>

                    {/* Custom fields */}
                    <div>
                        <div className="mb-2 text-sm text-neutral-500">
                            Произвольные поля задания
                        </div>
                        <div className="space-y-2">
                            {fields.map((f, i) => {
                                const isLast = i === fields.length - 1;
                                return (
                                    <div
                                        key={i}
                                        ref={isLast ? lastFieldRef : undefined}
                                        className="flex gap-2 items-center"
                                    >
                                        <input
                                            placeholder="Ключ"
                                            value={f.key}
                                            disabled={saving}
                                            onChange={(e) => setField(i, 'key', e.target.value)}
                                            className="flex-1 px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                        />
                                        <input
                                            placeholder="Значение"
                                            value={f.value}
                                            disabled={saving}
                                            onChange={(e) => setField(i, 'value', e.target.value)}
                                            className="flex-1 px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                        />
                                        <button
                                            onClick={() => removeField(i)}
                                            disabled={saving}
                                            className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                                            title="Удалить"
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
                        >
                            + Добавить поле
                        </button>
                    </div>

                    {error && (
                        <div className="px-4 py-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            {error}
                        </div>
                    )}
                    {ok && (
                        <div className="px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            {ok}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
                    <button
                        onClick={() => !saving && onClose()}
                        className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                        disabled={saving}
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !!usersError} // если нет пользователей из-за 401 — блокируем сохранение
                        className="px-5 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-60"
                    >
                        {saving ? 'Сохранение…' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ---------- Подкомпоненты ---------- */

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
    const sel = Array.isArray(usersSelected) ? usersSelected : [];
    const avail = Array.isArray(available) ? available : [];
    const checked = Array.isArray(checkedIds) ? checkedIds : [];

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
                    {sel.map((u) => (
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
                {avail.map((u) => {
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
                            {formatUserName(u)}{' '}
                            <span className="opacity-60 text-xs">({u.role})</span>
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
            className={`flex items-center gap-3 p-3 rounded-xl border transition text-left text-xs ${checked
                    ? 'bg-black text-white border-black dark:bg-white dark:text-black'
                    : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                } disabled:opacity-50`}
        >
            <span
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-[10px] ${checked
                        ? 'border-white bg-white text-black dark:border-black dark:bg-black dark:text-white'
                        : 'border-neutral-400 text-transparent'
                    }`}
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