import React, { useState, useEffect } from "react";

export default function ModalProfile({ onClose }) {
  const [profileName, setProfileName] = useState("");
  const [operations, setOperations] = useState([]);
  const [selectedOperations, setSelectedOperations] = useState([]);

  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState(""); // "success" или "error"

  useEffect(() => {
    fetch("http://localhost:3001/operations")  
      .then(res => res.json())
      .then(data => setOperations(data))
      .catch(() => {
        setStatusMessage("Ошибка загрузки операций");
        setStatusType("error");
      });
  }, []);

  const handleMachineToggle = (id) => {
    setSelectedOperations((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    if (!profileName.trim()) {
      setStatusMessage("Введите название операции");
      setStatusType("error");
      return;
    }
    if (selectedOperations.length === 0) {
      setStatusMessage("Выберите хотя бы один станок");
      setStatusType("error");
      return;
    }
    fetch("http://localhost:3001/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: profileName, operationsIds: selectedOperations }),
    })
      .then(res => {
        if (!res.ok) throw new Error("Ошибка сохранения профиля");
        return res.json();
      })
      .then(() => {
        setStatusMessage("Профиль успешно сохранен");
        setStatusType("success");
        setTimeout(() => onClose(), 1000);
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
          Добавить профиль
        </h2>

        <input
          type="text"
          placeholder="Название операции"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          className="w-full mb-6 px-5 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black/30 transition"
        />

        <div className="mb-6">
          <p className="mb-3 font-semibold text-neutral-700 dark:text-neutral-300 text-sm">
            Выберите операции:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {operations.length === 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Загрузка операций...</p>
            )}
            {operations.map((operation) => {
              const isSelected = selectedOperations.includes(operation.id);
              return (
                <button
                  key={operation.id}
                  onClick={() => handleMachineToggle(operation.id)}
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
                  <span className="text-sm font-medium">{operation.name}</span>
                </button>
              );
            })}
          </div>
        </div>

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
          Сохранить профиль
        </button>
      </div>
    </div>
  );
}
