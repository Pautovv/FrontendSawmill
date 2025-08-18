import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

function InventoryTable() {
  const { category } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allKeys, setAllKeys] = useState([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  useEffect(() => {
    if (!category) return;
    setLoading(true);
    axios
      .get(`http://localhost:3001/items/by-category/${category}`) 
      .then((res) => {
        setItems(res.data);
        const keys = Array.from(
          new Set(res.data.flatMap((item) => item.fields.map((f) => f.key)))
        );
        setAllKeys(keys);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [category]);

  if (loading) return <p className="text-center text-lg">Загрузка...</p>;

  return (
    <div className="p-6">
      <button
        onClick={() => setShowAddItemModal(true)}
        className="mb-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-xl shadow-md hover:scale-105 transition-transform"
      >
        + Добавить предмет
      </button>

      {items.length === 0 && (
        <p className="mb-4 text-gray-500 text-center text-lg">
          Нет предметов в этой категории
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-neutral-800 dark:to-neutral-700">
              <th className="px-4 py-3 text-left font-semibold">Название</th>
              {allKeys.map((key) => (
                <th key={key} className="px-4 py-3 text-left font-semibold">
                  {key}
                </th>
              ))}
              <th className="px-4 py-3 text-center font-semibold">Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.id}
                className={`transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800 ${idx % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-gray-50 dark:bg-neutral-800"
                  }`}
              >
                <td className="px-4 py-3 font-medium">{item.name}</td>
                {allKeys.map((key) => {
                  const field = item.fields.find((f) => f.key === key);
                  return (
                    <td key={key} className="px-4 py-3">
                      {field ? field.value : "—"}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => {
                      axios
                        .delete(`http://localhost:3001/items/${item.id}`)
                        .then(() => setItems(items.filter((i) => i.id !== item.id)));
                    }}
                    className="text-red-600 hover:underline"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showAddItemModal && (
          <AddItemModal
            category={category}
            allKeys={allKeys}
            onClose={() => setShowAddItemModal(false)}
            onSave={(newItem) => {
              setItems([...items, newItem]);
              setShowAddItemModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AddItemModal({ category, allKeys, onClose, onSave }) {
  const [name, setName] = useState("");
  const [fields, setFields] = useState(allKeys.map((key) => ({ key, value: "" })));

  const handleAddField = () => setFields([...fields, { key: "", value: "" }]);
  const handleChangeField = (index, field) => {
    const newFields = [...fields];
    newFields[index] = field;
    setFields(newFields);
  };

  const handleSave = () => {
    axios
      .post("http://localhost:3001/items", {
        categoryId: Number(category),
        name,
        fields,
      })
      .then((res) => onSave(res.data))
      .catch((err) => alert(err.message));
  };

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-2xl w-full max-w-lg"
      >
        <h3 className="text-xl font-bold mb-4 text-center">Добавить новый предмет</h3>
        <input
          type="text"
          placeholder="Название предмета"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-4 px-4 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500"
        />

        <div className="max-h-60 overflow-y-auto pr-2">
          {fields.map((field, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Характеристика"
                value={field.key}
                onChange={(e) => handleChangeField(i, { ...field, key: e.target.value })}
                className="flex-1 px-3 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Значение"
                value={field.value}
                onChange={(e) => handleChangeField(i, { ...field, value: e.target.value })}
                className="flex-1 px-3 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleAddField}
          className="mb-4 text-blue-600 hover:underline"
        >
          + Добавить характеристику
        </button>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md hover:scale-105 transition-transform"
          >
            Сохранить
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default InventoryTable;
