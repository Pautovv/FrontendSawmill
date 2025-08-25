import React, { useState } from "react";
import axios from "axios";

const API = "http://localhost:3001";

export default function ModalWarehouse({ onClose, onCreated }) {
    const [name, setName] = useState("");
    const [shelves, setShelves] = useState([{ id: 1, name: "" }]);
    const [loading, setLoading] = useState(false);

    function addShelf() {
        setShelves(prev => [...prev, { id: prev.length ? prev[prev.length - 1].id + 1 : 1, name: "" }]);
    }

    function changeShelf(id, value) {
        setShelves(prev => prev.map(s => s.id === id ? { ...s, name: value } : s));
    }

    function removeShelf(id) {
        setShelves(prev => prev.filter(s => s.id !== id));
    }

    function findDuplicate(arr) {
        const seen = new Set();
        for (const v of arr) {
            const low = v.toLowerCase();
            if (seen.has(low)) return v;
            seen.add(low);
        }
        return null;
    }

    async function save() {
        const nm = name.trim();
        if (!nm) {
            alert("Введите название склада");
            return;
        }
        const shelfNames = shelves
            .map(s => s.name.trim())
            .filter(v => v.length > 0);

        const dup = findDuplicate(shelfNames);
        if (dup) {
            alert(`Дублирующаяся полка: "${dup}"`);
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(`${API}/warehouses`, { name: nm });
            const warehouse = res.data;
            for (const shelfName of shelfNames) {
                await axios.post(`${API}/warehouses/${warehouse.id}/shelves`, { name: shelfName });
            }
            onCreated && onCreated(warehouse);
            onClose();
        } catch (e) {
            alert(e?.response?.data?.message || e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg p-6"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-4">
                    <h2 className="text-xl font-bold">Новый склад</h2>
                    <button
                        onClick={onClose}
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    >
                        ✕
                    </button>
                </div>

                <label className="block text-sm mb-1">Название склада *</label>
                <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Напр. Основной склад"
                    className="w-full mb-4 px-4 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800"
                />

                <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Полки (опционально)</div>
                    <button
                        onClick={addShelf}
                        className="text-blue-600 text-sm hover:underline"
                    >
                        + Полка
                    </button>
                </div>

                <div className="max-h-60 overflow-y-auto pr-1 mb-4 space-y-2">
                    {shelves.map((s, idx) => (
                        <div key={s.id} className="flex gap-2">
                            <input
                                value={s.name}
                                onChange={e => changeShelf(s.id, e.target.value)}
                                placeholder={`Полка ${idx + 1}`}
                                className="flex-1 px-3 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800"
                            />
                            <button
                                onClick={() => removeShelf(s.id)}
                                disabled={shelves.length === 1}
                                className={`px-3 py-2 rounded-lg border dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 ${shelves.length === 1 ? "opacity-40 cursor-not-allowed" : ""
                                    }`}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-neutral-700"
                        disabled={loading}
                    >
                        Отмена
                    </button>
                    <button
                        onClick={save}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60"
                    >
                        {loading ? "Сохранение..." : "Сохранить"}
                    </button>
                </div>
            </div>
        </div>
    );
}