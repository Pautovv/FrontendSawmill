import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'http://localhost:3001';

const STATUS_LABELS = {
  ALL: 'Все',
  ACTIVE: 'Активные',
  DONE: 'Завершенные',
  DRAFT: 'Черновики',
  CANCELLED: 'Отмененные',
};

const STATUS_BADGE = {
  ACTIVE: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800',
  DONE: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800',
  DRAFT: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800',
  CANCELLED: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-800',
};

const variantsRow = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function ReportsPage() {
  const [filter, setFilter] = useState({
    search: '',
    status: 'ALL',
    from: '',
    to: '',
  });
  const [localSearch, setLocalSearch] = useState('');
  const debouncedSearch = useDebounced(localSearch, 350);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [data, setData] = useState({ total: 0, data: [] });
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // Sync debounced search into main filter
  useEffect(() => {
    setPage(1);
    setFilter((f) => ({ ...f, search: debouncedSearch }));
  }, [debouncedSearch]);

  const fetchList = async ({ signal } = {}) => {
    setError('');
    const params = new URLSearchParams();
    if (filter.search) params.set('search', filter.search);
    if (filter.status && filter.status !== 'ALL') params.set('status', filter.status);
    if (filter.from) params.set('from', filter.from);
    if (filter.to) params.set('to', filter.to);
    params.set('page', String(page));
    params.set('perPage', String(perPage));
    const url = `${API}/reports/tasks?${params.toString()}`;
    const res = await axios.get(url, { signal });
    return res.data;
  };

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const list = await fetchList({ signal: controller.signal });
        if (!ignore) setData(list);
      } catch (e) {
        if (!ignore && e.name !== 'CanceledError' && e.name !== 'AbortError') {
          console.error(e);
          setError(e?.response?.data?.message || e.message || 'Ошибка загрузки');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [filter.search, filter.status, filter.from, filter.to, page, perPage]);

  const pages = useMemo(() => Math.max(1, Math.ceil((data.total || 0) / perPage)), [data, perPage]);

  const pageNumbers = useMemo(() => {
    const arr = [];
    const maxButtons = 5;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    let end = Math.min(pages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) start = Math.max(1, end - maxButtons + 1);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [page, pages]);

  const resetFilters = () => {
    setLocalSearch('');
    setFilter({ search: '', status: 'ALL', from: '', to: '' });
    setPage(1);
  };

  const refetchAfterSave = async () => {
    try {
      setLoading(true);
      const list = await fetchList();
      setData(list);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e.message || 'Ошибка обновления');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="rounded-2xl overflow-hidden border border-neutral-200/80 dark:border-neutral-800 bg-gradient-to-br from-white to-neutral-50 dark:from-neutral-950 dark:to-neutral-900">
          <div className="px-5 py-4 flex items-center justify-between border-b border-neutral-200/70 dark:border-neutral-800">
            <div className="font-semibold text-lg">Отчеты по заданиям</div>
            <div className="text-sm text-neutral-500">
              Найдено: <span className="font-medium text-neutral-800 dark:text-neutral-200">{data.total}</span>
            </div>
          </div>

          <div className="px-5 py-4 flex flex-wrap items-end gap-3">
            <label className="relative">
              <div className="text-xs text-neutral-500 mb-1">Поиск</div>
              <div className="relative">
                <input
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Название задания, техкарта, изделие…"
                  className="pe-9 ps-10 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 outline-none focus:ring-2 ring-offset-2 ring-neutral-200 dark:ring-neutral-700 transition"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  <SearchIcon />
                </span>
                {localSearch && (
                  <button
                    onClick={() => setLocalSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"
                    title="Очистить"
                  >
                    ✕
                  </button>
                )}
              </div>
            </label>

            <label>
              <div className="text-xs text-neutral-500 mb-1">Статус</div>
              <select
                value={filter.status}
                onChange={(e) => { setPage(1); setFilter((f) => ({ ...f, status: e.target.value })); }}
                className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 outline-none focus:ring-2 ring-offset-2 ring-neutral-200 dark:ring-neutral-700 transition"
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>

            <label>
              <div className="text-xs text-neutral-500 mb-1">С даты</div>
              <div className="relative">
                <input
                  type="date"
                  value={filter.from}
                  onChange={(e) => { setPage(1); setFilter((f) => ({ ...f, from: e.target.value })); }}
                  className="ps-10 pe-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 outline-none focus:ring-2 ring-offset-2 ring-neutral-200 dark:ring-neutral-700 transition"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  <CalendarIcon />
                </span>
              </div>
            </label>

            <label>
              <div className="text-xs text-neutral-500 mb-1">По дату</div>
              <div className="relative">
                <input
                  type="date"
                  value={filter.to}
                  onChange={(e) => { setPage(1); setFilter((f) => ({ ...f, to: e.target.value })); }}
                  className="ps-10 pe-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 outline-none focus:ring-2 ring-offset-2 ring-neutral-200 dark:ring-neutral-700 transition"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  <CalendarIcon />
                </span>
              </div>
            </label>

            <label>
              <div className="text-xs text-neutral-500 mb-1">На странице</div>
              <select
                value={perPage}
                onChange={(e) => { setPage(1); setPerPage(Number(e.target.value)); }}
                className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 outline-none focus:ring-2 ring-offset-2 ring-neutral-200 dark:ring-neutral-700 transition"
              >
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>

            <button
              onClick={resetFilters}
              className="ms-auto px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm transition"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200/70 bg-rose-50 text-rose-800 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-neutral-50/70 dark:bg-neutral-900/70 sticky top-0 backdrop-blur supports-[backdrop-filter]:bg-neutral-50/60 dark:supports-[backdrop-filter]:bg-neutral-900/60">
            <tr className="text-neutral-600 dark:text-neutral-300">
              <th className="px-4 py-3 text-left font-medium">Задание</th>
              <th className="px-4 py-3 text-left font-medium">Техкарта / Изделие</th>
              <th className="px-4 py-3 text-left font-medium">Создано</th>
              <th className="px-4 py-3 text-left font-medium">Статус</th>
              <th className="px-4 py-3 text-right font-medium">Шагов</th>
              <th className="px-4 py-3 text-right font-medium">Отчитано</th>
              <th className="px-4 py-3 text-right font-medium">Итого</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
            ) : data.data.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-14 text-center">
                  <div className="mx-auto w-14 h-14 rounded-full grid place-items-center bg-neutral-100 dark:bg-neutral-800 text-neutral-400 mb-3">
                    <SearchIcon />
                  </div>
                  <div className="font-medium mb-1">Ничего не найдено</div>
                  <div className="text-sm text-neutral-500">Попробуйте изменить фильтры или запрос.</div>
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {data.data.map((t, idx) => (
                  <motion.tr
                    key={t.id}
                    {...variantsRow}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.15 }}
                    onClick={() => setSelectedTaskId(t.id)}
                    className={[
                      'cursor-pointer group',
                      idx % 2 === 0 ? 'bg-white dark:bg-neutral-950' : 'bg-neutral-50/60 dark:bg-neutral-900/60',
                      'hover:bg-neutral-100/80 dark:hover:bg-neutral-800 transition-colors',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex size-2 rounded-full bg-neutral-300 group-hover:bg-neutral-400 transition" />
                        <div className="line-clamp-2">{t.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                      <div className="line-clamp-2">
                        {t.techCard?.name}{t.techCard?.item ? ` • ${t.techCard.item.name}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[t.status] || 'bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700'}`}>
                        <span className="size-1.5 rounded-full bg-current/60" />
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{t.stepsCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{t.reportedStepsCount}</td>
                    <td className="px-4 py-3 text-right">
                      {t.totalQuantity != null ? (
                        <span className="font-medium">{t.totalQuantity} <span className="text-neutral-500 dark:text-neutral-400 font-normal">{t.totalUnit ?? ''}</span></span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-neutral-500">
          Стр. <span className="font-medium text-neutral-800 dark:text-neutral-200">{page}</span> из {pages}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(1)}
            disabled={page <= 1}
            className="px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            title="Первая"
          >
            ⏮
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            title="Назад"
          >
            ←
          </button>
          {pageNumbers.map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={[
                'px-3 py-1.5 rounded-lg border transition',
                n === page
                  ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                  : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800',
              ].join(' ')}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            title="Вперед"
          >
            →
          </button>
          <button
            onClick={() => setPage(pages)}
            disabled={page >= pages}
            className="px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            title="Последняя"
          >
            ⏭
          </button>
        </div>
      </div>

      <AnimatePresence>
        {selectedTaskId && (
          <ReportModal
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            onSaved={async () => {
              setSelectedTaskId(null);
              await refetchAfterSave();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ReportModal({ taskId, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [task, setTask] = useState(null);
  const [status, setStatus] = useState('ACTIVE');
  const [total, setTotal] = useState({ quantity: '', unit: '', notes: '' });
  const [rows, setRows] = useState([]); // [{ stepAssignmentId, step, workers[], quantity, unit, notes }]
  const overlayRef = useRef(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setError('');
      setLoading(true);
      try {
        const res = await axios.get(`${API}/reports/tasks/${taskId}`);
        if (ignore) return;
        const t = res.data;
        setTask(t);
        setStatus(t.status);
        setTotal({
          quantity: t.report?.totalQuantity ?? '',
          unit: t.report?.totalUnit ?? '',
          notes: t.report?.notes ?? '',
        });
        setRows(
          t.steps.map((s) => ({
            stepAssignmentId: s.stepAssignmentId,
            step: s.step,
            workers: s.workers,
            quantity: s.result?.quantity ?? '',
            unit: s.result?.unit ?? '',
            notes: s.result?.notes ?? '',
          })),
        );
      } catch (e) {
        if (!ignore) {
          console.error(e);
          setError(e?.response?.data?.message || e.message || 'Ошибка загрузки');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [taskId]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleChangeRow = (idx, patch) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setError('');
      setSaving(true);
      const payload = {
        status,
        total: {
          quantity: total.quantity === '' ? null : Number(total.quantity),
          unit: total.unit || null,
          notes: total.notes || null,
        },
        results: rows.map((r) => ({
          stepAssignmentId: r.stepAssignmentId,
          quantity: r.quantity === '' ? null : Number(r.quantity),
          unit: r.unit || null,
          notes: r.notes || null,
        })),
      };
      await axios.post(`${API}/reports/tasks/${taskId}`, payload);
      onSaved?.();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const onOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose?.();
  };

  return (
    <motion.div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onMouseDown={onOverlayClick}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.97, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18, mass: 0.6 }}
        className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-neutral-200 dark:border-neutral-800 flex items-start justify-between">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[status] || ''}`}>
                <span className="size-1.5 rounded-full bg-current/60" />
                {status}
              </span>
              <span>Отчет по заданию: {task?.name || '...'}</span>
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              {task?.techCard?.name}{task?.techCard?.item ? ` • ${task.techCard.item.name}` : ''}
              {task && ' • '}
              {task ? new Date(task.createdAt).toLocaleDateString() : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xl leading-none hover:opacity-80 rounded-lg p-1 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="px-6 pt-4">
            <div className="rounded-xl border border-rose-200/70 bg-rose-50 text-rose-800 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              {error}
            </div>
          </div>
        )}

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Общие поля */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <div className="text-xs text-neutral-500 mb-1">Статус задания</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 outline-none focus:ring-2 ring-offset-2 ring-neutral-200 dark:ring-neutral-700 transition"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="DONE">DONE</option>
                <option value="DRAFT">DRAFT</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs text-neutral-500 mb-1">Итого количество</div>
              <input
                type="number"
                inputMode="decimal"
                value={total.quantity}
                onChange={(e) => setTotal((t) => ({ ...t, quantity: e.target.value }))}
                placeholder="Напр. 120"
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 outline-none focus:ring-2 ring-offset-2 ring-neutral-200 dark:ring-neutral-700 transition"
              />
            </label>
            <label className="block">
              <div className="text-xs text-neutral-500 mb-1">Ед. изм. итога</div>
              <input
                value={total.unit}
                onChange={(e) => setTotal((t) => ({ ...t, unit: e.target.value }))}
                placeholder="шт / м² / м³ / пог.м"
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 outline-none focus:ring-2 ring-offset-2 ring-neutral-200 dark:ring-neutral-700 transition"
              />
            </label>
          </div>
          <label className="block">
            <div className="text-xs text-neutral-500 mb-1">Заметки по итогу</div>
            <textarea
              value={total.notes}
              onChange={(e) => setTotal((t) => ({ ...t, notes: e.target.value }))}
              placeholder="Примечания, брак, простои и пр."
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 outline-none focus:ring-2 ring-offset-2 ring-neutral-200 dark:ring-neutral-700 transition"
              rows={3}
            />
          </label>

          {/* Таблица шагов */}
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-700">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  <th className="px-3 py-2 text-left">Шаг</th>
                  <th className="px-3 py-2 text-left">Операция</th>
                  <th className="px-3 py-2 text-left">Исполнители</th>
                  <th className="px-3 py-2 text-right">Кол-во</th>
                  <th className="px-3 py-2 text-left">Ед. изм.</th>
                  <th className="px-3 py-2 text-left">Заметки</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} tight />)
                ) : rows.length === 0 ? (
                  <tr><td colSpan="6" className="px-3 py-8 text-center text-neutral-500">Шаги не найдены</td></tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={r.stepAssignmentId} className={i % 2 ? 'bg-neutral-50 dark:bg-neutral-900/60' : undefined}>
                      <td className="px-3 py-2">
                        <div className="font-medium">Шаг {r.step.order}. {r.step.name}</div>
                      </td>
                      <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">{r.step.operation?.name || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {r.workers.map((w) => (
                            <span key={w.id} className="px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs">
                              {w.name} • {w.role === 'LEAD' ? 'Гл.' : 'Уч.'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={r.quantity}
                          onChange={(e) => handleChangeRow(i, { quantity: e.target.value })}
                          className="w-28 px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 text-right outline-none focus:ring-2 ring-offset-2 ring-neutral-200 dark:ring-neutral-700 transition"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={r.unit}
                          onChange={(e) => handleChangeRow(i, { unit: e.target.value })}
                          placeholder="шт/м²/м³/пог.м"
                          className="w-28 px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 outline-none focus:ring-2 ring-offset-2 ring-neutral-200 dark:ring-neutral-700 transition"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={r.notes}
                          onChange={(e) => handleChangeRow(i, { notes: e.target.value })}
                          className="w-full px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 outline-none focus:ring-2 ring-offset-2 ring-neutral-200 dark:ring-neutral-700 transition"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving && <Spinner />}
            Сохранить
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* Helpers */

function SkeletonRow({ cols = 5, tight = false }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className={`px-4 ${tight ? 'py-2' : 'py-3'}`}>
          <div className="h-3.5 rounded bg-neutral-200/80 dark:bg-neutral-800/80 w-[75%]" />
        </td>
      ))}
    </tr>
  );
}

function Spinner() {
  return (
    <svg className="size-4 animate-spin text-current" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className="stroke-current">
      <circle cx="11" cy="11" r="7" strokeWidth="2" fill="none" />
      <path d="M20 20L17 17" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className="stroke-current">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" fill="none" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}