import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://localhost:3001';

export default function AutocompleteNomenclature({
    type,                 // 'TECH_CARD_NAME' | 'TECH_STEP_NAME' | 'MACHINE' | 'MATERIAL'
    value,                // текущее выбранное {id,name} или null
    onSelect,             // (obj|null) => void
    placeholder = '',
    disabled = false,
    allowClear = true,
    className = '',
    dropdownClassName = '',
    fetchLimit = 20,
}) {
    const [input, setInput] = useState(value?.name || '');
    const [list, setList] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [debounceTimer, setDebounceTimer] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        setInput(value?.name || '');
    }, [value?.id]);

    const runSearch = (q) => {
        if (!q) {
            setList([]);
            return;
        }
        setLoading(true);
        fetch(
            `${API_BASE}/passport-nomenclature?type=${encodeURIComponent(type)}&search=${encodeURIComponent(q)}&limit=${fetchLimit}`
        )
            .then(r => (r.ok ? r.json() : []))
            .then(data => setList(data || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    };

    const onChangeInput = (e) => {
        const val = e.target.value;
        setInput(val);
        if (value) onSelect(null); // сбрасываем выбранное если пользователь начал печатать
        setOpen(true);
        if (debounceTimer) clearTimeout(debounceTimer);
        const t = setTimeout(() => runSearch(val), 250);
        setDebounceTimer(t);
    };

    const handleSelect = (obj) => {
        onSelect(obj);
        setInput(obj.name);
        setOpen(false);
    };

    const handleClear = () => {
        setInput('');
        onSelect(null);
        setList([]);
        setOpen(false);
    };

    // Клик вне — закрыть
    useEffect(() => {
        const handler = (e) => {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(e.target)) setOpen(false);
        };
        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div className="flex items-center gap-1">
                <input
                    disabled={disabled}
                    className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    value={input}
                    onChange={onChangeInput}
                    onFocus={() => {
                        if (!disabled) setOpen(true);
                        if (input && !list.length) runSearch(input);
                    }}
                    placeholder={placeholder}
                />
                {allowClear && (input || value) && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="px-2 py-1 text-xs rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                        ×
                    </button>
                )}
            </div>
            {open && !disabled && (
                <div
                    className={`absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow text-sm ${dropdownClassName}`}
                >
                    {loading && (
                        <div className="px-3 py-2 text-neutral-500">
                            Загрузка…
                        </div>
                    )}
                    {!loading && !list.length && (
                        <div className="px-3 py-2 text-neutral-500">
                            Нет вариантов
                        </div>
                    )}
                    {!loading &&
                        list.map((n) => (
                            <div
                                key={n.id}
                                onMouseDown={() => handleSelect(n)}
                                className={`cursor-pointer px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 ${value?.id === n.id ? 'bg-neutral-100 dark:bg-neutral-700' : ''
                                    }`}
                            >
                                {n.name}
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
}