import React, { useState, useMemo } from "react";
import reports from "./data/reports_exm.json";
import { Search } from "lucide-react";
import ReportModal from "./ReportModal";

export default function WarehousePage() {
  const [filterName, setFilterName] = useState("");
  const [filterCategory] = useState("Все категории");
  const [sortConfig] = useState({ key: "name", direction: "asc" });
  const [selectedReport, setSelectedReport] = useState(null);

  const filteredItems = useMemo(() => {
    let filtered = reports;

    if (filterCategory !== "Все категории") {
      filtered = filtered.filter((item) => item.category === filterCategory);
    }
    if (filterName.trim()) {
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(filterName.toLowerCase())
      );
    }

    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key])
          return sortConfig.direction === "asc" ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key])
          return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [filterName, filterCategory, sortConfig]);

  const handleRowClick = (report) => {
    setSelectedReport(report);
  };

  const handleConfirm = () => {
    console.log("Подтверждено:", selectedReport);
    setSelectedReport(null);
  };

  const handleReject = () => {
    console.log("Отклонено:", selectedReport);
    setSelectedReport(null);
  };

  return (
    <div className="flex gap-10 px-8 py-10 bg-white dark:bg-black min-h-screen transition-all duration-300 text-[15px]">
      {/* Main Section */}
      <section className="flex-1">
        {/* Фильтры */}
        <div className="flex flex-wrap gap-5 mb-8 items-center">
          {/* Поиск */}
          <div className="relative w-72">
            <input
              type="text"
              placeholder="Поиск по названию"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-black dark:text-white placeholder-neutral-500 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
          </div>
        </div>

        {/* Таблица */}
        <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <table className="min-w-full bg-white dark:bg-black text-left">
            <thead className="bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 text-sm">
              <tr>
                <th className="px-6 py-4 font-semibold cursor-pointer select-none">
                  Название изделия
                </th>
                <th className="px-6 py-4 font-semibold cursor-pointer select-none">
                  ФИО сотрудника
                </th>
                <th className="px-6 py-4 font-semibold text-right cursor-pointer select-none">
                  Дата начала работы
                </th>
                <th className="px-6 py-4 font-semibold text-right cursor-pointer select-none">
                  Дата окончания работы
                </th>
                <th className="px-6 py-4 font-semibold cursor-pointer select-none">
                  Статус
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-6 text-neutral-400">
                    Нет данных
                  </td>
                </tr>
              ) : (
                filteredItems.map((report, i) => (
                  <tr
                    key={report.id}
                    onClick={() => handleRowClick(report)}
                    className={`transition-all group cursor-pointer ${
                      i % 2 === 0
                        ? "bg-white dark:bg-black"
                        : "bg-neutral-50 dark:bg-neutral-900"
                    } hover:bg-neutral-100 dark:hover:bg-neutral-800`}
                  >
                    <td className="px-6 py-4">{report.name}</td>
                    <td className="px-6 py-4">{report.fullname}</td>
                    <td className="px-6 py-4 text-right">{report.date_start}</td>
                    <td className="px-6 py-4 text-right">{report.date_end || "-"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          report.status === "Подтверждена"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                            : report.status === "Ожидает подтверждения"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                        }`}
                      >
                        {report.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Модальное окно */}
      {selectedReport && (
        <ReportModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onConfirm={handleConfirm}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
