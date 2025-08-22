import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const API = "http://localhost:3001";

export default function WarehousePage() {
  const [sections, setSections] = useState([]);
  const [newLabel, setNewLabel] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    axios.get(`${API}/categories/children`).then((res) => {
      setSections(res.data || []);
    });
  }, []);

  const handleAddSection = () => {
    const name = newLabel.trim();
    if (!name) return;

    axios
      .post(`${API}/categories`, { name })
      .then((res) => {
        setSections((prev) => [...prev, res.data]);
        setNewLabel("");
        setShowAddModal(false);
      })
      .catch((err) => alert("Ошибка при добавлении: " + (err?.response?.data?.message || err.message)));
  };

  const handleDeleteSection = (index) => {
    const cat = sections[index];
    axios
      .delete(`${API}/categories/${cat.id}`)
      .then(() => {
        setSections((prev) => prev.filter((_, i) => i !== index));
        setContextMenu(null);
      })
      .catch((err) => alert(err?.response?.data?.message || err.message));
  };

  return (
    <div
      className="flex gap-10 px-8 py-10 bg-white dark:bg-black min-h-screen transition-all duration-300 text-[15px]"
      onClick={() => setContextMenu(null)}
    >
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
        {sections.map((item, index) => (
          <Link
            key={item.id}
            to={`/inventory/${encodeURI(item.path)}`}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, index });
            }}
            className="block bg-white dark:bg-neutral-800 rounded-2xl shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 p-6 border border-neutral-200 dark:border-neutral-700"
          >
            <h2 className="text-xl font-semibold mb-2">{item.name}</h2>
            <p className="text-sm text-neutral-500">{item.path}</p>
          </Link>
        ))}

        <button
          onClick={() => setShowAddModal(true)}
          className="flex flex-col items-center justify-center bg-white dark:bg-neutral-800 rounded-2xl border-2 border-dashed border-neutral-400 dark:border-neutral-600 hover:border-blue-500 dark:hover:border-blue-400 transition-all p-6"
        >
          <span className="text-4xl text-neutral-500">+</span>
          <span className="mt-2 text-sm text-neutral-500">Добавить склад</span>
        </button>
      </section>

      {contextMenu && (
        <div
          className="absolute bg-white dark:bg-neutral-800 border rounded-md shadow-lg py-1 z-50"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => handleDeleteSection(contextMenu.index)}
            className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50"
          >
            Удалить
          </button>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Добавить новый склад</h3>
            <input
              type="text"
              placeholder="Название склада"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full mb-3 px-3 py-2 rounded-lg border dark:bg-neutral-900"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-300 dark:bg-neutral-700"
              >
                Отмена
              </button>
              <button
                onClick={handleAddSection}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}