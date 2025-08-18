import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

function InventoryTable() {
  const { category } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allKeys, setAllKeys] = useState([]); // все уникальные характеристики
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  useEffect(() => {
    if (!category) return;
    setLoading(true);
    axios
      .get(`http://localhost:3001/items/${category}`)
      .then((res) => {
        setItems(res.data);

        // формируем список всех уникальных ключей (характеристик)
        const keys = Array.from(
          new Set(res.data.flatMap((item) => item.fields.map((f) => f.key)))
        );
        setAllKeys(keys);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [category]);

  if (loading) return <p>Загрузка...</p>;

  return (
    <>
      <button
        onClick={() => setShowAddItemModal(true)}
        className="mb-4 bg-blue-500 text-white px-3 py-1 rounded"
      >
        Добавить предмет
      </button>

      {items.length === 0 && (
        <p className="mb-4 text-gray-500">Нет предметов в этой категории</p>
      )}

      <table className="w-full border-collapse border border-neutral-300 dark:border-neutral-600">
        <thead>
          <tr className="bg-gray-100 dark:bg-neutral-700">
            <th>Название</th>
            {allKeys.map((key) => (
              <th key={key}>{key}</th>
            ))}
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="hover:bg-gray-50 dark:hover:bg-neutral-800"
            >
              <td>{item.name}</td>
              {allKeys.map((key) => {
                const field = item.fields.find((f) => f.key === key);
                return <td key={key}>{field ? field.value : ""}</td>;
              })}
              <td>
                <button
                  onClick={() => {
                    axios
                      .delete(`http://localhost:3001/items/${item.id}`)
                      .then(() =>
                        setItems(items.filter((i) => i.id !== item.id))
                      );
                  }}
                  className="text-red-600"
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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
    </>
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
      .post("http://localhost:3001/items", { categoryId: Number(category), name, fields })
      .then(res => onSave(res.data))
      .catch(err => alert(err.message));
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl shadow-lg w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Добавить новый предмет</h3>
        <input
          type="text"
          placeholder="Название предмета"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full mb-3 px-3 py-2 rounded-lg border dark:bg-neutral-900"
        />

        {fields.map((field, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Название характеристики"
              value={field.key}
              onChange={e => handleChangeField(i, { ...field, key: e.target.value })}
              className="flex-1 px-2 py-1 rounded border"
            />
            <input
              type="text"
              placeholder="Значение"
              value={field.value}
              onChange={e => handleChangeField(i, { ...field, value: e.target.value })}
              className="flex-1 px-2 py-1 rounded border"
            />
          </div>
        ))}

        <button onClick={handleAddField} className="mb-3 text-blue-600">Добавить характеристику</button>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-300 dark:bg-neutral-700">Отмена</button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Сохранить</button>
        </div>
      </div>
    </div>
  );
}

export default InventoryTable;
