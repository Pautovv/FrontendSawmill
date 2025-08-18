import React, { useState, useEffect } from "react";

export default function ModalMachine({ onClose }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [inputUnit, setInputUnit] = useState("");
  const [category, setCategory] = useState("LOGS");
  const [location, setLocation] = useState("");
  const [shelf, setShelf] = useState("");
  const [units, setUnits] = useState([]);

  // Подгрузка единиц при смене категории
  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const response = await fetch(`http://localhost:3001/units?category=${category}`);
        if (!response.ok) throw new Error("Ошибка при загрузке единиц");
        const data = await response.json();
        setUnits(data);
        // автоматически выбираем первую единицу из списка
        setInputUnit(data[0]?.unit || "");
      } catch (error) {
        console.error(error);
      }
    };
    fetchUnits();
  }, [category]);

  const handleSave = async () => {
    try {
      const response = await fetch("http://localhost:3001/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          quantity: parseInt(quantity, 10),
          category,
          location,
          shelf,
          inputUnit,
        }),
      });

      if (!response.ok) throw new Error("Ошибка при добавлении товара");

      const data = await response.json();
      console.log("Товар добавлен:", data);
      onClose();
    } catch (error) {
      console.error("Ошибка:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-500 hover:text-black dark:hover:text-white"
        >
          ✕
        </button>

        <h2 className="text-2xl font-semibold mb-6">Добавить предмет на склад</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Название</label>
          <input
            type="text"
            placeholder="Например: Дубовое бревно"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-black dark:text-white"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Количество</label>
          <input
            type="number"
            placeholder="Например: 50"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full p-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-black dark:text-white"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Единицы измерения</label>
          <select
            value={inputUnit}
            onChange={(e) => setInputUnit(e.target.value)}
            className="w-full p-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-black dark:text-white"
          >
            {units.map((u) => (
              <option key={u.unit} value={u.unit}>
                {u.unit}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Категория</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-black dark:text-white"
          >
            <option value="LOGS">Бревно</option>
            <option value="LUMBER_NATURAL">Пиломатериалы естественной влажности</option>
            <option value="LUMBER_DRY">Пиломатериалы сухие</option>
            <option value="PLANED_PRODUCTS">Строганная продукция</option>
            <option value="PAINTS_VARNISHES">Лакокрасочная продукция</option>
            <option value="FURNITURE">Фурнитура</option>
            <option value="TOOLS">Инструменты</option>
            <option value="MACHINES">Станки</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Местоположение склада</label>
          <input
            type="text"
            placeholder="Например: Склад №1"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-black dark:text-white"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Полка</label>
          <input
            type="text"
            placeholder="Например: Полка A3"
            value={shelf}
            onChange={(e) => setShelf(e.target.value)}
            className="w-full p-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-black dark:text-white"
          />
        </div>


        <button
          onClick={handleSave}
          className="w-full bg-black text-white py-3 rounded-lg hover:bg-neutral-800 transition"
        >
          Добавить товар
        </button>
      </div>
    </div>
  );
}
