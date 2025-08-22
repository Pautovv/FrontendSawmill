import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

const API = "http://localhost:3001";

/* ======= helpers (без TS, всё в JS) ======= */
function normalize(s = "") {
  return String(s).trim().toLowerCase();
}

function detectCategoryType(name, path) {
  const n = normalize(name);
  const p = normalize(path);
  if (n.includes("бревн") || p.includes("бревн")) return "LOG";
  if (n.includes("пиломатериал") || p.includes("пиломатериал") || n.includes("строган") || p.includes("строган")) {
    return "LUMBER";
  }
  return null;
}

function isMachineryCategory(name, path) {
  const n = normalize(name);
  const p = normalize(path);
  return n.includes("станк") || p.includes("станк");
}
function isWoodCategory(name, path) {
  const n = normalize(name);
  const p = normalize(path);
  if (n.includes("бревн") || p.includes("бревн")) return true;
  if (n.includes("пиломатериал") || p.includes("пиломатериал")) return true;
  if (n.includes("строган") || p.includes("строган")) return true;
  if ((n.includes("влажн") || p.includes("влажн")) && (n.includes("пиломатериал") || p.includes("пиломатериал"))) {
    return true;
  }
  return false;
}

const SEP_RE = /x|×|\*|х/gi;

function toNumber(val) {
  if (val == null) return NaN;
  return Number(String(val).replace(",", "."));
}

function parseTokenToMeters(raw) {
  const s = String(raw).trim().toLowerCase();
  const num = toNumber(s.replace(/[^\d.,-]/g, ""));
  if (!isFinite(num)) return NaN;

  if (s.includes("мм") || s.includes("mm")) return num / 1000;
  if (s.includes("см") || s.includes("cm")) return num / 100;
  if (s.includes("м ") || s.endsWith("м") || s.includes(" m") || s.endsWith("m")) return num;
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
    const m2 = Math.PI * d * l;
    return { lm: round3(lm), m3: round3(m3), m2: round3(m2) };
  }
  if (type === "LUMBER") {
    const { h, w, l } = parsed;
    const m3 = h * w * l;
    const lm = l;
    const m2 = w * l;
    return { lm: round3(lm), m3: round3(m3), m2: round3(m2) };
  }
  return null;
}

function getField(item, keyName) {
  const k = normalize(keyName);
  return item.fields.find((f) => normalize(f.key) === k);
}
function getFieldAny(item, keys = []) {
  for (const k of keys) {
    const f = getField(item, k);
    if (f) return f;
  }
  return null;
}
function parseQuantity(val) {
  if (val == null) return NaN;
  const num = toNumber(String(val).replace(/[^\d.,-]/g, ""));
  return isFinite(num) ? num : NaN;
}

const STORAGE_KEYS = ["Склад", "Полка"];
const STORAGE_KEYS_NORM = STORAGE_KEYS.map((k) => normalize(k));

function orderKeys(keys = []) {
  const seen = new Set();
  const uniq = [];
  for (const k of keys) {
    const n = normalize(k);
    if (!seen.has(n)) {
      seen.add(n);
      uniq.push(k);
    }
  }
  const others = uniq.filter((k) => !STORAGE_KEYS_NORM.includes(normalize(k)));
  const presentStorageOrdered = STORAGE_KEYS.filter((k) =>
    uniq.some((x) => normalize(x) === normalize(k))
  );
  return [...others, ...presentStorageOrdered];
}

