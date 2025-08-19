import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

const API = "http://localhost:3001";

function normalize(s = "") {
  return String(s).trim().toLowerCase();
}

// Тип категории по name/path: LOG — бревно, LUMBER — пиломатериал
function detectCategoryType(name, path) {
  const n = normalize(name);
  const p = normalize(path);
  if (n.includes("бревн") || p.includes("бревн")) return "LOG";
  if (n.includes("пиломатериал") || p.includes("пиломатериал")) return "LUMBER";
  return null;
}

// Парсинг размеров: поддержка x/×/*/х, единицы мм/см/м, запятая как разделитель
const SEP_RE = /x|×|\*|х/gi; // лат. x, знак умнож., *, русская х
function toNumber(val) {
  if (val == null) return NaN;
  return Number(String(val).replace(",", "."));
}
function parseTokenToMeters(raw) {
  const s = String(raw).trim().toLowerCase();
  const num = toNumber(s.replace(/[^\d.,-]/g, ""));
  if (!isFinite(num)) return NaN;

  // порядок важен: сначала проверяем мм/см, потом метры
  if (s.includes("мм") || s.includes("mm")) return num / 1000;
  if (s.includes("см") || s.includes("cm")) return num / 100;
  if (s.includes("м ") || s.endsWith("м") || s.includes(" m") || s.endsWith("m")) return num; // метры
  // Без единиц — считаем мм (частый кейс: 50x150x6000)
  return num / 1000;
}

function parseSize(sizeStr, type) {
  if (!sizeStr) return null;
  const parts = String(sizeStr).split(SEP_RE).map((p) => p.trim()).filter(Boolean);

  if (type === "LOG") {
    if (parts.length < 2) return null;
    const d = parseTokenToMeters(parts[0]);
    const l = parseTokenToMeters(parts[1]);
    if (!isFinite(d) || !isFinite(l) || d <= 0 || l <= 0) return null;
    return { d, l };
  }
  if (type === "LUMBER") {
    if (parts.length < 3) return null;
    const h = parseTokenToMeters(parts[0]);
    const w = parseTokenToMeters(parts[1]);
    const l = parseTokenToMeters(parts[2]);
    if (!isFinite(h) || !isFinite(w) || !isFinite(l) || h <= 0 || w <= 0 || l <= 0) return null;
    return { h, w, l };
  }
  return null;
}

function round3(n) {
  return isFinite(n) ? Number(n.toFixed(3)) : null;
}

function computeMetrics(sizeStr, type) {
  const parsed = parseSize(sizeStr, type);
  if (!parsed) return null;

  if (type === "LOG") {
    const { d, l } = parsed;
    const m3 = Math.PI * Math.pow(d / 2, 2) * l;
    const lm = l;
    const m2 = Math.PI * d * l; // боковая поверхность цилиндра
    return { lm: round3(lm), m3: round3(m3), m2: round3(m2) };
  }
  if (type === "LUMBER") {
    const { h, w, l } = parsed;
    const m3 = h * w * l;
    const lm = l;
    const m2 = w * l; // площадь доски в плане
    return { lm: round3(lm), m3: round3(m3), m2: round3(m2) };
  }
  return null;
}

function getField(item, keyName) {
  const k = normalize(keyName);
  return item.fields.find((f) => normalize(f.key) === k);
}

