import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

const API = "http://localhost:3001";

/* ------------ Helpers ------------- */
function normalize(s = "") {
  return String(s).trim().toLowerCase();
}

function detectCategoryType(name, path) {
  const n = normalize(name);
  const p = normalize(path);
  if (n.includes("круглый") || p.includes("круглый")) return "LOG";
  if (
    n.includes("пиломатериал") ||
    p.includes("пиломатериал") ||
    n.includes("строган") ||
    p.includes("строган") ||
    n.includes("производственный участок") ||
    p.includes("производственный участок") ||
    n.includes("магазин внутренний склад") ||
    p.includes("магазин внутренний склад") ||
    n.includes("магазин открытая площадка") ||
    p.includes("магазин открытая площадка") ||
    n.includes("под навесом") ||
    p.includes("под навесом")
  )
    return "LUMBER";
  return null;
}

// Категории инструментальные / контейнерные с обязательным полем "Размер"
function isSizeOnlyCategoryName(name = "", path = "") {
  const n = normalize(name);
  const p = normalize(path);
  return (
    n.includes("склад № 8") ||
    n.includes("склад №8") ||
    n.includes("склад 8") ||
    n.includes("склад № 9") ||
    n.includes("склад №9") ||
    n.includes("склад 9") ||
    p.includes("склад-№-8") ||
    p.includes("склад-№-9")
  );
}

