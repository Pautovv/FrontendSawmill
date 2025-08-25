import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001';

// ТОЛЬКО ДВА ТИПА
const TYPE_OPTIONS = [
    { value: 'MACHINE', label: 'Станок / оборудование' },
    { value: 'MATERIAL', label: 'Материал / сырьё' },
];

function ModalNomenclature({ defaultType = 'MATERIAL', onClose, onCreated }) {
    const [type, setType] = useState(defaultType);
    const [namesRaw, setNamesRaw] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [duplicates, setDuplicates] = useState([]);
    const [checking, setChecking] = useState(false);

    const parsedNames = namesRaw
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    const canSubmit = parsedNames.length > 0 && !loading;

    useEffect(() => {
        let ignore = false;
        setDuplicates([]);
        setChecking(false);
        if (parsedNames.length === 0) return;
        const q = parsedNames[0];
        if (!q) return;

        (async () => {
            try {
                setChecking(true);
                const r = await fetch(
                    `${API_BASE}/passport-nomenclature?type=${encodeURIComponent(type)}&search=${encodeURIComponent(q)}&limit=50`
                );
                if (!r.ok) return;
                const data = await r.json();
                if (ignore) return;
                const lowerSet = new Set(parsedNames.map(n => n.toLowerCase()));
                const dups = data.filter(rec => lowerSet.has(rec.name.toLowerCase()));
                setDuplicates(dups);
            } catch {
                /* ignore */
            } finally {
                if (!ignore) setChecking(false);
            }
        })();

        return () => { ignore = true; };
    }, [namesRaw, type, parsedNames]);

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setLoading(true);
        setErr('');
        setSuccessMsg('');
        try {
            const created = [];
            for (const name of parsedNames) {
                const r = await fetch(`${API_BASE}/passport-nomenclature`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, name, isActive }),
                });
                if (!r.ok) {
                    const txt = await r.text();
                    throw new Error(txt || `Ошибка создания: "${name}"`);
                }
                created.push(await r.json());
            }
            onCreated && onCreated(created);
            setSuccessMsg(
                created.length === 1
                    ? `Создано: ${created[0].name}`
                    : `Создано записей: ${created.length}`
            );
            setNamesRaw('');
            setDuplicates([]);
        } catch (e) {
            setErr(e.message || 'Ошибка');
        } finally {
            setLoading(false);
        }
    };

    const duplicateNames = duplicates.map(d => d.name.toLowerCase());
    const hasAnyDuplicate = parsedNames.some(n => duplicateNames.includes(n.toLowerCase()));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/50"
                onClick={() => !loading && onClose?.()}
            />
            <div
                className="relative w-[min(560px,95vw)] max-h-[90vh] overflow-auto rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-5 py-4 bg-white/90 dark:bg-neutral-900/90 backdrop-blur">
                    <h3 className="text-lg font-semibold">Добавить номенклатуру</h3>
                    <button
                        onClick={() => !loading && onClose?.()}
                        className="rounded-md px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                        ✕
                    </button>
                </div>

                <div className="px-5 py-5 space-y-5">
                    {err && (
                        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
                            {err}
                        </div>
                    )}
                    {successMsg && !err && (
                        <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-200">
                            {successMsg}
                        </div>
                    )}

                    <label className="flex flex-col gap-1">
                        <span className="text-sm text-neutral-600 dark:text-neutral-300">Тип</span>
                        <select
                            value={type}
                            disabled={loading}
                            onChange={e => setType(e.target.value)}
                            className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                        >
                            {TYPE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </label>

                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={isActive}
                                disabled={loading}
                                onChange={e => setIsActive(e.target.checked)}
                            />
                            Активно
                        </label>
                        <div className="text-xs text-neutral-500">
                            Неактивные не будут показаны в автокомплите.
                        </div>
                    </div>

                    <label className="flex flex-col gap-1">
                        <span className="text-sm text-neutral-600 dark:text-neutral-300">
                            Название / несколько (каждое с новой строки)
                        </span>
                        <textarea
                            rows={5}
                            placeholder="Например:\nФанера 12мм\nДоска обрезная\nСтанок ЧПУ 1"
                            disabled={loading}
                            value={namesRaw}
                            onChange={e => setNamesRaw(e.target.value)}
                            className="resize-y rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                        />
                    </label>

                    <div className="text-xs text-neutral-500 space-y-1">
                        <div>Будет создано: {parsedNames.length}</div>
                        {checking && <div className="text-neutral-400">Проверка дублей…</div>}
                        {hasAnyDuplicate && (
                            <div className="text-amber-600 dark:text-amber-400">
                                Совпадения: {duplicates.map(d => d.name).join(', ')}
                            </div>
                        )}
                    </div>
                </div>

                <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 border-t border-neutral-200 dark:border-neutral-800 px-5 py-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur">
                    <button
                        onClick={() => !loading && onClose?.()}
                        className="rounded-lg px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                        disabled={loading}
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="rounded-lg bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                    >
                        {loading ? 'Сохранение…' : 'Создать'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ModalNomenclature;