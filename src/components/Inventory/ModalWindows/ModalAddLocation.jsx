import React, { useState } from "react";

export default function ModalMachine({ onClose }) {
  const [machineName, setMachineName] = useState("");

  const handleSave = () => {
    console.log("Сохраняем станок:", { machineName });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-500 hover:text-black dark:hover:text-white"
        >
          ✕
        </button>

        <h2 className="text-2xl font-semibold mb-6">Добавить станок</h2>

        <input
          type="text"
          placeholder="Название станка"
          value={machineName}
          onChange={(e) => setMachineName(e.target.value)}
          className="w-full mb-4 p-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-black dark:text-white"
        />

        <button
          onClick={handleSave}
          className="w-full bg-black text-white py-3 rounded-lg hover:bg-neutral-800 transition"
        >
          Сохранить станок
        </button>
      </div>
    </div>
  );
}