export default function InventoryTable() {
  const { category } = useParams(); // id категории
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allKeys, setAllKeys] = useState([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  const [categoryInfo, setCategoryInfo] = useState({ id: null, name: "", path: "", type: null });

  useEffect(() => {
    let ignore = false;
    if (!category) return;

    async function load() {
      setLoading(true);
      try {
        const [itemsRes, catsRes] = await Promise.all([
          axios.get(`${API}/items/by-category/${category}`),
          axios.get(`${API}/categories`),
        ]);

        if (ignore) return;

        const list = itemsRes.data || [];
        setItems(list);

        // Собираем все ключи из предметов
        const keys = Array.from(new Set(list.flatMap((item) => item.fields.map((f) => f.key))));
        setAllKeys(keys);

        const cats = catsRes.data || [];
        const thisCat = cats.find((c) => String(c.id) === String(category));
        const type = thisCat ? detectCategoryType(thisCat.name, thisCat.path) : null;
        setCategoryInfo({ id: thisCat?.id ?? null, name: thisCat?.name ?? "", path: thisCat?.path ?? "", type });
      } catch (e) {
        console.error(e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [category]);

  const isSpecial = Boolean(categoryInfo.type);

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
              {isSpecial && (
                <>
                  <th className="px-4 py-3 text-right font-semibold">Пог. м</th>
                  <th className="px-4 py-3 text-right font-semibold">м³</th>
                  <th className="px-4 py-3 text-right font-semibold">м²</th>
                </>
              )}
              <th className="px-4 py-3 text-center font-semibold">Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const sizeField = getField(item, "размер") || getField(item, "size");
              const metrics = isSpecial ? computeMetrics(sizeField?.value, categoryInfo.type) : null;

              return (
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
                  {isSpecial && (
                    <>
                      <td className="px-4 py-3 text-right">{metrics ? metrics.lm : "—"}</td>
                      <td className="px-4 py-3 text-right">{metrics ? metrics.m3 : "—"}</td>
                      <td className="px-4 py-3 text-right">{metrics ? metrics.m2 : "—"}</td>
                    </>
                  )}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        axios
                          .delete(`${API}/items/${item.id}`)
                          .then(() => setItems((prev) => prev.filter((i) => i.id !== item.id)));
                      }}
                      className="text-red-600 hover:underline"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showAddItemModal && (
          <AddItemModal
            categoryId={Number(category)}
            categoryType={categoryInfo.type}
            categoryName={categoryInfo.name}
            allKeys={allKeys}
            onClose={() => setShowAddItemModal(false)}
            onSave={(newItem) => {
              setItems((items) => [...items, newItem]);
              setShowAddItemModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AddItemModal({ categoryId, categoryType, categoryName, allKeys, onClose, onSave }) {
  const [name, setName] = useState("");
  const [fields, setFields] = useState(() => {
    // Вставим "Размер" первым, если его нет среди существующих ключей
    const keys = Array.from(new Set(["Размер", ...allKeys]));
    return keys.map((key) => ({ key, value: "" }));
  });

  // Индекс обязательного поля "Размер" (для спец-категорий)
  const sizeFieldIdx = fields.findIndex(
    (f) => normalize(f.key) === "размер" || normalize(f.key) === "size"
  );
  const sizeStr = sizeFieldIdx >= 0 ? fields[sizeFieldIdx].value : "";

  const metrics = useMemo(() => {
    if (!categoryType) return null;
    return computeMetrics(sizeStr, categoryType);
  }, [sizeStr, categoryType]);

  const sizePlaceholder =
    categoryType === "LOG"
      ? "Диаметр x Длина (напр. 300x6000 мм)"
      : categoryType === "LUMBER"
        ? "Высота x Ширина x Длина (напр. 50x150x6000 мм)"
        : "Размер";

  const handleAddField = () =>
    setFields((prev) => [...prev, { key: "", value: "" }]);

  const handleRemoveField = (index) =>
    setFields((prev) => prev.filter((_, i) => i !== index));

  const handleChangeField = (index, field) => {
    setFields((prev) => {
      const next = [...prev];
      next[index] = field;
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Введите название предмета");
      return;
    }
    if (categoryType) {
      if (sizeFieldIdx < 0 || !fields[sizeFieldIdx].value.trim()) {
        alert("Для этой категории 'Размер' обязателен");
        return;
      }
      const parsed = parseSize(fields[sizeFieldIdx].value, categoryType);
      if (!parsed) {
        alert("Размер указан неверно. Проверьте формат.");
        return;
      }
    }

    try {
      const res = await axios.post(`${API}/items`, {
        categoryId,
        name,
        fields,
      });
      onSave(res.data);
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Ошибка сохранения");
    }
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
        <h3 className="text-xl font-bold mb-4 text-center">
          Добавить новый предмет{categoryName ? ` — ${categoryName}` : ""}
        </h3>

        <input
          type="text"
          placeholder="Название предмета"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-4 px-4 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500"
        />

        <div className="max-h-64 overflow-y-auto pr-2">
          {fields.map((field, i) => {
            const isSize =
              normalize(field.key) === "размер" || normalize(field.key) === "size";
            const isRequiredSize = isSize && !!categoryType; // обязательное поле для LOG/LUMBER

            return (
              <div key={i} className="flex gap-2 mb-2">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={isSize ? "Характеристика (Размер)" : "Характеристика"}
                    value={field.key}
                    onChange={(e) =>
                      handleChangeField(i, { ...field, key: e.target.value })
                    }
                    disabled={isRequiredSize} // фиксируем ключ "Размер" как обязательный
                    className={`w-full px-3 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 ${isSize ? "border-blue-400 focus:ring-blue-500" : "focus:ring-blue-500"
                      } ${isRequiredSize ? "opacity-80 cursor-not-allowed" : ""}`}
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={isSize ? sizePlaceholder : "Значение"}
                    value={field.value}
                    onChange={(e) =>
                      handleChangeField(i, { ...field, value: e.target.value })
                    }
                    className={`w-full px-3 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 ${isSize ? "border-blue-400 focus:ring-blue-500" : "focus:ring-blue-500"
                      }`}
                  />
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveField(i)}
                    disabled={isRequiredSize} // нельзя удалить обязательный "Размер"
                    title={isRequiredSize ? "Обязательное поле" : "Удалить характеристику"}
                    className={`px-3 py-2 rounded-lg border dark:border-neutral-700 ${isRequiredSize
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      }`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={handleAddField} className="mt-2 mb-3 text-blue-600 hover:underline">
          + Добавить характеристику
        </button>

        {categoryType && (
          <div className="mt-2 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 text-sm">
            <div className="text-neutral-500 mb-2">Предпросмотр расчётов по размеру:</div>
            {metrics ? (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-neutral-500">Пог. м:</span> <b>{metrics.lm}</b>
                </div>
                <div>
                  <span className="text-neutral-500">м³:</span> <b>{metrics.m3}</b>
                </div>
                <div>
                  <span className="text-neutral-500">м²:</span> <b>{metrics.m2}</b>
                </div>
              </div>
            ) : (
              <div className="text-red-600">
                Укажите корректный “Размер” в формате:{" "}
                {categoryType === "LOG" ? "Диаметр x Длина" : "Высота x Ширина x Длина"}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-4">
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