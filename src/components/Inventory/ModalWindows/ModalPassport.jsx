import React, { useState, useEffect } from "react";

export default function ModalPassport({ onClose }) {
  const [productName, setProductName] = useState("");
  const [steps, setSteps] = useState([]);
  const [machines, setMachines] = useState([]);
  const [operations, setOperations] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [machinesRes, operationsRes, profilesRes, rawMaterialsRes] = await Promise.all([
          fetch("http://localhost:3001/inventory?category=MACHINES"),
          fetch("http://localhost:3001/operations"),
          fetch("http://localhost:3001/profiles"),
          fetch("http://localhost:3001/inventory"),
        ]);
        if (!machinesRes.ok || !operationsRes.ok || !profilesRes.ok || !rawMaterialsRes.ok) {
          throw new Error("Ошибка загрузки данных");
        }
        const [machinesData, operationsData, profilesData, rawMaterialsData] = await Promise.all([
          machinesRes.json(),
          operationsRes.json(),
          profilesRes.json(),
          rawMaterialsRes.json(),
        ]);
        setMachines(machinesData);
        setOperations(operationsData);
        setProfiles(profilesData);
        setRawMaterials(rawMaterialsData);
      } catch (err) {
        setError(err.message || "Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        id: Date.now(),
        machineId: "",
        operationId: "",
        profileId: "",
        rawMaterialId: "",
        repeats: 1,
      },
    ]);
  };

  const updateStep = (id, field, value) => {
    let val = value;
    if (["machineId", "operationId", "profileId", "rawMaterialId"].includes(field)) {
      val = value === "" ? "" : Number(value);
    } else if (field === "repeats") {
      val = Number(value) || 1;
    }
    setSteps((prev) =>
      prev.map((step) =>
        step.id === id ? { ...step, [field]: val } : step
      )
    );
  };

  const removeStep = (id) => {
    setSteps((prev) => prev.filter((step) => step.id !== id));
  };

  const handleSave = async () => {
    if (!productName.trim()) {
      alert("Введите название изделия");
      return;
    }
    if (steps.length === 0) {
      alert("Добавьте хотя бы один шаг");
      return;
    }
    for (const step of steps) {
      if (
        (step.machineId !== "" && typeof step.machineId !== "number") ||
        (step.operationId !== "" && typeof step.operationId !== "number") ||
        (step.profileId !== "" && typeof step.profileId !== "number") ||
        (step.rawMaterialId !== "" && typeof step.rawMaterialId !== "number") ||
        !(step.repeats > 0)
      ) {
        alert("Заполните все поля шагов корректно");
        return;
      }
    }

    const payload = {
      productName,
      steps: steps.map(({ machineId, operationId, profileId, rawMaterialId, repeats }) => ({
        machineId: machineId === "" ? undefined : machineId,
        operationId: operationId === "" ? undefined : operationId,
        profileId: profileId === "" ? undefined : profileId,
        rawMaterialId: rawMaterialId === "" ? undefined : rawMaterialId,
        repeats,
      })),
    };

    try {
      setLoading(true);
      setError("");
      const res = await fetch("http://localhost:3001/passports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Ошибка при сохранении");
      }
      alert("Паспорт продукта успешно сохранён!");
      onClose();
    } catch (err) {
      setError(err.message || "Ошибка при сохранении");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-4xl p-8 max-h-[90vh] overflow-y-auto relative">
          <p className="text-center text-lg text-neutral-800 dark:text-neutral-100">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-4xl p-8 max-h-[90vh] overflow-y-auto relative">
          <p className="text-center text-red-600">{error}</p>
          <button
            onClick={() => setError("")}
            className="mt-4 px-4 py-2 bg-black text-white rounded"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-4xl p-8 max-h-[90vh] overflow-y-auto relative animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-500 hover:text-black dark:hover:text-white text-2xl"
          aria-label="Закрыть модальное окно"
          disabled={loading}
        >
          ×
        </button>

        <h2 className="text-3xl font-bold mb-8 text-neutral-800 dark:text-neutral-100 tracking-tight">
          Новый паспорт продукта
        </h2>

        <div className="space-y-6">
          <input
            type="text"
            placeholder="Название изделия"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className="w-full px-5 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black/40 transition"
            disabled={loading}
          />

          <div className="space-y-6">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 space-y-4 shadow-sm"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-100">
                    Шаг {index + 1}
                  </h3>
                  <button
                    onClick={() => removeStep(step.id)}
                    className="text-sm text-red-500 hover:text-red-700 transition"
                    disabled={loading}
                  >
                    ✕ Удалить
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select
                    value={step.machineId}
                    onChange={(e) =>
                      updateStep(step.id, "machineId", e.target.value)
                    }
                    className="w-full px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-black dark:text-white"
                    disabled={loading}
                  >
                    <option value="">Выбрать станок</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={step.operationId}
                    onChange={(e) =>
                      updateStep(step.id, "operationId", e.target.value)
                    }
                    className="w-full px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-black dark:text-white"
                    disabled={loading}
                  >
                    <option value="">Выбрать операцию</option>
                    {operations.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={step.profileId}
                    onChange={(e) =>
                      updateStep(step.id, "profileId", e.target.value)
                    }
                    className="w-full px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-black dark:text-white"
                    disabled={loading}
                  >
                    <option value="">Выбрать профиль</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={step.rawMaterialId}
                    onChange={(e) =>
                      updateStep(step.id, "rawMaterialId", e.target.value)
                    }
                    className="w-full px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-black dark:text-white"
                    disabled={loading}
                  >
                    <option value="">Выбрать сырьё</option>
                    {rawMaterials.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    placeholder="Повторения"
                    min={1}
                    value={step.repeats}
                    onChange={(e) =>
                      updateStep(step.id, "repeats", e.target.value)
                    }
                    className="w-full px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-black dark:text-white"
                    disabled={loading}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <button
              onClick={addStep}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-neutral-200 to-neutral-300 dark:from-neutral-700 dark:to-neutral-600 hover:brightness-110  text-black dark:text-white font-medium shadow transition"
            >
              + Добавить шаг
            </button>
          </div>

          <button
            onClick={handleSave}
            className="w-full mt-4 py-4 rounded-xl bg-black text-white font-semibold text-lg hover:bg-neutral-800 transition shadow-lg"
          >
            Сохранить паспорт
          </button>
        </div>
      </div>
    </div>
  );
}