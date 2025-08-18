import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = 'http://localhost:3001';
const DEFAULT_EXCLUDE = 'станки,инструмент';

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now() + Math.random());
}

export default function ModalPassport({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [steps, setSteps] = useState([]);
  const [operations, setOperations] = useState([]);
  const [categories, setCategories] = useState([]); 
  const [materials, setMaterials] = useState([]);   
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let ignore = false;
    setErr('');
    setName('');
    setSteps([]);
    (async () => {
      try {
        const [opsRes, catsRes, matsRes, unitsRes] = await Promise.all([
          fetch(`${API_BASE}/operations`),
          fetch(`${API_BASE}/categories/available?exclude=${encodeURIComponent(DEFAULT_EXCLUDE)}`),
          fetch(`${API_BASE}/items/available?exclude=${encodeURIComponent(DEFAULT_EXCLUDE)}`),
          fetch(`${API_BASE}/units/available?exclude=${encodeURIComponent(DEFAULT_EXCLUDE)}`),
        ]);
        if (!opsRes.ok || !catsRes.ok || !matsRes.ok || !unitsRes.ok) throw new Error('Не удалось загрузить справочники');
        const [ops, cats, mats, unitList] = await Promise.all([
          opsRes.json(),
          catsRes.json(),
          matsRes.json(),
          unitsRes.json(),
        ]);
        if (!ignore) {
          setOperations(ops);
          setCategories(cats);
          setMaterials(mats);   // каждый item включает { category: { id, name, path } }
          setUnits(unitList);
        }
      } catch (e) {
        if (!ignore) setErr(e?.message || 'Ошибка загрузки данных');
      }
    })();
    return () => { ignore = true; };
  }, []);

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        tempId: randomId(),
        name: '',
        operationId: '',
        machineItemId: '',
        // локальный фильтр категории для материалов в этом шаге (path)
        materialsCategoryFilter: '',
        materials: [],
        fields: [],
      },
    ]);
  };

  const updateStep = (tempId, patch) => {
    setSteps((prev) => prev.map((s) => (s.tempId === tempId ? { ...s, ...patch } : s)));
  };

  const removeStep = (tempId) => {
    setSteps((prev) => prev.filter((s) => s.tempId !== tempId));
  };

  const moveStep = (tempId, dir) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.tempId === tempId);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(newIdx, 0, moved);
      return copy;
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErr('');
    try {
      if (!name.trim()) throw new Error('Укажите название паспорта');
      if (steps.length === 0) throw new Error('Добавьте хотя бы один шаг');
      for (let i = 0; i < steps.length; i++) {
        if (!steps[i].name?.trim()) throw new Error(`Укажите название для шага ${i + 1}`);
      }

      const payload = {
        name: name.trim(),
        steps: steps.map((s) => ({
          name: s.name.trim(),
          operationId: s.operationId ? Number(s.operationId) : undefined,
          machineItemId: s.machineItemId ? Number(s.machineItemId) : undefined,
          materials: (s.materials || []).map((m) => ({
            materialItemId: Number(m.materialItemId),
            quantity: Number(m.quantity),
            unitId: m.unitId ? Number(m.unitId) : undefined,
          })),
          fields: (s.fields || []).filter((f) => f.key && f.value),
        })),
      };

      const r = await fetch(`${API_BASE}/tech-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error((await r.text()) || 'Не удалось создать паспорт');
      const data = await r.json();

      onCreated?.(data);
      onClose?.();
    } catch (e) {
      setErr(e?.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-[min(1000px,95vw)] max-h-[90vh] overflow-auto rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-5 py-4 bg-white/90 dark:bg-neutral-900/90 backdrop-blur">
          <h3 className="text-lg font-semibold">Создание паспорта</h3>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Закрыть">✕</button>
        </div>

        <div className="px-5 py-4">
          {err ? (
            <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
              {err}
            </div>
          ) : null}

          <label className="mb-3 flex flex-col gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-300">Название</span>
            <input
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Техкарта — Шаблон №1"
            />
          </label>

          <div className="my-3">
            <button onClick={addStep} className="rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700">
              + Добавить шаг
            </button>
          </div>

          <div className="space-y-3">
            {steps.map((step, idx) => (
              <StepEditor
                key={step.tempId}
                index={idx + 1}
                step={step}
                operations={operations}
                categories={categories}
                materials={materials}
                units={units}
                onChange={(patch) => updateStep(step.tempId, patch)}
                onRemove={() => removeStep(step.tempId)}
                onMoveUp={() => moveStep(step.tempId, -1)}
                onMoveDown={() => moveStep(step.tempId, +1)}
              />
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-neutral-200 dark:border-neutral-800 px-5 py-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800" disabled={loading}>Отмена</button>
          <button onClick={handleSubmit} className="rounded-lg bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50" disabled={loading || !name.trim() || steps.length === 0}>
            {loading ? 'Сохранение…' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepEditor({
  index,
  step,
  operations,
  categories,
  materials,
  units,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}) {
  const op = useMemo(() => {
    const id = step.operationId ? Number(step.operationId) : -1;
    return operations.find((o) => o.id === id);
  }, [operations, step.operationId]);

  const machineOptions = op?.machines || [];

  // Категория-фильтр по path (локально на шаг)
  const filterPath = step.materialsCategoryFilter || '';
  const filteredMaterials = useMemo(() => {
    if (!filterPath) return materials;
    return (materials || []).filter((m) => m?.category?.path?.startsWith(filterPath));
  }, [materials, filterPath]);

  const addMaterial = () => {
    const defaultMatId = filteredMaterials[0]?.id ?? materials[0]?.id ?? '';
    const defaultUnitId = units[0]?.id ?? '';
    onChange({
      materials: [
        ...(step.materials || []),
        { materialItemId: defaultMatId, quantity: 1, unitId: defaultUnitId },
      ],
    });
  };

  const updateMaterial = (i, patch) => {
    const copy = [...(step.materials || [])];
    copy[i] = { ...copy[i], ...patch };
    onChange({ materials: copy });
  };

  const removeMaterial = (i) => {
    const copy = [...(step.materials || [])];
    copy.splice(i, 1);
    onChange({ materials: copy });
  };

  const addField = () => onChange({ fields: [...(step.fields || []), { key: '', value: '' }] });
  const updateField = (i, patch) => {
    const copy = [...(step.fields || [])];
    copy[i] = { ...copy[i], ...patch };
    onChange({ fields: copy });
  };
  const removeField = (i) => {
    const copy = [...(step.fields || [])];
    copy.splice(i, 1);
    onChange({ fields: copy });
  };

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <strong className="text-sm">Шаг {index}</strong>
        <div className="flex items-center gap-2">
          <button onClick={onMoveUp} title="Вверх" className="rounded-md px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">↑</button>
          <button onClick={onMoveDown} title="Вниз" className="rounded-md px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">↓</button>
          <button onClick={onRemove} title="Удалить" className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">✕</button>
        </div>
      </div>

      <label className="mb-3 flex flex-col gap-1">
        <span className="text-sm text-neutral-600 dark:text-neutral-300">Название шага</span>
        <input
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          value={step.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Например: Раскрой"
        />
      </label>

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600 dark:text-neutral-300">Операция</span>
          <select
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            value={step.operationId ?? ''}
            onChange={(e) => {
              const value = e.target.value ? Number(e.target.value) : '';
              onChange({ operationId: value, machineItemId: '' });
            }}
          >
            <option value="">— Не выбрано —</option>
            {operations.map((op) => (
              <option key={op.id} value={op.id}>{op.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600 dark:text-neutral-300">Станок</span>
          <select
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white disabled:opacity-50"
            disabled={!op || machineOptions.length === 0}
            value={step.machineItemId ?? ''}
            onChange={(e) => {
              const value = e.target.value ? Number(e.target.value) : '';
              onChange({ machineItemId: value });
            }}
          >
            <option value="">{op && machineOptions.length ? '— Выберите станок —' : 'Недоступно'}</option>
            {machineOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600 dark:text-neutral-300">Категория материалов (фильтр)</span>
          <select
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            value={filterPath}
            onChange={(e) => onChange({ materialsCategoryFilter: e.target.value })}
          >
            <option value="">Все категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.path}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2">
        <div className="mb-2 flex items-center justify-between">
          <strong className="text-sm">Материалы</strong>
          <button onClick={addMaterial} className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700">
            + Добавить материал
          </button>
        </div>

        {(!step.materials || step.materials.length === 0) && (
          <div className="mb-2 text-xs text-neutral-500">Материалов пока нет</div>
        )}

        <div className="space-y-2">
          {(step.materials || []).map((m, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">Материал</span>
                <select
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  value={m.materialItemId}
                  onChange={(e) => updateMaterial(i, { materialItemId: Number(e.target.value) })}
                >
                  {filteredMaterials.map((mat) => (
                    <option key={mat.id} value={mat.id}>
                      {mat.name} {mat?.category ? `— ${mat.category.name}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">Кол-во</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  value={m.quantity}
                  onChange={(e) => updateMaterial(i, { quantity: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">Ед.</span>
                <select
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  value={m.unitId ?? ''}
                  onChange={(e) =>
                    updateMaterial(i, { unitId: e.target.value ? Number(e.target.value) : '' })
                  }
                >
                  <option value="">—</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.unit}</option>
                  ))}
                </select>
              </label>

              <div className="flex items-end">
                <button onClick={() => removeMaterial(i)} className="h-[38px] rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <strong className="text-sm">Доп. поля</strong>
          <button onClick={addField} className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700">
            + Добавить поле
          </button>
        </div>

        {(!step.fields || step.fields.length === 0) && (
          <div className="mb-2 text-xs text-neutral-500">Полей пока нет</div>
        )}

        <div className="space-y-2">
          {(step.fields || []).map((f, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">Ключ</span>
                <input
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  value={f.key}
                  onChange={(e) => updateField(i, { key: e.target.value })}
                  placeholder="Напр.: Скорость подачи"
                />
              </label>
              <label className="md:col-span-2 flex flex-col gap-1">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">Значение</span>
                <input
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  value={f.value}
                  onChange={(e) => updateField(i, { value: e.target.value })}
                  placeholder="Напр.: 15 м/мин"
                />
              </label>
              <div className="flex items-end">
                <button onClick={() => removeField(i)} className="h-[38px] rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">
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