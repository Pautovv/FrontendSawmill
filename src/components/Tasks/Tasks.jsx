import React, { useEffect, useMemo, useRef, useState } from 'react';

const API = 'http://localhost:3001';

export default function TasksPage() {
    const [search, setSearch] = useState('');
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedCardId, setSelectedCardId] = useState(null);

    useEffect(() => {
        let ignore = false;
        const load = async () => {
            setLoading(true);
            try {
                // оставляем рабочий эндпоинт, как у вас сейчас
                const res = await fetch(`${API}/tasks/tech-cards?search=${encodeURIComponent(search)}`);
                const data = await res.json();
                if (!ignore) setCards(data);
            } catch (e) {
                console.error(e);
            } finally {
                if (!ignore) setLoading(false);
            }
        };
        const t = setTimeout(load, 300);
        return () => {
            ignore = true;
            clearTimeout(t);
        };
    }, [search]);

    return (
        <div className="p-6">
            <div className="mb-5 flex items-center gap-2">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск паспорта по названию..."
                    className="w-full max-w-xl px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                />
            </div>

            {loading ? (
                <div className="text-neutral-500">Загрузка...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {cards.map((c) => (
                        <div
                            key={c.id}
                            className="rounded-2xl border border-neutral-200 dark:border-neutral-700 p-5 bg-white dark:bg-neutral-900 shadow-sm hover:shadow-md transition"
                        >
                            <div className="font-semibold mb-1">{c.name}</div>
                            <div className="text-sm text-neutral-500 mb-4">Шагов: {c._count?.steps ?? 0}</div>
                            <button
                                onClick={() => setSelectedCardId(c.id)}
                                className="px-4 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition"
                            >
                                Выдать задание
                            </button>
                        </div>
                    ))}
                    {cards.length === 0 && <div className="text-neutral-500">Ничего не найдено</div>}
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
    const [users, setUsers] = useState([]);
    const [searchUser, setSearchUser] = useState('');
    const [taskName, setTaskName] = useState('');
    const [fields, setFields] = useState([{ key: '', value: '' }]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [ok, setOk] = useState('');
    const lastFieldRef = useRef(null);

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const [cardRes, usersRes] = await Promise.all([
                    fetch(`${API}/tasks/tech-cards/${techCardId}`),
                    fetch(`${API}/users`),
                ]);
                const [cardData, usersData] = await Promise.all([cardRes.json(), usersRes.json()]);
                if (!ignore) {
                    setCard(cardData);
                    setUsers(usersData);
                    setAssignments(
                        (cardData.steps || []).map((s) => ({
                            stepId: s.id,
                            leadUserIds: [],
                            memberUserIds: [],
                        })),
                    );
                    setTaskName(`${cardData.name} — задание`);
                    setLoading(false);
                }
            } catch (e) {
                console.error(e);
                if (!ignore) setLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [techCardId]);

    const filteredUsers = useMemo(() => {
        const q = searchUser.trim().toLowerCase();
        if (!q) return users;
        return users.filter((u) =>
            `${u.lastName} ${u.firstName} ${u.email} ${u.role}`.toLowerCase().includes(q),
        );
    }, [users, searchUser]);

    const formatUserName = (u) => `${u.lastName} ${u.firstName}`;
    const initials = (u) => `${(u.lastName?.[0] ?? '').toUpperCase()}${(u.firstName?.[0] ?? '').toUpperCase()}`;

    const toggleUser = (stepIndex, type, userId) => {
        setAssignments((prev) => {
            const copy = [...prev];
            const targetKey = type === 'lead' ? 'leadUserIds' : 'memberUserIds';
            const otherKey = type === 'lead' ? 'memberUserIds' : 'leadUserIds';
            const target = new Set(copy[stepIndex][targetKey]);
            const other = new Set(copy[stepIndex][otherKey]);

            if (target.has(userId)) {
                target.delete(userId);
            } else {
                // убираем из другой роли и добавляем в текущую
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
        const copy = [...fields];
        copy[idx] = { ...copy[idx], [key]: value };
        setFields(copy);
    };

    const addField = () => {
        setFields((f) => {
            const next = [...f, { key: '', value: '' }];
            // подождём рендер и проскроллим к новому полю
            setTimeout(() => {
                lastFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 0);
            return next;
        });
    };

    const removeField = (idx) => setFields((f) => f.filter((_, i) => i !== idx));

    const handleSave = async () => {
        if (!card) return;
        setError('');
        setOk('');

        const anyAssigned = assignments.some((a) => (a.leadUserIds.length + a.memberUserIds.length) > 0);
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
                assignments,
                // Если у вас нет puppeteer на бэке и не нужны мгновенные PDF — отключите предгенерацию
                preGeneratePdfs: false,
            };
            const res = await fetch(`${API}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();

            // Автоматически открыть страницу печати всех документов задания
            if (data?.printAllUrl) {
                window.open(`${API}${data.printAllUrl}`, '_blank', 'noopener');
            }
            setOk('Задание успешно сохранено');
            // Закрыть модалку чуть позже
            setTimeout(() => onSaved?.(), 600);
        } catch (e) {
            console.error(e);
            setError(e?.message || 'Ошибка сохранения задания');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-xl">Загрузка…</div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-5xl p-0 relative max-h-[92vh] flex flex-col">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-semibold">Выдача задания: {card.name}</h2>
                            <p className="text-sm text-neutral-500">
                                Шагов: {card.steps?.length ?? 0}
                                {card.item ? ` • Изделие: ${card.item.name}` : ''}
                            </p>
                        </div>
                        <button onClick={onClose} className="text-2xl leading-none hover:opacity-70">✕</button>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-4 overflow-y-auto space-y-6">
                    {/* Task name */}
                    <label className="block">
                        <span className="text-sm text-neutral-500">Название задания</span>
                        <input
                            value={taskName}
                            onChange={(e) => setTaskName(e.target.value)}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                        />
                    </label>

                    {/* Users search */}
                    <div className="flex items-center gap-3">
                        <input
                            value={searchUser}
                            onChange={(e) => setSearchUser(e.target.value)}
                            placeholder="Поиск сотрудника…"
                            className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 w-full max-w-lg"
                        />
                        <span className="text-xs text-neutral-500">Всего сотрудников: {users.length}</span>
                    </div>

                    {/* Steps */}
                    <div className="space-y-5">
                        {card.steps.map((s, i) => {
                            const leadSelected = assignments[i].leadUserIds;
                            const memberSelected = assignments[i].memberUserIds;

                            const leadAvailableUsers = filteredUsers.filter((u) => !memberSelected.includes(u.id));
                            const memberAvailableUsers = filteredUsers.filter((u) => !leadSelected.includes(u.id));

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

                                    {/* Selected chips */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Leads */}
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm font-semibold">Главные</div>
                                                {selectedLeadUsers.length > 0 && (
                                                    <span className="text-xs text-neutral-500">выбрано: {selectedLeadUsers.length}</span>
                                                )}
                                            </div>

                                            {selectedLeadUsers.length > 0 ? (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {selectedLeadUsers.map((u) => (
                                                        <UserChip
                                                            key={`lead-chip-${s.id}-${u.id}`}
                                                            user={u}
                                                            onRemove={() => toggleUser(i, 'lead', u.id)}
                                                            tone="lead"
                                                            initials={initials(u)}
                                                        >
                                                            {formatUserName(u)}
                                                        </UserChip>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-xs text-neutral-500">Никто не выбран</div>
                                            )}

                                            {/* Available list */}
                                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {leadAvailableUsers.map((u) => {
                                                    const checked = leadSelected.includes(u.id);
                                                    return (
                                                        <UserSelectButton
                                                            key={`lead-${s.id}-${u.id}`}
                                                            user={u}
                                                            checked={checked}
                                                            onClick={() => toggleUser(i, 'lead', u.id)}
                                                            initials={initials(u)}
                                                        >
                                                            {formatUserName(u)} <span className="opacity-60 text-xs">({u.role})</span>
                                                        </UserSelectButton>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Members */}
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm font-semibold">Остальные</div>
                                                {selectedMemberUsers.length > 0 && (
                                                    <span className="text-xs text-neutral-500">выбрано: {selectedMemberUsers.length}</span>
                                                )}
                                            </div>

                                            {selectedMemberUsers.length > 0 ? (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {selectedMemberUsers.map((u) => (
                                                        <UserChip
                                                            key={`member-chip-${s.id}-${u.id}`}
                                                            user={u}
                                                            onRemove={() => toggleUser(i, 'member', u.id)}
                                                            tone="member"
                                                            initials={initials(u)}
                                                        >
                                                            {formatUserName(u)}
                                                        </UserChip>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-xs text-neutral-500">Никто не выбран</div>
                                            )}

                                            {/* Available list */}
                                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {memberAvailableUsers.map((u) => {
                                                    const checked = memberSelected.includes(u.id);
                                                    return (
                                                        <UserSelectButton
                                                            key={`member-${s.id}-${u.id}`}
                                                            user={u}
                                                            checked={checked}
                                                            onClick={() => toggleUser(i, 'member', u.id)}
                                                            initials={initials(u)}
                                                        >
                                                            {formatUserName(u)} <span className="opacity-60 text-xs">({u.role})</span>
                                                        </UserSelectButton>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Materials inline */}
                                    {s.materials?.length ? (
                                        <div className="mt-4 text-xs text-neutral-500">
                                            Материалы:{" "}
                                            {s.materials
                                                .map(
                                                    (m) =>
                                                        `${m.material.name} — ${m.quantity}${m.unit?.unit ? ' ' + m.unit.unit : ''}`,
                                                )
                                                .join(', ')}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>

                    {/* Custom fields */}
                    <div>
                        <div className="mb-2 text-sm text-neutral-500">Произвольные поля задания</div>
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
                                            onChange={(e) => setField(i, 'key', e.target.value)}
                                            className="flex-1 px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                        />
                                        <input
                                            placeholder="Значение"
                                            value={f.value}
                                            onChange={(e) => setField(i, 'value', e.target.value)}
                                            className="flex-1 px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                                        />
                                        <button
                                            onClick={() => removeField(i)}
                                            className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                            title="Удалить"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={addField} className="mt-3 text-sm text-blue-600 hover:underline">
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

                {/* Footer actions (sticky) */}
                <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-60"
                    >
                        {saving ? 'Сохранение…' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ---------- UI Subcomponents ---------- */

function UserChip({ user, onRemove, tone = 'lead', children, initials }) {
    const toneStyles =
        tone === 'lead'
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800';

    return (
        <span
            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-sm border ${toneStyles}`}
            title={user.email}
        >
            <Avatar initials={initials} />
            {children}
            <button
                onClick={onRemove}
                className="ml-1 text-xs opacity-70 hover:opacity-100"
                aria-label="Удалить"
                title="Удалить"
            >
                ✕
            </button>
        </span>
    );
}

function UserSelectButton({ user, checked, onClick, children, initials }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-3 p-3 rounded-xl border transition text-left ${checked
                ? 'bg-black text-white border-black dark:bg-white dark:text-black'
                : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
        >
            <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs ${checked ? 'border-white bg-white text-black dark:border-black dark:bg-black dark:text-white' : 'border-neutral-400 text-transparent'
                }`}>
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