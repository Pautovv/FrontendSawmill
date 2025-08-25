import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

const API = "http://localhost:3001";

/* ======= helpers ======= */
function normalize(s = "") {
  return String(s).trim().toLowerCase();
}
function detectCategoryType(name, path) {
  const n = normalize(name);
  const p = normalize(path);
  if (n.includes("бревн") || p.includes("бревн")) return "LOG";
  if (
    n.includes("пиломатериал") ||
    p.includes("пиломатериал") ||
    n.includes("строган") ||
    p.includes("строган")
  )
    return "LUMBER";
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
  if (
    (n.includes("влажн") || p.includes("влажн")) &&
    (n.includes("пиломатериал") || p.includes("пиломатериал"))
  )
    return true;
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
  const parts = String(sizeStr)
    .split(SEP_RE)
    .map((p) => p.trim())
    .filter(Boolean);
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

/* ======= Component ======= */
export default function InventoryTable() {
  const params = useParams();
  const categoryPath = (params["*"] || "").replace(/^\//, "");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allKeys, setAllKeys] = useState([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  const [categoryInfo, setCategoryInfo] = useState({ id: null, name: "", path: "", type: null });
  const [children, setChildren] = useState([]);
  const [notFound, setNotFound] = useState(false);

  // context menu state
  const [contextMenu, setContextMenu] = useState(null); // {x,y,item}
  const [moveItem, setMoveItem] = useState(null); // item object or null

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    function onEsc(e) {
      if (e.key === "Escape") {
        setContextMenu(null);
        setMoveItem(null);
      }
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!categoryPath) return;
      setLoading(true);
      setNotFound(false);
      try {
        // IMPORTANT: ensure backend adds warehouse.responsible (select firstName,lastName,email) in /items/by-category
        const [catRes, childrenRes, itemsRes] = await Promise.all([
          axios.get(`${API}/categories/by-path`, { params: { path: categoryPath } }),
          axios.get(`${API}/categories/children`, { params: { parentPath: categoryPath } }),
          axios.get(`${API}/items/by-category`, { params: { categoryPath } }),
        ]);
        if (ignore) return;
        const cat = catRes.data;
        const type = detectCategoryType(cat?.name, cat?.path);
        setCategoryInfo({
          id: cat?.id ?? null,
          name: cat?.name ?? "",
          path: cat?.path ?? categoryPath,
          type,
        });
        setChildren(childrenRes.data || []);
        const list = itemsRes.data || [];
        setItems(list);

        const keysRaw = Array.from(
          new Set(
            list
              .flatMap((item) => item.fields.map((f) => f.key))
              .filter(
                (k) => normalize(k) !== "склад" && normalize(k) !== "полка"
              )
          )
        );
        setAllKeys(keysRaw);
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

  // close context menu on any normal left click
  useEffect(() => {
    function onClick() {
      if (contextMenu) setContextMenu(null);
    }
    if (contextMenu) {
      window.addEventListener("click", onClick);
      return () => window.removeEventListener("click", onClick);
    }
  }, [contextMenu]);

  if (!categoryPath) {
    return (
      <div className="p-6">
        <div className="text-sm mb-4">Откройте корневые категории на странице Склады.</div>
        <Link to="/inventory" className="text-blue-600 hover:underline">
          Перейти к корневым категориям
        </Link>
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
          <Link to="/inventory" className="text-blue-600 hover:underline">
            На главную складов
          </Link>
        </div>
      </div>
    );
  }

  const isSpecial = Boolean(categoryInfo.type);
  const isWood = isSpecial || isWoodCategory(categoryInfo.name, categoryInfo.path);

  const findFieldValue = (fields, variants) => {
    const normVariants = variants.map(normalize);
    const f = fields.find((fld) => normVariants.includes(normalize(fld.key)));
    return f ? f.value : null;
  };

  function handleDelete(itemId) {
    if (!window.confirm("Удалить предмет?")) return;
    axios
      .delete(`${API}/items/${itemId}`)
      .then(() => setItems((prev) => prev.filter((i) => i.id !== itemId)))
      .catch((e) => alert(e?.response?.data?.message || e.message));
  }

  function onRowContext(e, item) {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
    });
  }

  function openMove(item) {
    setMoveItem(item);
    setContextMenu(null);
  }

  return (
    <div className="p-6 relative">
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

      {/* Таблица */}
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
            {!isWood && (
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
                <th className="px-4 py-3 text-left font-semibold">Склад</th>
                <th className="px-4 py-3 text-left font-semibold">Полка</th>
                <th className="px-4 py-3 text-left font-semibold">Ответственный</th>
              </tr>
            )}
            {isWood && (
              <tr className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-neutral-800 dark:to-neutral-700">
                <th className="px-4 py-3 text-left font-semibold">Название</th>
                <th className="px-4 py-3 text-left font-semibold">Порода</th>
                <th className="px-4 py-3 text-left font-semibold">Размер</th>
                <th className="px-4 py-3 text-right font-semibold">шт</th>
                <th className="px-4 py-3 text-right font-semibold">Пог. м</th>
                <th className="px-4 py-3 text-right font-semibold">м³</th>
                <th className="px-4 py-3 text-right font-semibold">м²</th>
                <th className="px-4 py-3 text-left font-semibold">Склад</th>
                <th className="px-4 py-3 text-left font-semibold">Полка</th>
                <th className="px-4 py-3 text-left font-semibold">Ответственный</th>
              </tr>
            )}
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const sizeField = getFieldAny(item, ["размер", "size"]);
              const qtyField = getFieldAny(item, [
                "шт",
                "количество",
                "колличество",
                "quantity",
              ]);
              const qtyParsed = parseQuantity(qtyField?.value);
              const qty = isFinite(qtyParsed) && qtyParsed > 0 ? qtyParsed : 1;
              const baseMetrics =
                isSpecial || isWood
                  ? computeMetrics(sizeField?.value, categoryInfo.type)
                  : null;
              const metrics = baseMetrics
                ? {
                  lm: round3(baseMetrics.lm * qty),
                  m3: round3(baseMetrics.m3 * qty),
                  m2: round3(baseMetrics.m2 * qty),
                }
                : null;
              const breed = isWood
                ? findFieldValue(item.fields, [
                  "порода",
                  "порода древесины",
                  "wood",
                  "breed",
                ])
                : null;

              const warehouseName = item.warehouse?.name || "—";
              const shelfName = item.shelf?.name || "—";

              const respUser = item.warehouse?.responsible
                ? formatUser(item.warehouse.responsible)
                : "—";

              const baseRowClass = `transition-colors cursor-context-menu hover:bg-gray-50 dark:hover:bg-neutral-800 ${idx % 2 === 0
                  ? "bg-white dark:bg-neutral-900"
                  : "bg-gray-50 dark:bg-neutral-800"
                }`;

              if (!isWood) {
                return (
                  <tr
                    key={item.id}
                    onContextMenu={(e) => onRowContext(e, item)}
                    className={baseRowClass}
                    title="ПКМ: действия"
                  >
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    {allKeys.map((key) => {
                      const field = item.fields.find(
                        (f) => normalize(f.key) === normalize(key)
                      );
                      return (
                        <td key={key} className="px-4 py-3">
                          {field ? field.value : "—"}
                        </td>
                      );
                    })}
                    {isSpecial && (
                      <>
                        <td className="px-4 py-3 text-right">
                          {metrics ? metrics.lm : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {metrics ? metrics.m3 : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {metrics ? metrics.m2 : "—"}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">{warehouseName}</td>
                    <td className="px-4 py-3">{shelfName}</td>
                    <td className="px-4 py-3">{respUser}</td>
                  </tr>
                );
              }

              return (
                <tr
                  key={item.id}
                  onContextMenu={(e) => onRowContext(e, item)}
                  className={baseRowClass}
                  title="ПКМ: действия"
                >
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3">{breed || "—"}</td>
                  <td className="px-4 py-3">{sizeField?.value || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {isFinite(qty) ? qty : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {metrics ? metrics.lm : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {metrics ? metrics.m3 : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {metrics ? metrics.m2 : "—"}
                  </td>
                  <td className="px-4 py-3">{warehouseName}</td>
                  <td className="px-4 py-3">{shelfName}</td>
                  <td className="px-4 py-3">{respUser}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Контекстное меню */}
      {contextMenu && (
        <div
          className="fixed z-50 w-56 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 animate-fade-in"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
          }}
        >
          <div className="px-3 py-2 text-xs text-neutral-500 border-b dark:border-neutral-700">
            {contextMenu.item.name}
          </div>
          <button
            onClick={() => openMove(contextMenu.item)}
            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            Переместить...
          </button>
          <button
            onClick={() => {
              handleDelete(contextMenu.item.id);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            Удалить
          </button>
          <button
            onClick={closeContextMenu}
            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            Закрыть
          </button>
        </div>
      )}

      <AnimatePresence>
        {showAddItemModal && (
          <AddItemModal
            categoryId={Number(categoryInfo.id)}
            categoryType={categoryInfo.type}
            categoryName={categoryInfo.name}
            onClose={() => setShowAddItemModal(false)}
            onSave={(newItem) => {
              setItems((items) => [...items, newItem]);
              setShowAddItemModal(false);
            }}
            forceWoodLayout={isWood}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {moveItem && (
          <MoveItemModal
            item={moveItem}
            onClose={() => setMoveItem(null)}
            onMoved={(updated) => {
              setItems((prev) =>
                prev.map((it) => (it.id === updated.id ? updated : it))
              );
              setMoveItem(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ======= UI helpers ======= */
function formatUser(u) {
  const fio = [u.lastName, u.firstName].filter(Boolean).join(" ");
  return fio || u.email || `ID:${u.id}`;
}

function Breadcrumbs({ path }) {
  const parts = (path || "").split("/").filter(Boolean);
  const crumbs = parts.map((slug, idx) => ({
    name: slug,
    to: `/inventory/${encodeURI(parts.slice(0, idx + 1).join("/"))}`,
  }));
  return (
    <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 flex flex-wrap gap-1">
      <Link to="/inventory" className="hover:underline">
        Склады
      </Link>
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          <span>/</span>
          <Link to={c.to} className="hover:underline">
            {c.name}
          </Link>
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
    axios
      .post(`${API}/categories`, { name: nm, parentPath })
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
                <button
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-neutral-700"
                >
                  Отмена
                </button>
                <button
                  onClick={submit}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white"
                >
                  Сохранить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ======= AddItemModal (unchanged except earlier modifications) ======= */
function AddItemModal({
  categoryId,
  categoryType,
  categoryName,
  onClose,
  onSave,
  forceWoodLayout,
}) {
  const woodRequired = forceWoodLayout;
  const requiredNonStorage = [];
  if (categoryType) requiredNonStorage.push("Размер");
  if (woodRequired) requiredNonStorage.push("шт");

  const [fields, setFields] = useState(
    requiredNonStorage.map((k) => ({ key: k, value: "" }))
  );
  const [name, setName] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [shelfId, setShelfId] = useState("");
  useEffect(() => {
    axios
      .get(`${API}/warehouses`, { params: { withShelves: 1 } })
      .then((res) => setWarehouses(res.data || []))
      .catch(() => { });
  }, []);
  const shelves = useMemo(() => {
    if (!warehouseId) return [];
    return warehouses.find((w) => w.id === Number(warehouseId))?.shelves || [];
  }, [warehouseId, warehouses]);
  useEffect(
    () => {
      if (shelves.every((s) => s.id !== Number(shelfId))) setShelfId("");
    },
    // eslint-disable-next-line
    [warehouseId, shelves]
  );

  const norm = (s) => normalize(s);
  const findIdx = (pred) => fields.findIndex(pred);
  const sizeIdx = findIdx((f) => ["размер", "size"].includes(norm(f.key)));
  const qtyIdx = findIdx((f) =>
    ["шт", "количество", "колличество", "quantity"].includes(norm(f.key))
  );
  const sizeStr = sizeIdx >= 0 ? fields[sizeIdx].value : "";
  const qtyStr = qtyIdx >= 0 ? fields[qtyIdx].value : "";

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

  function addField() {
    setFields((p) => [...p, { key: "", value: "" }]);
  }
  function changeField(i, f) {
    setFields((prev) => {
      const next = [...prev];
      if (requiredNonStorage.map(normalize).includes(norm(prev[i].key))) {
        next[i] = { ...f, key: prev[i].key };
      } else {
        next[i] = f;
      }
      return next;
    });
  }
  function removeField(i) {
    setFields((prev) => {
      const k = prev[i].key;
      if (requiredNonStorage.map(normalize).includes(norm(k))) return prev;
      return prev.filter((_, idx) => idx !== i);
    });
  }
  function ensureHas(key) {
    return fields.some((f) => norm(f.key) === norm(key));
  }

  async function save() {
    if (!name.trim()) return alert("Введите название предмета");
    if (!warehouseId) return alert("Выберите склад");
    if (!shelfId) return alert("Выберите полку");
    if (categoryType) {
      if (!ensureHas("размер") && !ensureHas("size"))
        return alert("Поле 'Размер' обязательно");
      if (!computeMetrics(sizeStr, categoryType))
        return alert("Формат 'Размер' неверный");
    }
    if (woodRequired) {
      if (
        !ensureHas("шт") &&
        !ensureHas("количество") &&
        !ensureHas("quantity")
      )
        return alert("Поле 'шт' обязательно");
      const qParsed = parseQuantity(qtyStr);
      if (!isFinite(qParsed) || qParsed <= 0)
        return alert("Введите корректное значение 'шт' > 0");
    }
    try {
      const res = await axios.post(`${API}/items`, {
        categoryId,
        name: name.trim(),
        fields,
        warehouseId: Number(warehouseId),
        shelfId: Number(shelfId),
      });
      onSave(res.data);
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "Ошибка сохранения");
    }
  }

  const disableSave =
    !name.trim() ||
    !warehouseId ||
    !shelfId ||
    (categoryType && !ensureHas("размер") && !ensureHas("size")) ||
    (categoryType && !computeMetrics(sizeStr, categoryType)) ||
    (woodRequired &&
      !(
        ensureHas("шт") ||
        ensureHas("количество") ||
        ensureHas("quantity")
      ));

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
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

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs mb-1 text-neutral-500">
              Склад *
            </label>
            <select
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setShelfId("");
              }}
              className="w-full px-3 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value="">-- выберите --</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 text-neutral-500">
              Полка *
            </label>
            <select
              value={shelfId}
              onChange={(e) => setShelfId(e.target.value)}
              disabled={!warehouseId || shelves.length === 0}
              className="w-full px-3 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800 disabled:opacity-50"
            >
              <option value="">-- выберите --</option>
              {shelves.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto pr-1 mb-3">
          {fields.map((field, i) => {
            const keyNorm = norm(field.key);
            const isSize = ["размер", "size"].includes(keyNorm);
            const isQty = ["шт", "количество", "колличество", "quantity"].includes(
              keyNorm
            );
            const isRequired = requiredNonStorage
              .map(norm)
              .includes(keyNorm);
            return (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) =>
                    changeField(i, { ...field, key: e.target.value })
                  }
                  disabled={isRequired}
                  placeholder={
                    isSize
                      ? "Размер"
                      : isQty
                        ? "шт / количество"
                        : "Характеристика"
                  }
                  className={`flex-1 px-3 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800 ${isSize ? "border-blue-400" : ""
                    } ${isRequired ? "opacity-80 cursor-not-allowed" : ""}`}
                />
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) =>
                    changeField(i, { ...field, value: e.target.value })
                  }
                  placeholder={
                    isSize
                      ? sizePlaceholder
                      : isQty
                        ? "Количество"
                        : "Значение"
                  }
                  className={`flex-1 px-3 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800 ${isSize ? "border-blue-400" : ""
                    }`}
                />
                <button
                  type="button"
                  onClick={() => removeField(i)}
                  disabled={isRequired}
                  title={
                    isRequired ? "Обязательное поле" : "Удалить характеристику"
                  }
                  className={`px-3 py-2 rounded-lg border dark:border-neutral-700 ${isRequired
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={addField}
          className="mt-1 mb-4 text-blue-600 hover:underline text-sm"
        >
          + Добавить характеристику
        </button>

        {categoryType && (
          <div className="mb-4 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 text-sm">
            <div className="text-neutral-500 mb-2">Предпросмотр расчётов:</div>
            {metrics ? (
              <div className="flex gap-6 flex-wrap">
                <div>
                  <span className="text-neutral-500">Пог. м:</span>{" "}
                  <b>{metrics.lm}</b>
                </div>
                <div>
                  <span className="text-neutral-500">м³:</span>{" "}
                  <b>{metrics.m3}</b>
                </div>
                <div>
                  <span className="text-neutral-500">м²:</span>{" "}
                  <b>{metrics.m2}</b>
                </div>
              </div>
            ) : (
              <div className="text-red-600">
                Укажите корректный “Размер” (
                {categoryType === "LOG"
                  ? "Диаметр x Длина"
                  : "Толщина x Ширина x Длина"}
                )
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600"
          >
            Отмена
          </button>
          <button
            onClick={save}
            disabled={disableSave}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
          >
            Сохранить
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ======= MoveItemModal ======= */
function MoveItemModal({ item, onClose, onMoved }) {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState(item.warehouseId || "");
  const [shelfId, setShelfId] = useState(item.shelfId || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios
      .get(`${API}/warehouses`, { params: { withShelves: 1 } })
      .then((res) => setWarehouses(res.data || []))
      .catch(() => { });
  }, []);

  const shelves = useMemo(() => {
    if (!warehouseId) return [];
    return (
      warehouses.find((w) => w.id === Number(warehouseId))?.shelves || []
    );
  }, [warehouseId, warehouses]);

  useEffect(() => {
    if (shelves.every((s) => s.id !== Number(shelfId))) {
      setShelfId("");
    }
  }, [shelves, shelfId]);

  async function save() {
    if (!warehouseId) return alert("Выберите склад");
    if (!shelfId) return alert("Выберите полку");
    setSaving(true);
    try {
      // Требуется backend endpoint PATCH /items/:id
      const res = await axios.patch(`${API}/items/${item.id}`, {
        warehouseId: Number(warehouseId),
        shelfId: Number(shelfId),
      });
      onMoved(res.data);
    } catch (e) {
      alert(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-6 w-full max-w-md"
      >
        <h3 className="text-lg font-semibold mb-4">
          Переместить: <span className="text-blue-600">{item.name}</span>
        </h3>

        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-neutral-500 mb-1">
              Склад
            </label>
            <select
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setShelfId("");
              }}
              className="w-full px-3 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value="">-- выберите склад --</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-neutral-500 mb-1">
              Полка
            </label>
            <select
              value={shelfId}
              onChange={(e) => setShelfId(e.target.value)}
              disabled={!warehouseId || shelves.length === 0}
              className="w-full px-3 py-2 rounded-lg border dark:border-neutral-700 dark:bg-neutral-800 disabled:opacity-50"
            >
              <option value="">-- выберите полку --</option>
              {shelves.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {!warehouseId && (
              <div className="text-xs text-neutral-500 mt-1">
                Выберите склад сначала
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-neutral-700"
          >
            Отмена
          </button>
          <button
            onClick={save}
            disabled={
              saving || !warehouseId || !shelfId
            }
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white disabled:opacity-50"
          >
            {saving ? "Сохранение..." : "Переместить"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ===== CSS helper (optional) =====
Add to global styles if you want the fade-in:
@keyframes fade-in { from { opacity:0; transform:translateY(4px);} to { opacity:1; transform:translateY(0);} }
.animate-fade-in { animation: fade-in .15s ease-out both; }
*/