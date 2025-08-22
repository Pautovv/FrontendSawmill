import React, { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:3001';

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now() + Math.random());
}

export default function ModalPassport({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [steps, setSteps] = useState([]);
  const [specMaterials, setSpecMaterials] = useState([]); // справочник материалов (MaterialSpec)
  const [units, setUnits] = useState([]);
  const [machines, setMachines] = useState([]); // станки (items по категории "станки")
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let ignore = false;
    setErr('');
    setName('');
    setSteps([]);
    (async () => {
      try {
        const [specsRes, unitsRes, machinesRes] = await Promise.all([
          fetch(`${API_BASE}/spec-materials`),
          fetch(`${API_BASE}/units/available`),
          fetch(`${API_BASE}/items/by-category?categoryPath=${encodeURIComponent('станки')}`),
        ]);
        if (!specsRes.ok || !unitsRes.ok || !machinesRes.ok) throw new Error('Не удалось загрузить справочники');
        const [specs, unitList, machinesList] = await Promise.all([
          specsRes.json(),
          unitsRes.json(),
          machinesRes.json(),
        ]);
        if (!ignore) {
          setSpecMaterials(specs); // [{id, name, category?}]
          setUnits(unitList);
          setMachines(machinesList);
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
        machineItemId: '',
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
        steps: steps.map((s, idx) => ({
          order: idx + 1,
          name: s.name.trim(),
          machineItemId: s.machineItemId ? Number(s.machineItemId) : undefined,
          materials: (s.materials || []).map((m) => ({
            materialSpecId: Number(m.materialSpecId),
            quantity: Number(m.quantity ?? 1),
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

          <div className="space-y-3">
            {steps.map((step, idx) => (
              <StepEditor
                key={step.tempId}
                index={idx + 1}
                step={step}
                specMaterials={specMaterials}
                units={units}
                machines={machines}
                onChange={(patch) => updateStep(step.tempId, patch)}
                onRemove={() => removeStep(step.tempId)}
                onMoveUp={() => moveStep(step.tempId, -1)}
                onMoveDown={() => moveStep(step.tempId, +1)}
              />
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 border-t border-neutral-200 dark:border-neutral-800 px-5 py-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur">
          <button onClick={addStep} className="rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700" disabled={loading}>
            + Добавить шаг
          </button>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800" disabled={loading}>Отмена</button>
            <button onClick={handleSubmit} className="rounded-lg bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50" disabled={loading || !name.trim() || steps.length === 0}>
              {loading ? 'Сохранение…' : 'Создать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepEditor({
  index,
  step,
  specMaterials,
  units,
  machines,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}) {
  const addMaterial = () => {
    const defaultSpecId = specMaterials[0]?.id ?? '';
    const defaultUnitId = units[0]?.id ?? '';
    onChange({
      materials: [
        ...(step.materials || []),
        { materialSpecId: defaultSpecId, quantity: 1, unitId: defaultUnitId },
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

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600 dark:text-neutral-300">Станок</span>
          <select
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            value={step.machineItemId ?? ''}
            onChange={(e) => {
              const value = e.target.value ? Number(e.target.value) : '';
              onChange({ machineItemId: value });
            }}
          >
            <option value="">— Не выбран —</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2">
        <div className="mb-2 flex items-center justify-between">
          <strong className="text-sm">Сырьё (материалы)</strong>
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
                <span className="text-sm text-neutral-600 dark:text-neutral-300">Материал (спецификация)</span>
                <select
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  value={m.materialSpecId}
                  onChange={(e) => updateMaterial(i, { materialSpecId: Number(e.target.value) })}
                >
                  {specMaterials.map((sm) => (
                    <option key={sm.id} value={sm.id}>
                      {sm.name}{sm?.category ? ` — ${sm.category}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">Кол-во</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  value={m.quantity ?? 1}
                  onChange={(e) => updateMaterial(i, { quantity: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">Ед. изм.</span>
                <select
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  value={m.unitId ?? ''}
                  onChange={(e) => updateMaterial(i, { unitId: e.target.value ? Number(e.target.value) : '' })}
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