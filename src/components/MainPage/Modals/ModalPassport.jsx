import React, { useEffect, useState, useCallback } from 'react';
import AutocompleteNomenclature from './help/Autocomplited';

const API_BASE = 'http://localhost:3001';

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now() + Math.random());
}

export default function ModalPassport({ onClose, onCreated }) {
  // Название техкарты (свободное)
  const [name, setName] = useState('');
  // Массив шагов
  const [steps, setSteps] = useState([]);
  // Единицы (нам сейчас не нужны для материалов, но оставим загрузку на будущее / совместимость)
  const [units, setUnits] = useState([]);
  // Изображения (опционально)
  const [images, setImages] = useState([]);
  // Состояния
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Загрузка единиц измерения (если не нужны — можно закомментировать)
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/units/available`);
        if (!res.ok) throw new Error('Не удалось загрузить единицы');
        const data = await res.json();
        if (!ignore) setUnits(data);
      } catch (e) {
        if (!ignore) setErr(e.message || 'Ошибка загрузки единиц');
      }
    })();
    return () => { ignore = true; };
  }, []);

  /* ---------- Шаги ---------- */

  const addStep = useCallback(() => {
    setSteps(prev => [
      ...prev,
      {
        tempId: randomId(),
        name: '',
        machineNomenclature: null,
        machineItemId: '', // если вдруг нужна старая связь (пока оставим)
        materials: [],     // [{ tempId, materialNomenclature }]
        fields: [],        // [{ key, value, _id }]
      },
    ]);
  }, []);

  const updateStep = (tempId, patch) => {
    setSteps(prev => prev.map(s => (s.tempId === tempId ? { ...s, ...patch } : s)));
  };

  const removeStep = (tempId) => {
    setSteps(prev => prev.filter(s => s.tempId !== tempId));
  };

  const moveStep = (tempId, dir) => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.tempId === tempId);
      if (idx < 0) return prev;
      const ni = idx + dir;
      if (ni < 0 || ni >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(ni, 0, moved);
      return copy;
    });
  };

  /* ---------- Изображения ---------- */

  const addImages = (fileList) => {
    const arr = Array.from(fileList).map(f => ({
      file: f,
      tempId: randomId(),
      preview: URL.createObjectURL(f),
    }));
    setImages(prev => [...prev, ...arr]);
  };

  const removeImage = (tempId) => {
    setImages(prev => prev.filter(i => i.tempId !== tempId));
  };

  /* ---------- Submit ---------- */

  const handleSubmit = async () => {
    setLoading(true);
    setErr('');
    try {
      if (!name.trim()) throw new Error('Введите название техкарты');
      if (!steps.length) throw new Error('Добавьте хотя бы один шаг');

      steps.forEach((s, ix) => {
        if (!s.name?.trim()) {
          throw new Error(`Название шага №${ix + 1} обязательно`);
        }
      });

      const payload = {
        name: name.trim(),
        steps: steps.map((s, idx) => ({
          order: idx + 1,
          name: s.name.trim(),
          machineNomenclatureId: s.machineNomenclature?.id || undefined,
          machineItemId: s.machineItemId ? Number(s.machineItemId) : undefined,
          // Только номенклатуры материалов (без количества / единиц)
          materials: (s.materials || []).map(m => ({
            nomenclatureId: m.materialNomenclature?.id,
          })),
          fields: (s.fields || []).filter(f => f.key && f.value),
        })),
      };

      const r = await fetch(`${API_BASE}/tech-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error((await r.text()) || 'Не удалось создать техкарту');
      const created = await r.json();

      if (images.length) {
        const fd = new FormData();
        images.forEach(img => fd.append('images', img.file));
        // игнорируем ошибку загрузки изображений (не критично)
        await fetch(`${API_BASE}/tech-cards/${created.id}/images`, { method: 'POST', body: fd })
          .catch(() => console.warn('Ошибка загрузки изображений'));
      }

      onCreated && onCreated(created);
      onClose && onClose();
    } catch (e) {
      setErr(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const disabledSubmit = loading || !name.trim() || steps.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={() => !loading && onClose?.()} />

      <div
        className="relative w-[min(1000px,95vw)] max-h-[90vh] overflow-auto rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-5 py-4 bg-white/90 dark:bg-neutral-900/90 backdrop-blur">
          <h3 className="text-lg font-semibold">Создание техкарты</h3>
          <button
            onClick={() => !loading && onClose?.()}
            className="rounded-md px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-6">
          {err && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-200">
              {err}
            </div>
          )}

          {/* Название техкарты */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-300">
              Название техкарты
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Карта — Сборка рам"
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              disabled={loading}
            />
          </label>

          {/* Изображения */}
          <ImageSection
            images={images}
            addImages={addImages}
            removeImage={removeImage}
            disabled={loading}
          />

          {/* Шаги */}
          <div className="space-y-4">
            {steps.map((s, idx) => (
              <StepEditor
                key={s.tempId}
                index={idx + 1}
                step={s}
                onChange={(patch) => updateStep(s.tempId, patch)}
                onRemove={() => removeStep(s.tempId)}
                onMoveUp={() => moveStep(s.tempId, -1)}
                onMoveDown={() => moveStep(s.tempId, +1)}
                disabled={loading}
              />
            ))}

            {steps.length === 0 && (
              <div className="text-xs text-neutral-500">
                Пока нет шагов — нажмите "Добавить шаг"
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 border-t border-neutral-200 dark:border-neutral-800 px-5 py-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur">
          <button
            onClick={addStep}
            disabled={loading}
            className="rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50"
          >
            + Добавить шаг
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => !loading && onClose?.()}
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={disabledSubmit}
              className="rounded-lg bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Сохранение…' : 'Создать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Компонент шагов ---------- */

function StepEditor({
  index,
  step,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  disabled,
}) {
  const addMaterial = () => {
    onChange({
      materials: [
        ...(step.materials || []),
        {
          tempId: randomId(),
          materialNomenclature: null,
        },
      ],
    });
  };

  const updateMaterial = (tempId, patch) => {
    const copy = [...(step.materials || [])];
    const i = copy.findIndex(m => m.tempId === tempId);
    if (i >= 0) {
      copy[i] = { ...copy[i], ...patch };
      onChange({ materials: copy });
    }
  };

  const removeMaterial = (tempId) => {
    const copy = [...(step.materials || [])];
    const i = copy.findIndex(m => m.tempId === tempId);
    if (i >= 0) {
      copy.splice(i, 1);
      onChange({ materials: copy });
    }
  };

  const addField = () =>
    onChange({
      fields: [...(step.fields || []), { key: '', value: '', _id: randomId() }],
    });

  const updateField = (idx, patch) => {
    const copy = [...(step.fields || [])];
    copy[idx] = { ...copy[idx], ...patch };
    onChange({ fields: copy });
  };

  const removeField = (idx) => {
    const copy = [...(step.fields || [])];
    copy.splice(idx, 1);
    onChange({ fields: copy });
  };

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-5">
      {/* Header действий шага */}
      <div className="flex items-center justify-between">
        <strong className="text-sm">Шаг {index}</strong>
        <div className="flex items-center gap-2">
          <button
            onClick={onMoveUp}
            disabled={disabled}
            title="Вверх"
            className="rounded-md px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40"
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            disabled={disabled}
            title="Вниз"
            className="rounded-md px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40"
          >
            ↓
          </button>
          <button
            onClick={onRemove}
            disabled={disabled}
            title="Удалить"
            className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Название шага */}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600 dark:text-neutral-300">
          Название шага
        </span>
        <input
          value={step.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Например: Раскрой"
          disabled={disabled}
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
        />
      </label>

      {/* Станок */}
      <div className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600 dark:text-neutral-300">
          Станок / оборудование
        </span>
        <AutocompleteNomenclature
          type="MACHINE"
          value={step.machineNomenclature}
          onSelect={(v) => onChange({ machineNomenclature: v })}
          placeholder="Начните вводить..."
          disabled={disabled}
        />
      </div>

      {/* Материалы */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <strong className="text-sm">Материалы</strong>
          <button
            onClick={addMaterial}
            disabled={disabled}
            className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40"
          >
            + Материал
          </button>
        </div>
        {(!step.materials || step.materials.length === 0) && (
          <div className="text-xs text-neutral-500">
            Материалов пока нет
          </div>
        )}
        <div className="space-y-3">
          {(step.materials || []).map(m => (
            <div key={m.tempId} className="flex items-center gap-2">
              <div className="flex-1">
                <AutocompleteNomenclature
                  type="MATERIAL"
                  value={m.materialNomenclature}
                  onSelect={(v) => updateMaterial(m.tempId, { materialNomenclature: v })}
                  placeholder="Материал..."
                  disabled={disabled}
                />
              </div>
              <button
                onClick={() => removeMaterial(m.tempId)}
                disabled={disabled}
                className="rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Доп. поля */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <strong className="text-sm">Доп. поля</strong>
          <button
            onClick={addField}
            disabled={disabled}
            className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40"
          >
            + Поле
          </button>
        </div>
        {(!step.fields || step.fields.length === 0) && (
          <div className="text-xs text-neutral-500">Полей пока нет</div>
        )}
        <div className="space-y-2">
          {(step.fields || []).map((f, i) => (
            <div key={f._id || i} className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                value={f.key}
                onChange={(e) => updateField(i, { key: e.target.value })}
                disabled={disabled}
                placeholder="Ключ (например: Скорость)"
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
              <input
                value={f.value}
                onChange={(e) => updateField(i, { value: e.target.value })}
                disabled={disabled}
                placeholder="Значение (15 м/мин)"
                className="md:col-span-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
              <div className="md:col-span-3 flex justify-end">
                <button
                  onClick={() => removeField(i)}
                  disabled={disabled}
                  className="rounded-md px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40"
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

/* ---------- Секция изображений (отдельный компонент для читаемости) ---------- */
function ImageSection({ images, addImages, removeImage, disabled }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Изображения</span>
        <label className="cursor-pointer text-xs px-3 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700">
          + Добавить
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              if (e.target.files?.length) addImages(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {images.length === 0 && (
        <div className="text-xs text-neutral-500">Пока нет изображений</div>
      )}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <div key={img.tempId} className="relative group border rounded-lg overflow-hidden">
              <img
                src={img.preview}
                alt=""
                className="object-cover w-full h-32"
              />
              <div className="absolute inset-0 hidden group-hover:flex justify-end items-start p-1">
                <button
                  onClick={() => removeImage(img.tempId)}
                  disabled={disabled}
                  className="bg-red-600 text-white text-xs px-2 py-1 rounded shadow disabled:opacity-40"
                >
                  Удалить
                </button>
              </div>
              <div className="absolute bottom-0 left-0 bg-black/50 text-white text-[10px] px-1">
                {idx + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}