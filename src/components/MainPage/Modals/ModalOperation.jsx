import React, { useEffect, useMemo, useState } from "react";

export default function ModalOperation({ onClose }) {
  const [operationName, setOperationName] = useState("");
  const [machines, setMachines] = useState([]);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [saving, setSaving] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("");

  // Только поиск по названию
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadMachines = async () => {
      setLoadingMachines(true);
      setStatusMessage("");
      setStatusType("");
      try {
        const res = await fetch(
          "http://localhost:3001/items/by-category?categoryPath=" + encodeURIComponent("станки"),
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Не удалось загрузить список станков");
        const data = await res.json();
        setMachines(Array.isArray(data) ? data : []);
      } catch (e) {
        if (e.name === "AbortError") return;
        setStatusMessage(e?.message || "Ошибка загрузки станков");
        setStatusType("error");
      } finally {
        setLoadingMachines(false);
      }
    };
    loadMachines();

    return () => controller.abort();
  }, []);


  const filteredMachines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return machines;
    return machines.filter((m) => (m.name || "").toLowerCase().includes(q));
  }, [machines, searchQuery]);

  const handleMachineToggle = (id) => {
    setSelectedMachines((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!operationName.trim()) {
      setStatusMessage("Введите название операции");
      setStatusType("error");
      return;
    }

    setSaving(true);
    setStatusMessage("");
    setStatusType("");
    try {
      const res = await fetch("http://localhost:3001/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: operationName.trim(),
          machineIds: selectedMachines,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Ошибка сохранения операции");
      }
      await res.json();
      setStatusMessage("Операция успешно сохранена");
      setStatusType("success");
      setTimeout(() => onClose(), 1200);
    } catch (e) {
      setStatusMessage(e?.message || "Ошибка сохранения операции");
      setStatusType("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-500 hover:text-black dark:hover:text-white text-xl"
          aria-label="Закрыть"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-5 text-neutral-900 dark:text-white">
          Добавить операцию
        </h2>

        <div className="space-y-4 mb-6">
          <input
            type="text"
            placeholder="Название операции"
            value={operationName}
            onChange={(e) => setOperationName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-base text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black/20 transition"
          />

          {/* Поиск только по названию */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск станков по названию..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black/15"
              disabled={loadingMachines}
              aria-label="Поиск станков"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">🔎</span>
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                onClick={() => setSearchQuery("")}
                aria-label="Очистить поиск"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-medium text-neutral-800 dark:text-neutral-200 text-sm">
              Выберите станки
            </p>
            {selectedMachines.length > 0 && (
              <span className="text-xs text-neutral-500">
                выбрано: {selectedMachines.length}
              </span>
            )}
          </div>

          {loadingMachines ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Загрузка станков...</p>
          ) : filteredMachines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-5 text-center">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {searchQuery ? "Нет результатов по запросу" : "Станки не найдены"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredMachines.map((machine) => {
                const isSelected = selectedMachines.includes(machine.id);
                return (
                  <button
                    key={machine.id}
                    type="button"
                    disabled={saving}
                    onClick={() => handleMachineToggle(machine.id)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition
                      ${isSelected
                        ? "bg-black text-white border-black dark:bg-white dark:text-black"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border-neutral-300 dark:border-neutral-600"
                      }
                      hover:shadow-md active:scale-[0.98] disabled:opacity-60`}
                  >
                    <span
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs transition
                        ${isSelected
                          ? "border-white bg-white text-black dark:border-black dark:bg-black dark:text-white"
                          : "border-neutral-400 text-transparent"
                        }`}
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span className="text-sm font-medium">{machine.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {statusMessage && (
          <p
            className={`mb-4 text-center font-semibold ${statusType === "success"
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
              }`}
            role="status"
            aria-live="polite"
          >
            {statusMessage}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !operationName.trim()}
            className="flex-1 py-3.5 rounded-xl bg-black text-white font-semibold text-base hover:bg-neutral-800 transition shadow-lg disabled:opacity-60"
          >
            {saving ? "Сохранение..." : "Сохранить операцию"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="sm:w-36 py-3.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-semibold text-base text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition disabled:opacity-60"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}