/* ======= Страница категории: подкатегории + таблица ======= */
export default function InventoryTable() {
  // wildcard параметр: /inventory/:categoryPath*
  const params = useParams();
  const categoryPath = (params["*"] || "").replace(/^\//, ""); // без ведущего слеша

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allKeys, setAllKeys] = useState([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  const [categoryInfo, setCategoryInfo] = useState({ id: null, name: "", path: "", type: null });
  const [children, setChildren] = useState([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function load() {
      if (!categoryPath) return;
      setLoading(true);
      setNotFound(false);
      try {
        const [catRes, childrenRes, itemsRes] = await Promise.all([
          axios.get(`${API}/categories/by-path`, { params: { path: categoryPath } }),
          axios.get(`${API}/categories/children`, { params: { parentPath: categoryPath } }),
          axios.get(`${API}/items/by-category`, { params: { categoryPath } }),
        ]);

        if (ignore) return;

        const cat = catRes.data;
        const type = detectCategoryType(cat?.name, cat?.path);
        setCategoryInfo({ id: cat?.id ?? null, name: cat?.name ?? "", path: cat?.path ?? categoryPath, type });
        setChildren(childrenRes.data || []);

        const list = itemsRes.data || [];
        setItems(list);

        const keysRaw = Array.from(new Set(list.flatMap((item) => item.fields.map((f) => f.key))));
        const keysOrdered = orderKeys(keysRaw);
        setAllKeys(keysOrdered);
      } catch (e) {
        console.error(e);
        setNotFound(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [categoryPath]);

  if (!categoryPath) {
    // Если зашли на /inventory без пути — предложим перейти на корень
    return (
      <div className="p-6">
        <div className="text-sm mb-4">
          Откройте корневые категории на странице Склады.
        </div>
        <Link to="/inventory" className="text-blue-600 hover:underline">Перейти к корневым категориям</Link>
      </div>
    );
  }

  if (loading) return <p className="text-center text-lg p-6">Загрузка...</p>;
  if (notFound) {
    return (
      <div className="p-6">
        <Breadcrumbs path={categoryPath} />
        <div className="text-red-600">Категория не найдена: {categoryPath}</div>
        <div className="mt-2">
          <Link to="/inventory" className="text-blue-600 hover:underline">На главную складов</Link>
        </div>
      </div>
    );
  }

  const isSpecial = Boolean(categoryInfo.type);

  return (
    <div className="p-6">
      {/* Хлебные крошки */}
      <Breadcrumbs path={categoryInfo.path} />

      {/* Подкатегории */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Подкатегории — {categoryInfo.name}</h3>
          <AddSubcategoryButton
            parentPath={categoryInfo.path}
            onCreated={(cat) => setChildren((prev) => [...prev, cat])}
          />
        </div>
        {children.length === 0 ? (
          <div className="text-neutral-500">Подкатегорий нет</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((c) => (
              <Link
                key={c.id}
                to={`/inventory/${encodeURI(c.path)}`}
                className="block bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 hover:shadow"
              >
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-neutral-500 mt-1">{c.path}</div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Таблица предметов */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Предметы — {categoryInfo.name}</h3>
        <button
          onClick={() => setShowAddItemModal(true)}
          className="mb-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-xl shadow-md hover:scale-105 transition-transform"
        >
          + Добавить предмет
        </button>
      </div>

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
              const sizeField = getFieldAny(item, ["размер", "size"]);
              const qtyField = getFieldAny(item, ["количество", "колличество", "quantity"]);
              const qtyRaw = qtyField?.value;
              const qtyParsed = parseQuantity(qtyRaw);
              const qty = isFinite(qtyParsed) && qtyParsed > 0 ? qtyParsed : 1;

              const baseMetrics = isSpecial ? computeMetrics(sizeField?.value, categoryInfo.type) : null;
              const metrics = baseMetrics
                ? {
                  lm: round3(baseMetrics.lm * qty),
                  m3: round3(baseMetrics.m3 * qty),
                  m2: round3(baseMetrics.m2 * qty),
                }
                : null;

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
            categoryId={Number(categoryInfo.id)}
            categoryType={categoryInfo.type}
            categoryName={categoryInfo.name}
            categoryPath={categoryInfo.path}
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

/* ======= UI helpers ======= */
function Breadcrumbs({ path }) {
  const parts = (path || "").split("/").filter(Boolean);
  const crumbs = parts.map((slug, idx) => ({
    name: slug,
    to: `/inventory/${encodeURI(parts.slice(0, idx + 1).join("/"))}`,
  }));
  return (
    <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 flex flex-wrap gap-1">
      <Link to="/inventory" className="hover:underline">Склады</Link>
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          <span>/</span>
          <Link to={c.to} className="hover:underline">{c.name}</Link>
        </span>
      ))}
    </div>
  );
}

function AddSubcategoryButton({ parentPath, onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const submit = () => {
    const nm = name.trim();
    if (!nm) return;
    axios.post(`${API}/categories`, { name: nm, parentPath })
      .then((res) => {
        onCreated(res.data);
        setOpen(false);
        setName("");
      })
      .catch((err) => alert(err?.response?.data?.message || err.message));
  };
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        + Подкатегория
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-2xl w-full max-w-md"
            >
              <div className="text-lg font-semibold mb-3">Новая подкатегория</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название подкатегории"
                className="w-full mb-4 px-3 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-neutral-700">Отмена</button>
                <button onClick={submit} className="px-3 py-2 rounded-lg bg-blue-600 text-white">Сохранить</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ======= Модалка добавления предмета (адаптация под JSX) ======= */
function AddItemModal({ categoryId, categoryType, categoryName, categoryPath, allKeys, onClose, onSave }) {
  const storageRequired = !isMachineryCategory(categoryName, categoryPath);
  const woodRequired = isWoodCategory(categoryName, categoryPath);

  const requiredNonStorage = [];
  if (categoryType) requiredNonStorage.push("Размер");
  if (woodRequired) requiredNonStorage.push("Количество");

  const allKeysNormSet = new Set((allKeys || []).map((k) => normalize(k)));
  const includeStorageTail = storageRequired || STORAGE_KEYS_NORM.some((k) => allKeysNormSet.has(k));

  const initialKeys = (() => {
    const requiredSet = new Set(requiredNonStorage.map((k) => normalize(k)));
    const others = (allKeys || []).filter(
      (k) => !requiredSet.has(normalize(k)) && !STORAGE_KEYS_NORM.includes(normalize(k))
    );
    const storageTail = includeStorageTail ? STORAGE_KEYS : [];
    const seen = new Set();
    const ordered = [...requiredNonStorage, ...others, ...storageTail].filter((k) => {
      const n = normalize(k);
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
    return ordered;
  })();

  const [name, setName] = useState("");
  const [fields, setFields] = useState(() => initialKeys.map((key) => ({ key, value: "" })));

  const requiredKeysBase = [
    ...requiredNonStorage,
    ...(storageRequired ? STORAGE_KEYS : []),
  ];
  const requiredKeysNormalized = new Set(requiredKeysBase.map((k) => normalize(k)));

  const findFieldIndex = (pred) => fields.findIndex(pred);
  const findIndexByKey = (k) => findFieldIndex((f) => normalize(f.key) === normalize(k));

  const sizeFieldIdx = (() => {
    const idx1 = findIndexByKey("размер");
    if (idx1 >= 0) return idx1;
    return findIndexByKey("size");
  })();
  const qtyFieldIdx = (() => {
    const c1 = findIndexByKey("количество");
    if (c1 >= 0) return c1;
    const c2 = findIndexByKey("колличество");
    if (c2 >= 0) return c2;
    return findIndexByKey("quantity");
  })();

  const sizeStr = sizeFieldIdx >= 0 ? fields[sizeFieldIdx].value : "";
  const qtyStr = qtyFieldIdx >= 0 ? fields[qtyFieldIdx].value : "";

  const metrics = useMemo(() => {
    if (!categoryType) return null;
    const base = computeMetrics(sizeStr, categoryType);
    if (!base) return null;
    const q = parseQuantity(qtyStr);
    const qty = isFinite(q) && q > 0 ? q : 1;
    return {
      lm: round3(base.lm * qty),
      m3: round3(base.m3 * qty),
      m2: round3(base.m2 * qty),
    };
  }, [sizeStr, qtyStr, categoryType]);

  const sizePlaceholder =
    categoryType === "LOG"
      ? "Диаметр x Длина (напр. 300x6000 мм)"
      : categoryType === "LUMBER"
        ? "Толщина x Ширина x Длина (напр. 50x150x6000 мм)"
        : "Размер";

  const insertBeforeStorage = (arr, field) => {
    const firstStorageIdx = arr.findIndex((f) => STORAGE_KEYS_NORM.includes(normalize(f.key)));
    const insertIdx = firstStorageIdx >= 0 ? firstStorageIdx : arr.length;
    return [...arr.slice(0, insertIdx), field, ...arr.slice(insertIdx)];
  };

  const ensureStorageAtEnd = (arr) => {
    if (!arr.length) return arr;
    const nonStorage = arr.filter((f) => !STORAGE_KEYS_NORM.includes(normalize(f.key)));
    const storage = arr.filter((f) => STORAGE_KEYS_NORM.includes(normalize(f.key)));
    const storageOrdered = STORAGE_KEYS.map((k) => storage.find((f) => normalize(f.key) === normalize(k))).filter(Boolean);
    return [...nonStorage, ...storageOrdered];
  };

  const handleAddField = () =>
    setFields((prev) => {
      const next = insertBeforeStorage(prev, { key: "", value: "" });
      return ensureStorageAtEnd(next);
    });

  const handleRemoveField = (index) =>
    setFields((prev) => {
      const k = prev[index]?.key ?? "";
      if (requiredKeysNormalized.has(normalize(k))) return prev;
      const next = prev.filter((_, i) => i !== index);
      return ensureStorageAtEnd(next);
    });

  const handleChangeField = (index, field) => {
    setFields((prev) => {
      const next = [...prev];
      if (requiredKeysNormalized.has(normalize(prev[index]?.key))) {
        next[index] = { ...field, key: prev[index].key };
      } else {
        next[index] = field;
      }
      return ensureStorageAtEnd(next);
    });
  };

  const ensureFieldExists = (key) => findIndexByKey(key) >= 0;

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Введите название предмета");
      return;
    }

    if (!categoryId) {
      alert("Не определена категория");
      return;
    }

    if (storageRequired) {
      const skladIdx = findIndexByKey("склад");
      const polkaIdx = findIndexByKey("полка");
      if (skladIdx < 0 || !fields[skladIdx].value.trim()) {
        alert("Поле 'Склад' обязательно");
        return;
      }
      if (polkaIdx < 0 || !fields[polkaIdx].value.trim()) {
        alert("Поле 'Полка' обязательно");
        return;
      }
    }

    if (categoryType) {
      if (!ensureFieldExists("размер") && !ensureFieldExists("size")) {
        alert("Для этой категории 'Размер' обязателен");
        return;
      }
      const idx = sizeFieldIdx;
      const parsed = parseSize(idx >= 0 ? fields[idx].value : "", categoryType);
      if (!parsed) {
        alert("Размер указан неверно. Проверьте формат.");
        return;
      }
    }

    if (woodRequired) {
      if (!ensureFieldExists("количество") && !ensureFieldExists("колличество") && !ensureFieldExists("quantity")) {
        alert("Поле 'Количество' обязательно");
        return;
      }
      const qidx =
        qtyFieldIdx >= 0
          ? qtyFieldIdx
          : findIndexByKey("количество") >= 0
            ? findIndexByKey("количество")
            : findIndexByKey("quantity");
      const q = parseQuantity(qidx >= 0 ? fields[qidx].value : "");
      if (!isFinite(q) || q <= 0) {
        alert("Введите корректное значение в поле 'Количество' (> 0)");
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
            const keyNorm = normalize(field.key);
            const isSize = keyNorm === "размер" || keyNorm === "size";
            const isQty = keyNorm === "количество" || keyNorm === "колличество" || keyNorm === "quantity";
            const isRequired = keyNorm && requiredKeysNormalized.has(keyNorm);

            return (
              <div key={i} className="flex gap-2 mb-2">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={
                      isSize
                        ? "Характеристика (Размер)"
                        : isQty
                          ? "Характеристика (Количество)"
                          : "Характеристика"
                    }
                    value={field.key}
                    onChange={(e) => handleChangeField(i, { ...field, key: e.target.value })}
                    disabled={isRequired}
                    className={`w-full px-3 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 ${isRequired ? "opacity-80 cursor-not-allowed" : "focus:ring-blue-500"
                      } ${isSize ? "border-blue-400 focus:ring-blue-500" : ""}`}
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={isSize ? sizePlaceholder : isQty ? "Количество (шт.)" : "Значение"}
                    value={field.value}
                    onChange={(e) => handleChangeField(i, { ...field, value: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 ${isSize ? "border-blue-400 focus:ring-blue-500" : "focus:ring-blue-500"
                      }`}
                  />
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveField(i)}
                    disabled={isRequired}
                    title={isRequired ? "Обязательное поле" : "Удалить характеристику"}
                    className={`px-3 py-2 rounded-lg border dark:border-neutral-700 ${isRequired ? "opacity-50 cursor-not-allowed" : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
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
                {categoryType === "LOG" ? "Диаметр x Длина" : "Толщина x Ширина x Длина"}
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