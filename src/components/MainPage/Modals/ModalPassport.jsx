/* Создание техкарты: шаги со станком, материалы опционально, имя материала = имя + порода + размер. */
import React, { useEffect, useState, useMemo, useRef } from 'react';

const API_BASE = 'http://localhost:3001';

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now() + Math.random());
}

function composeItemDisplay(it) {
  if (!it) return '';
  const fields = it.fields || [];
  const breed = fields.find(f => ['порода', 'breed'].includes(f.key.toLowerCase()));
  const size = fields.find(f => ['размер', 'size'].includes(f.key.toLowerCase()));
  let name = it.name;
  if (breed?.value) name += ` ${breed.value}`;
  if (size?.value) name += ` ${size.value}`;
  return name.trim();
}

export default function ModalPassport({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [steps, setSteps] = useState([]);
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState('');
  const [machinesItems, setMachinesItems] = useState([]);
  const [machinesLoading, setMachinesLoading] = useState(false);
  const [machinesError, setMachinesError] = useState('');
  const [images, setImages] = useState([]);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  /* Load categories */
  useEffect(() => {
    let ignore = false;
    (async () => {
      setCatLoading(true); setCatError('');
      try {
        const r = await fetch(`${API_BASE}/categories`);
        if (!r.ok) throw new Error('Ошибка категорий');
        const data = await r.json();
        if (!ignore) setCategories(data || []);
      } catch (e) {
        if (!ignore) setCatError(e.message || 'Ошибка категорий');
      } finally {
        if (!ignore) setCatLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  /* Load machine items (categories with 'станк') */
  useEffect(() => {
    if (!categories.length) return;
    const machineCats = categories.filter(c =>
      c.name.toLowerCase().includes('станк') ||
      c.path.toLowerCase().includes('станк')
    );
    if (!machineCats.length) return;
    let ignore = false;
    (async () => {
      setMachinesLoading(true); setMachinesError('');
      try {
        const aggregated = [];
        for (const cat of machineCats) {
          const related = categories.filter(c =>
            c.path === cat.path || c.path.startsWith(cat.path + '/')
          );
          for (const rcat of related) {
            try {
              const r = await fetch(`${API_BASE}/items/by-category?categoryPath=${encodeURIComponent(rcat.path)}`);
              if (r.ok) {
                const arr = await r.json();
                if (Array.isArray(arr)) aggregated.push(...arr);
              }
            } catch { }
          }
        }
        const map = new Map(aggregated.map(i => [i.id, i]));
        if (!ignore) setMachinesItems(Array.from(map.values()));
      } catch (e) {
        if (!ignore) setMachinesError(e.message || 'Ошибка станков');
      } finally {
        if (!ignore) setMachinesLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [categories]);

  function addStep() {
    setSteps(prev => [
      ...prev,
      {
        tempId: randomId(),
        name: '',
        materials: [],
        fields: [],
        machineItem: null,
        categoryPath: null,
        includeChildren: false,
        localItems: [],
        localItemsLoading: false,
        localItemsError: '',
        localItemSearch: '',
        lastLoadKey: null,
      },
    ]);
  }

  function updateStep(tempId, patch) {
    setSteps(prev =>
      prev.map(s => (s.tempId === tempId ? { ...s, ...patch } : s)),
    );
  }
  function removeStep(tempId) {
    setSteps(prev => prev.filter(s => s.tempId !== tempId));
  }
  function moveStep(tempId, dir) {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.tempId === tempId);
      if (idx < 0) return prev;
      const ni = idx + dir;
      if (ni < 0 || ni >= prev.length) return prev;
      const copy = [...prev];
      const [m] = copy.splice(idx, 1);
      copy.splice(ni, 0, m);
      return copy;
    });
  }

  function addImages(files) {
    const arr = Array.from(files).map(f => ({
      file: f,
      tempId: randomId(),
      preview: URL.createObjectURL(f),
    }));
    setImages(prev => [...prev, ...arr]);
  }
  function removeImage(tempId) {
    setImages(prev => prev.filter(i => i.tempId !== tempId));
  }

  async function submit() {
    setSaving(true); setErr('');
    try {
      if (!name.trim()) throw new Error('Введите название');
      if (!steps.length) throw new Error('Добавьте шаг');

      steps.forEach((s, i) => {
        if (!s.name.trim()) throw new Error(`Название шага №${i + 1} обязательно`);
      });

      const payload = {
        name: name.trim(),
        steps: steps.map((s, idx) => ({
          order: idx + 1,
          name: s.name.trim(),
          machineItemId: s.machineItem?.id || undefined,
          materials: (s.materials || [])
            .filter(m => m.item?.id)
            .map(m => ({ itemId: m.item.id })),
          fields: (s.fields || []).filter(f => f.key && f.value),
        })),
      };
      const r = await fetch(`${API_BASE}/tech-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
      const created = await r.json();

      if (images.length) {
        const fd = new FormData();
        images.forEach(img => fd.append('images', img.file));
        fetch(`${API_BASE}/tech-cards/${created.id}/images`, {
          method: 'POST',
          body: fd,
        }).catch(() => { });
      }

      onCreated?.(created);
      onClose?.();
    } catch (e) {
      setErr(e.message || 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  if (catLoading && !categories.length) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 text-sm">
          Загрузка категорий...
        </div>
      </div>
    );
  }
  if (catError && !categories.length) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 space-y-4">
          <div className="text-sm text-red-600">{catError}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded bg-black text-white dark:bg-white dark:text-black text-sm"
          >
            Перезагрузить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !saving && onClose?.()}
      />
      <div
        className="relative w-[min(1400px,96vw)] max-h-[96vh] overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="text-lg font-semibold">Создание техкарты</h3>
          <button
            onClick={() => !saving && onClose?.()}
            className="px-2 py-1 rounded text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-8">
          {err && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-200">
              {err}
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-300">
              Название техкарты
            </span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Карта — Продажа комплекта"
              disabled={saving}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </label>

          <ImageSection
            images={images}
            addImages={files => addImages(files)}
            removeImage={id => removeImage(id)}
            disabled={saving}
          />

          <div className="space-y-5">
            {steps.map((s, i) => (
              <StepEditor
                key={s.tempId}
                index={i + 1}
                step={s}
                categories={categories}
                machinesItems={machinesItems}
                machinesLoading={machinesLoading}
                machinesError={machinesError}
                updateStep={updateStep}
                removeStep={removeStep}
                moveStep={moveStep}
                disabled={saving}
              />
            ))}
            {steps.length === 0 && (
              <div className="text-xs text-neutral-500">
                Нет шагов — нажмите "Добавить шаг"
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <button
            onClick={addStep}
            disabled={saving}
            className="px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            + Добавить шаг
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => !saving && onClose?.()}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Отмена
            </button>
            <button
              onClick={submit}
              disabled={saving || !name.trim() || steps.length === 0}
              className="px-5 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm disabled:opacity-50"
            >
              {saving ? 'Сохранение…' : 'Создать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Step Editor */
function StepEditor({
  index,
  step,
  categories,
  machinesItems,
  machinesLoading,
  machinesError,
  updateStep,
  removeStep,
  moveStep,
  disabled,
}) {
  const abortRef = useRef(null);
  const inflightRef = useRef(null);

  function setPatch(patch) {
    updateStep(step.tempId, patch);
  }

  const flatCategories = useMemo(
    () => categories.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [categories]
  );

  const itemsFiltered = useMemo(() => {
    const q = (step.localItemSearch || '').trim().toLowerCase();
    if (!q) return step.localItems || [];
    return (step.localItems || []).filter(it =>
      it.name.toLowerCase().includes(q) ||
      (it.fields || []).some(f => f.value.toLowerCase().includes(q)),
    );
  }, [step.localItems, step.localItemSearch]);

  function handleCategoryChange(path) {
    setPatch({
      categoryPath: path || null,
      includeChildren: false,
      localItems: [],
      localItemsLoading: false,
      localItemsError: '',
      localItemSearch: '',
      lastLoadKey: null,
    });
  }

  useEffect(() => {
    if (!step.categoryPath) {
      setPatch({
        localItems: [],
        localItemsLoading: false,
        localItemsError: '',
        lastLoadKey: null,
      });
      return;
    }
    const loadKey = `${step.categoryPath}:${step.includeChildren ? 1 : 0}`;
    if (step.lastLoadKey === loadKey) return;
    let ignore = false;

    async function load() {
      if (inflightRef.current === loadKey) return;
      inflightRef.current = loadKey;

      if (abortRef.current) {
        try { abortRef.current.abort(); } catch { }
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setPatch({ localItemsLoading: true, localItemsError: '' });

      try {
        let aggregated = [];
        if (!step.includeChildren) {
          const r = await fetch(`${API_BASE}/items/by-category?categoryPath=${encodeURIComponent(step.categoryPath)}`, { signal: controller.signal });
          if (!r.ok) throw new Error('Не удалось загрузить предметы');
          const data = await r.json();
          aggregated = Array.isArray(data) ? data : [];
        } else {
          const related = categories.filter(c =>
            c.path === step.categoryPath ||
            c.path.startsWith(step.categoryPath + '/'),
          );
          for (const rc of related) {
            try {
              const r = await fetch(`${API_BASE}/items/by-category?categoryPath=${encodeURIComponent(rc.path)}`, { signal: controller.signal });
              if (r.ok) {
                const arr = await r.json();
                if (Array.isArray(arr)) aggregated.push(...arr);
              }
            } catch { }
          }
          const map = new Map(aggregated.map(i => [i.id, i]));
          aggregated = Array.from(map.values());
        }
        if (!ignore) {
          setPatch({
            localItems: aggregated,
            localItemsLoading: false,
            localItemsError: '',
            lastLoadKey: loadKey,
          });
        }
      } catch (e) {
        if (!ignore && e.name !== 'AbortError') {
          setPatch({
            localItems: [],
            localItemsLoading: false,
            localItemsError: e.message || 'Ошибка загрузки',
            lastLoadKey: null,
          });
        }
      } finally {
        inflightRef.current = null;
      }
    }
    load();
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.categoryPath, step.includeChildren, categories]);

  function addMaterial() {
    setPatch({
      materials: [...(step.materials || []), { tempId: randomId(), item: null }],
    });
  }
  function updateMaterial(tempId, patch) {
    const copy = [...(step.materials || [])];
    const i = copy.findIndex(m => m.tempId === tempId);
    if (i >= 0) {
      copy[i] = { ...copy[i], ...patch };
      setPatch({ materials: copy });
    }
  }
  function removeMaterial(tempId) {
    setPatch({
      materials: (step.materials || []).filter(m => m.tempId !== tempId),
    });
  }

  function addField() {
    setPatch({
      fields: [...(step.fields || []), { key: '', value: '', _id: randomId() }],
    });
  }
  function updateField(idx, patch) {
    const copy = [...(step.fields || [])];
    copy[idx] = { ...copy[idx], ...patch };
    setPatch({ fields: copy });
  }
  function removeField(idx) {
    const copy = [...(step.fields || [])];
    copy.splice(idx, 1);
    setPatch({ fields: copy });
  }

  const currentCatLabel = step.categoryPath
    ? (categories.find(c => c.path === step.categoryPath)?.name || step.categoryPath)
    : 'Не выбрана';

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 bg-white dark:bg-neutral-900 space-y-6">
      <div className="flex items-center justify-between">
        <strong className="text-sm">Шаг {index}</strong>
        <div className="flex items-center gap-2">
          <button
            onClick={() => moveStep(step.tempId, -1)}
            disabled={disabled}
            className="px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm disabled:opacity-40"
          >
            ↑
          </button>
          <button
            onClick={() => moveStep(step.tempId, 1)}
            disabled={disabled}
            className="px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm disabled:opacity-40"
          >
            ↓
          </button>
          <button
            onClick={() => removeStep(step.tempId)}
            disabled={disabled}
            className="px-2 py-1 rounded text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm">Название шага</span>
        <input
          value={step.name}
          onChange={e => setPatch({ name: e.target.value })}
          placeholder="Напр: Продать доски"
          disabled={disabled}
          className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm outline-none"
        />
      </label>

      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Станок (опционально)
        </span>
        <select
          value={step.machineItem?.id || ''}
          onChange={e => {
            const val = e.target.value;
            const it =
              machinesItems.find(m => String(m.id) === val) || null;
            setPatch({ machineItem: it });
          }}
          disabled={disabled || machinesLoading || machinesError}
          className="px-2 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm w-full"
        >
          <option value="">
            {machinesLoading
              ? 'Загрузка...'
              : machinesError
                ? `Ошибка: ${machinesError}`
                : '-- не выбрано --'}
          </option>
          {!machinesLoading &&
            !machinesError &&
            machinesItems.map(it => (
              <option key={it.id} value={it.id}>
                {composeItemDisplay(it)} (ост: {it.quantity ?? 0})
              </option>
            ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[240px]">
            <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">
              Категория материалов (опционально)
            </span>
            <select
              value={step.categoryPath || ''}
              onChange={e => handleCategoryChange(e.target.value || null)}
              disabled={disabled}
              className="px-2 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm w-full"
            >
              <option value="">-- не выбрана --</option>
              {flatCategories.map(c => (
                <option key={c.id} value={c.path}>
                  {c.name} ({c.path})
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              disabled={disabled || !step.categoryPath}
              checked={step.includeChildren}
              onChange={e =>
                setPatch({
                  includeChildren: e.target.checked,
                  lastLoadKey: null,
                })
              }
              className="accent-black dark:accent-white"
            />
            Подкатегории
          </label>
          <div className="text-xs text-neutral-500">
            {currentCatLabel}
          </div>
        </div>
        {step.categoryPath && (
          <div className="space-y-1">
            <input
              value={step.localItemSearch}
              onChange={e =>
                setPatch({ localItemSearch: e.target.value })
              }
              disabled={disabled || step.localItemsLoading}
              placeholder="Поиск предметов..."
              className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs outline-none"
            />
            <div className="text-[11px] text-neutral-500">
              Найдено: {itemsFiltered.length}
              {step.localItemsLoading && ' • загрузка...'}
              {step.localItemsError && ` • ошибка: ${step.localItemsError}`}
            </div>
          </div>
        )}
        {!step.categoryPath && (
          <div className="text-[11px] text-neutral-500">
            Можно не выбирать категорию и не добавлять материалы.
          </div>
        )}
      </div>

      {/* Materials */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <strong className="text-sm">Материалы (опционально)</strong>
          <button
            onClick={addMaterial}
            disabled={disabled || !step.categoryPath || step.localItemsLoading}
            className="text-xs px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40"
          >
            + Материал
          </button>
        </div>
        {(!step.materials || step.materials.length === 0) && (
          <div className="text-xs text-neutral-500">
            Материалов нет (не обязательно)
          </div>
        )}
        <div className="space-y-3">
          {(step.materials || []).map(m => {
            let statusText = '-- предмет --';
            if (step.localItemsLoading) statusText = 'Загрузка...';
            else if (step.localItemsError) statusText = `Ошибка: ${step.localItemsError}`;
            else if (
              step.categoryPath &&
              (step.localItems || []).length === 0
            )
              statusText = 'Нет предметов';
            return (
              <div
                key={m.tempId}
                className="flex flex-col md:flex-row gap-2 md:items-center border rounded-lg p-2 bg-neutral-50 dark:bg-neutral-800/40"
              >
                <div className="flex-1">
                  <select
                    value={m.item?.id || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const it =
                        (step.localItems || []).find(it => String(it.id) === val) ||
                        null;
                      updateMaterial(m.tempId, { item: it });
                    }}
                    disabled={
                      disabled || !step.categoryPath || step.localItemsLoading
                    }
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-sm"
                  >
                    <option value="">{statusText}</option>
                    {itemsFiltered.map(it => (
                      <option key={it.id} value={it.id}>
                        {composeItemDisplay(it)} (ост: {it.quantity ?? 0})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  {m.item && (
                    <span className="text-xs px-2 py-1 rounded bg-neutral-200 dark:bg-neutral-700">
                      {composeItemDisplay(m.item)}
                    </span>
                  )}
                  <button
                    onClick={() => removeMaterial(m.tempId)}
                    disabled={disabled}
                    className="px-2 py-1 rounded text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <strong className="text-sm">Доп. поля</strong>
          <button
            onClick={addField}
            disabled={disabled}
            className="text-xs px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40"
          >
            + Поле
          </button>
        </div>
        {(!step.fields || step.fields.length === 0) && (
          <div className="text-xs text-neutral-500">Нет полей</div>
        )}
        <div className="space-y-2">
          {(step.fields || []).map((f, i) => (
            <div key={f._id || i} className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                value={f.key}
                onChange={e => updateField(i, { key: e.target.value })}
                disabled={disabled}
                placeholder="Ключ"
                className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm outline-none"
              />
              <input
                value={f.value}
                onChange={e => updateField(i, { value: e.target.value })}
                disabled={disabled}
                placeholder="Значение"
                className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm outline-none md:col-span-2"
              />
              <div className="md:col-span-3 flex justify-end">
                <button
                  onClick={() => removeField(i)}
                  disabled={disabled}
                  className="px-3 py-1 rounded text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Images */
function ImageSection({ images, addImages, removeImage, disabled }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Изображения</span>
        <label className="text-xs px-3 py-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer">
          + Добавить
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            disabled={disabled}
            onChange={e => {
              if (e.target.files?.length) addImages(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {images.length === 0 && (
        <div className="text-xs text-neutral-500">Нет изображений</div>
      )}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {images.map((img, i) => (
            <div
              key={img.tempId}
              className="relative group border rounded-lg overflow-hidden"
            >
              <img
                src={img.preview}
                alt=""
                className="object-cover w-full h-32"
              />
              <div className="absolute inset-0 hidden group-hover:flex justify-end p-1">
                <button
                  onClick={() => removeImage(img.tempId)}
                  disabled={disabled}
                  className="bg-red-600 text-white text-xs px-2 py-1 rounded shadow"
                >
                  Удалить
                </button>
              </div>
              <div className="absolute bottom-0 left-0 bg-black/50 text-white text-[10px] px-1">
                {i + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}