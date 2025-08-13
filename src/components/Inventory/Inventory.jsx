import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ModalMachine,
  ModalOperation,
  ModalProfile,
  ModalPassport,
  ModalRaw,
  sidebarButtons
} from "./Imports/imports";

export default function WarehousePage() {
  const [modalType, setModalType] = useState(null);

  return (
    <div className="flex gap-10 px-8 py-10 bg-white dark:bg-black min-h-screen transition-all duration-300 text-[15px]">

      {/* Sidebar */}
      <aside className="w-60 flex flex-col gap-3">
        {sidebarButtons.map((btn) => {
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              onClick={() => setModalType(btn.id)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all ${btn.color} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white`}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate">{btn.label}</span>
            </button>
          );
        })}
      </aside>

      {/* Main Section */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
        {[
          { to: "/inventory/log_storage", label: "Бревно" },
          { to: "/inventory/lumber_nathum_storage", label: "Пиломатериалы естественной влажности" },
          { to: "/inventory/dry_lumber_storage", label: "Пиломатериалы сухие" },
          { to: "/inventory/planed_products_storage", label: "Строганная продукция" },
          { to: "/inventory/paintsvarnishes_storage", label: "Лакокрасочная продукция" },
          { to: "/inventory/furniture_storage", label: "Фурнитура" },
          { to: "/inventory/tools_storage", label: "Инструменты" },
          { to: "/inventory/machine_storage", label: "Станки" }
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="block bg-white dark:bg-neutral-800 rounded-2xl shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 p-6 border border-neutral-200 dark:border-neutral-700"
          >
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
              {item.label}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Перейти в раздел
            </p>
          </Link>
        ))}
      </section>



      {modalType === "machine" && (
        <ModalMachine onClose={() => setModalType(null)} />
      )}
      {modalType === "operation" && (
        <ModalOperation onClose={() => setModalType(null)} />
      )}
      {modalType === "profile" && (
        <ModalProfile onClose={() => setModalType(null)} />
      )}
      {modalType === "passport" && (
        <ModalPassport onClose={() => setModalType(null)} />
      )}
      {modalType === "raw" && (
        <ModalRaw onClose={() => setModalType(null)} />
      )}

    </div>
  );
}
