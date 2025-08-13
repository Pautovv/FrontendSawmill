import React, { useState, useEffect } from "react";

export default function ModalOperation({ onClose }) {
  const [operationName, setOperationName] = useState("");
  const [machines, setMachines] = useState([]);
  const [selectedMachines, setSelectedMachines] = useState([]);

  // Добавим состояние для сообщения
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState(""); // "success" или "error"

  useEffect(() => {
    fetch("http://localhost:3001/inventory?category=MACHINES")  
      .then(res => res.json())
      .then(data => setMachines(data))
      .catch(() => {
        setStatusMessage("Ошибка загрузки станков");
        setStatusType("error");
      });
  }, []);

  const handleMachineToggle = (id) => {
    setSelectedMachines((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    if (!operationName.trim()) {
      setStatusMessage("Введите название операции");
      setStatusType("error");
      return;
    }
    if (selectedMachines.length === 0) {
      setStatusMessage("Выберите хотя бы один станок");
      setStatusType("error");
      return;
    }

    // Отправляем данные на backend
    fetch("http://localhost:3001/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: operationName, machineIds: selectedMachines }),
    })
      .then(res => {
        if (!res.ok) throw new Error("Ошибка сохранения операции");
        return res.json();
      })
      .then(() => {
        setStatusMessage("Операция успешно сохранена");
        setStatusType("success");
        // Можно автоматически закрыть окно через пару секунд, например:
        setTimeout(() => onClose(), 1500);
      })
      .catch(err => {
        setStatusMessage(err.message);
        setStatusType("error");
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-500 hover:text-black dark:hover:text-white text-xl"
        >
          ✕
        </button>

        <h2 className="text-3xl font-bold mb-6 text-neutral-800 dark:text-white">
          Добавить операцию
        </h2>

        <input
          type="text"
          placeholder="Название операции"
          value={operationName}
          onChange={(e) => setOperationName(e.target.value)}
          className="w-full mb-6 px-5 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black/30 transition"
        />

        <div className="mb-6">
          <p className="mb-3 font-semibold text-neutral-700 dark:text-neutral-300 text-sm">
            Выберите станки:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {machines.length === 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Загрузка станков...</p>
            )}
            {machines.map((machine) => {
              const isSelected = selectedMachines.includes(machine.id);
              return (
                <button
                  key={machine.id}
                  onClick={() => handleMachineToggle(machine.id)}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left
                    ${
                      isSelected
                        ? "bg-black text-white border-black dark:bg-white dark:text-black"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-white border-neutral-300 dark:border-neutral-600"
                    }
                    hover:shadow-lg active:scale-[0.98]`}
                >
                  <div
                    className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition ${
                      isSelected
                        ? "border-white bg-white dark:border-black dark:bg-black"
                        : "border-neutral-400"
                    }`}
                  >
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-black dark:bg-white"></div>
                    )}
                  </div>
                  <span className="text-sm font-medium">{machine.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Здесь показываем сообщение */}
        {statusMessage && (
          <p
            className={`mb-4 text-center font-semibold ${
              statusType === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {statusMessage}
          </p>
        )}

        <button
          onClick={handleSave}
          className="w-full mt-4 py-4 rounded-xl bg-black text-white font-semibold text-lg hover:bg-neutral-800 transition shadow-lg"
        >
          Сохранить операцию
        </button>
      </div>
    </div>
  );
}
