import React from "react";
import { X } from "lucide-react";

export default function ReportModal({ report, onClose, onConfirm, onReject }) {
  if (!report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-[500px] max-h-[80vh] overflow-hidden">
        {/* Заголовок */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-lg font-semibold">Отчет по работе</h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Контент со скроллом */}
        <div className="px-6 py-4 overflow-y-auto max-h-[55vh] space-y-3 text-sm">
          <div>
            <span className="font-medium">Изделие:</span> {report.name}
          </div>
          <div>
            <span className="font-medium">Сотрудник:</span> {report.fullname}
          </div>
          <div>
            <span className="font-medium">Категория:</span> {report.category || "Не указана"}
          </div>
          <div>
            <span className="font-medium">Дата начала:</span> {report.date_start}
          </div>
          <div>
            <span className="font-medium">Дата окончания:</span> {report.date_end || "Не указана"}
          </div>
          <div>
            <span className="font-medium">Статус:</span> {report.status}
          </div>
          <div>
            <span className="font-medium">Описание работ:</span>
            <p className="mt-1 text-neutral-600 dark:text-neutral-300">
              {report.description || "Описание отсутствует"}
            </p>
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onReject}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
          >
            Отклонить
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
}