// (Пока не используется в логике, оставлено на будущее)
function isWoodCategory(name, path) {
  const n = normalize(name);
  const p = normalize(path);
  if (n.includes("круглый") || p.includes("круглый")) return true;
  if (n.includes("пиломатериал") || p.includes("пиломатериал")) return true;
  if (n.includes("строган") || p.includes("строган")) return true;
  if (
    (n.includes("влажн") || p.includes("влажн")) &&
    (n.includes("пиломатериал") || p.includes("пиломатериал"))
  )
    return true;
  if (n.includes("производственный участок") || p.includes("производственный-участок")) return true;
  if (n.includes("магазин внутренний склад") || p.includes("магазин-внутренний-склад")) return true;
  if (n.includes("магазин открытая площадка") || p.includes("магазин-открытая-площадка")) return true;
  if (n.includes("под навесом") || p.includes("под-навесом")) return true;
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
  return num / 1000; // трактуем как мм по умолчанию
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

/* ---------- Component ---------- */
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

  const [contextMenu, setContextMenu] = useState(null);
  const [moveItem, setMoveItem] = useState(null);

  const [currentUserRole, setCurrentUserRole] = useState(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const r = await axios.get(`${API}/auth/me`, { headers });
        if (!ignore) setCurrentUserRole(r.data?.role || null);
      } catch {
        if (!ignore) setCurrentUserRole(null);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

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
              .filter((k) => {
                const nk = normalize(k);
                return (
                  !["шт", "количество", "колличество", "quantity"].includes(nk) &&
                  nk !== "склад" &&
                  nk !== "полка"
                );
              })
          )
        );
        setAllKeys(keysRaw);
      } catch (e) {
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

  const categoryType = categoryInfo.type;
  const isWoodType = categoryType === "LOG" || categoryType === "LUMBER";
  const sizeOnly = !isWoodType && isSizeOnlyCategoryName(categoryInfo.name, categoryInfo.path);
  const isWood = isWoodType;
  const showMetrics = isWoodType;

  const findFieldValue = (fields, variants) => {
    const normVariants = variants.map(normalize);
    const f = fields.find((fld) => normVariants.includes(normalize(fld.key)));
    return f ? f.value : null;
  };

  function handleDelete(itemId) {
    if (currentUserRole !== "ADMIN") {
      alert("Удаление доступно только администратору");
      return;
    }
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
        <p className="mb-4 text-gray-500 text-center text-lg">Нет предметов в этой категории</p>
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
                {showMetrics && (
                  <>
                    <th className="px-4 py-3 text-right font-semibold">Пог. м</th>
                    <th className="px-4 py-3 text-right font-semibold">м³</th>
                    <th className="px-4 py-3 text-right font-semibold">м²</th>
                  </>
                )}
                <th className="px-4 py-3 text-right font-semibold">Кол-во (шт)</th>
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
              const qtyFieldLegacy = getFieldAny(item, ["шт", "количество", "колличество", "quantity"]);
              let qty = item.quantity ?? 0;
              if ((!qty || qty <= 0) && qtyFieldLegacy) {
                const parsedLegacy = parseQuantity(qtyFieldLegacy.value);
                if (isFinite(parsedLegacy) && parsedLegacy > 0) qty = parsedLegacy;
              }
              if (!isFinite(qty) || qty <= 0) qty = 0;

              const baseMetrics = showMetrics ? computeMetrics(sizeField?.value, categoryType) : null;
              const metrics = baseMetrics
                ? {
                  lm: qty > 0 && baseMetrics.lm != null ? round3(baseMetrics.lm * qty) : baseMetrics.lm,
                  m3: qty > 0 && baseMetrics.m3 != null ? round3(baseMetrics.m3 * qty) : baseMetrics.m3,
                  m2: qty > 0 && baseMetrics.m2 != null ? round3(baseMetrics.m2 * qty) : baseMetrics.m2,
                }
                : null;

              const breed = isWood
                ? findFieldValue(item.fields, ["порода", "порода древесины", "wood", "breed"])
                : null;

              const warehouseName = item.warehouse?.name || "—";
              const shelfName = item.shelf?.name || "—";
              const respUser = item.warehouse?.responsible
                ? formatUser(item.warehouse.responsible)
                : "—";

              const baseRowClass = `transition-colors cursor-context-menu hover:bg-gray-50 dark:hover:bg-neutral-800 ${idx % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-gray-50 dark:bg-neutral-800"
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
                      return <td key={key} className="px-4 py-3">{field ? field.value : "—"}</td>;
                    })}
                    {showMetrics && (
                      <>
                        <td className="px-4 py-3 text-right">{metrics ? metrics.lm : "—"}</td>
                        <td className="px-4 py-3 text-right">{metrics ? metrics.m3 : "—"}</td>
                        <td className="px-4 py-3 text-right">{metrics ? metrics.m2 : "—"}</td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right">{qty > 0 ? qty : "—"}</td>
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
                  <td className="px-4 py-3 text-right">{qty > 0 ? qty : "—"}</td>
                  <td className="px-4 py-3 text-right">{metrics ? metrics.lm : "—"}</td>
                  <td className="px-4 py-3 text-right">{metrics ? metrics.m3 : "—"}</td>
                  <td className="px-4 py-3 text-right">{metrics ? metrics.m2 : "—"}</td>
                  <td className="px-4 py-3">{warehouseName}</td>
                  <td className="px-4 py-3">{shelfName}</td>
                  <td className="px-4 py-3">{respUser}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 w-56 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
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

          {currentUserRole === "ADMIN" && (
            <button
              onClick={() => {
                handleDelete(contextMenu.item.id);
                closeContextMenu();
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              Удалить
            </button>
          )}

          <button
            onClick={closeContextMenu}
            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            Закрыть
          </button>
          {currentUserRole !== "ADMIN" && (
            <div className="px-3 pt-1 pb-2 text-[10px] text-neutral-400 border-t dark:border-neutral-700">
              Удаление доступно только администратору
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showAddItemModal && (
          <AddItemModal
            categoryId={Number(categoryInfo.id)}
            categoryType={categoryType}
            categoryName={categoryInfo.name}
            onClose={() => setShowAddItemModal(false)}
            onSave={(newItem) => {
              setItems((items) => [...items, newItem]);
              setShowAddItemModal(false);
            }}
            forceWoodLayout={isWoodType}
            sizeOnly={sizeOnly}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {moveItem && (
          <MoveItemModal
            item={moveItem}
            onClose={() => setMoveItem(null)}
            onMoved={(updated) => {
              setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
              setMoveItem(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- UI helpers ---------- */
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

/* ---------- AddItemModal ---------- */
function AddItemModal({
  categoryId,
  categoryType,
  categoryName,
  onClose,
  onSave,
  forceWoodLayout,
  sizeOnly = false,
}) {
  const isWoodType = forceWoodLayout && (categoryType === "LOG" || categoryType === "LUMBER");
  const hasSizeField = isWoodType || sizeOnly || !!categoryType;

  const [quantityUnit, setQuantityUnit] = useState("pcs"); // pcs | lm
  const [quantityLm, setQuantityLm] = useState("");

  const initialFields = [];
  if (isWoodType) initialFields.push({ key: "Порода", value: "" });
  if (hasSizeField) initialFields.push({ key: "Размер", value: "" });

  const [fields, setFields] = useState(initialFields);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");

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

  useEffect(() => {
    if (shelves.every((s) => s.id !== Number(shelfId))) setShelfId("");
  }, [warehouseId, shelves, shelfId]);

  const sizeIdx = fields.findIndex((f) => ["размер", "size"].includes(normalize(f.key)));
  const breedIdx = fields.findIndex((f) => ["порода", "breed"].includes(normalize(f.key)));

  function changeField(i, patch) {
    setFields((prev) => {
      const next = [...prev];
      next[i] = patch;
      return next;
    });
  }
  function addField() {
    setFields((prev) => [...prev, { key: "", value: "" }]);
  }

  function removeField(i) {
    const keyLower = normalize(fields[i].key);
    if (isWoodType && ["порода", "breed"].includes(keyLower)) return;
    if (hasSizeField && ["размер", "size"].includes(keyLower)) return;
    setFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  function ensureHas(key) {
    return fields.some((f) => normalize(f.key) === normalize(key));
  }

  function upsertField(key, value) {
    const nk = normalize(key);
    setFields((prev) => {
      const idx = prev.findIndex((f) => normalize(f.key) === nk);
      if (idx === -1) return [...prev, { key, value }];
      const next = [...prev];
      next[idx] = { key: next[idx].key, value };
      return next;
    });
  }

  function getSizeValue() {
    if (sizeIdx >= 0) return fields[sizeIdx].value;
    return "";
  }

  const parsedSize = useMemo(
    () => (hasSizeField ? parseSize(getSizeValue(), categoryType) : null),
    [fields, sizeIdx, hasSizeField, categoryType]
  );

  const perPieceLength =
    parsedSize && (categoryType === "LOG" ? parsedSize.l : categoryType === "LUMBER" ? parsedSize.l : null);

  const canUseLm = isWoodType && perPieceLength && perPieceLength > 0;

  async function save() {
    if (!name.trim()) return alert("Введите название");
    if (!warehouseId) return alert("Выберите склад");
    if (!shelfId) return alert("Выберите полку");

    if (isWoodType && breedIdx === -1) return alert('Поле "Порода" обязательно');
    if (isWoodType && breedIdx >= 0 && !fields[breedIdx].value.trim())
      return alert('Заполните "Порода"');

    if (hasSizeField && (!ensureHas("размер") && !ensureHas("size")))
      return alert('Поле "Размер" обязательно');
    if (hasSizeField && sizeIdx >= 0 && !fields[sizeIdx].value.trim())
      return alert('Заполните "Размер"');

    let quantityToSend = 0;

    if (quantityUnit === "pcs") {
      const q = Number(quantity);
      if (!isFinite(q) || q <= 0) return alert("Количество (шт) должно быть > 0");
      quantityToSend = q;
    } else if (quantityUnit === "lm") {
      if (!canUseLm) return alert("Невозможно вычислить длину: заполните корректно поле Размер");
      const lmVal = Number(quantityLm);
      if (!isFinite(lmVal) || lmVal <= 0) return alert("Линейные метры должны быть > 0");
      let pieces = lmVal / perPieceLength;
      pieces = Number(pieces.toFixed(3)); // допускаем дробные; заменить на Math.round(...) если нужно целое
      if (!isFinite(pieces) || pieces <= 0) return alert("Не удалось вычислить количество штук");
      quantityToSend = pieces;
      upsertField("Линейные метры", String(lmVal));
    }

    try {
      const res = await axios.post(`${API}/items`, {
        categoryId,
        name: name.trim(),
        fields,
        warehouseId: Number(warehouseId),
        shelfId: Number(shelfId),
        quantity: quantityToSend,
      });
      onSave(res.data);
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "Ошибка сохранения");
    }
  }

  const disableSave = (() => {
    if (!name.trim() || !warehouseId || !shelfId) return true;
    if (isWoodType) {
      if (breedIdx === -1) return true;
      if (breedIdx >= 0 && !fields[breedIdx].value.trim()) return true;
    }
    if (hasSizeField) {
      if (!ensureHas("размер") && !ensureHas("size")) return true;
      if (sizeIdx >= 0 && !fields[sizeIdx].value.trim()) return true;
    }
    if (quantityUnit === "pcs") {
      const q = Number(quantity);
      if (!isFinite(q) || q <= 0) return true;
    } else if (quantityUnit === "lm") {
      if (!canUseLm) return true;
      const lmVal = Number(quantityLm);
      if (!isFinite(lmVal) || lmVal <= 0) return true;
    }
    return false;
  })();

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ scale: .9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: .9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        className="bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-2xl w-full max-w-xl"
      >
        <h3 className="text-xl font-bold mb-5 text-center">
          Новый предмет{categoryName ? ` — ${categoryName}` : ''}
        </h3>

        <div className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase font-medium tracking-wide text-neutral-500">Название *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Напр. Доска"
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              />
            </div>

            {quantityUnit === "pcs" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs uppercase font-medium tracking-wide text-neutral-500">
                  Количество (шт) *
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="Напр. 100"
                  className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
                />
              </div>
            )}

            {quantityUnit === "lm" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs uppercase font-medium tracking-wide text-neutral-500">
                  Линейные метры *
                </label>
                <input
                  type="number"
                  min={0.001}
                  step={0.001}
                  value={quantityLm}
                  onChange={e => setQuantityLm(e.target.value)}
                  placeholder="Напр. 56.4"
                  className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
                />
                {isWoodType && perPieceLength && (
                  <div className="text-[11px] text-neutral-500">
                    Длина одной единицы: {perPieceLength} м
                  </div>
                )}
              </div>
            )}
          </div>

          {isWoodType && (
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  value="pcs"
                  checked={quantityUnit === "pcs"}
                  onChange={() => setQuantityUnit("pcs")}
                />
                <span>В штуках</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  value="lm"
                  checked={quantityUnit === "lm"}
                  onChange={() => setQuantityUnit("lm")}
                  disabled={!canUseLm}
                />
                <span className={canUseLm ? "" : "opacity-50"}>В пог. метрах</span>
              </label>
              {!canUseLm && (
                <span className="text-[11px] text-red-500">
                  Для ввода в метрах заполните корректно поле Размер.
                </span>
              )}
            </div>
          )}

          {(isWoodType || hasSizeField) && (
            <div className="grid md:grid-cols-2 gap-4">
              {isWoodType && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs uppercase font-medium tracking-wide text-neutral-500">
                    Порода *
                  </label>
                  <input
                    value={breedIdx >= 0 ? fields[breedIdx].value : ""}
                    onChange={(e) => {
                      if (breedIdx >= 0) {
                        changeField(breedIdx, {
                          key: fields[breedIdx].key,
                          value: e.target.value,
                        });
                      } else {
                        setFields((prev) => [
                          ...prev,
                          { key: "Порода", value: e.target.value },
                        ]);
                      }
                    }}
                    placeholder="Напр. Сосна"
                    className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
                  />
                </div>
              )}

              {hasSizeField && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs uppercase font-medium tracking-wide text-neutral-500">
                    Размер *
                  </label>
                  <input
                    value={sizeIdx >= 0 ? fields[sizeIdx].value : ""}
                    onChange={(e) => {
                      if (sizeIdx >= 0) {
                        changeField(sizeIdx, {
                          key: fields[sizeIdx].key,
                          value: e.target.value,
                        });
                      } else {
                        setFields((prev) => [
                          ...prev,
                          { key: "Размер", value: e.target.value },
                        ]);
                      }
                    }}
                    placeholder={
                      categoryType === "LOG"
                        ? "Диаметр x Длина (мм) напр. 300x6000"
                        : categoryType === "LUMBER"
                          ? "Толщина x Ширина x Длина (мм) напр. 50x150x6000"
                          : "Напр. 600x400x250"
                    }
                    className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase font-medium tracking-wide text-neutral-500">
                Склад *
              </label>
              <select
                value={warehouseId}
                onChange={(e) => {
                  setWarehouseId(e.target.value);
                  setShelfId("");
                }}
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              >
                <option value="">-- выберите --</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase font-medium tracking-wide text-neutral-500">
                Полка *
              </label>
              <select
                value={shelfId}
                onChange={(e) => setShelfId(e.target.value)}
                disabled={!warehouseId}
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm disabled:opacity-50"
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

          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase text-neutral-500">
                Доп. характеристики
              </span>
              <button
                onClick={addField}
                className="text-xs px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                type="button"
              >
                + Добавить
              </button>
            </div>
            <div className="max-h-44 overflow-auto pr-1 space-y-2">
              {fields.map((f, i) => {
                const keyLower = normalize(f.key);
                const isBreed = ["порода", "breed"].includes(keyLower);
                const isSize = ["размер", "size"].includes(keyLower);
                const protectedField =
                  (isWoodType && isBreed) || (hasSizeField && isSize);
                return (
                  <div key={i} className="flex gap-2">
                    <input
                      value={f.key}
                      disabled={protectedField}
                      onChange={(e) =>
                        changeField(i, { key: e.target.value, value: f.value })
                      }
                      placeholder="Ключ"
                      className={`w-40 rounded-lg border px-3 py-1.5 text-xs ${protectedField
                          ? "bg-neutral-100 dark:bg-neutral-800 opacity-70"
                          : "bg-white dark:bg-neutral-800"
                        } border-neutral-300 dark:border-neutral-700`}
                    />
                    <input
                      value={f.value}
                      onChange={(e) =>
                        changeField(i, { key: f.key, value: e.target.value })
                      }
                      placeholder="Значение"
                      className="flex-1 rounded-lg border px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
                    />
                    <button
                      type="button"
                      onClick={() => removeField(i)}
                      disabled={protectedField}
                      className="px-2 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              {fields.length === 0 && (
                <div className="text-[11px] text-neutral-500">Нет характеристик</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-sm"
          >
            Отмена
          </button>
          <button
            onClick={save}
            disabled={disableSave}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm shadow disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------- MoveItemModal ---------- */
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
    return warehouses.find((w) => w.id === Number(warehouseId))?.shelves || [];
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
            disabled={saving || !warehouseId || !shelfId}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white disabled:opacity-50"
          >
            {saving ? "Сохранение..." : "Переместить"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}