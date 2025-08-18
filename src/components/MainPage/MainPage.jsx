import React, { useEffect, useState } from "react";
import { FileText, PlusCircle, User2, ChevronRight } from "lucide-react";
import ModalPassport from "./Modals/ModalPassport";
import ModalOperation from "./Modals/ModalOperation";

function MainPage() {
  const [modalType, setModalType] = useState(null);

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && setModalType(null);
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  const actions = [
    {
      id: "passport",
      title: "Добавить паспорт",
      description: "Загрузите и сохраните данные паспорта.",
      icon: FileText,
      accent: "from-violet-500 to-fuchsia-500",
    },
    {
      id: "operation",
      title: "Добавить операцию",
      description: "Создайте новую операцию и заполните детали.",
      icon: PlusCircle,
      accent: "from-emerald-500 to-teal-500",
    },
  ];

  const modalMap = {
    passport: ModalPassport,
    operation: ModalOperation,
  };

  const ActiveModal = modalType ? modalMap[modalType] : null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <section className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Быстрые действия
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Выберите, что хотите сделать. Всё важное — в одном месте.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200/70 dark:border-neutral-800/70 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm p-4 sm:p-6 shadow-sm">
          <div role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {actions.map(({ id, title, description, icon: Icon, accent }) => (
              <button
                key={id}
                onClick={() => setModalType(id)}
                className="group relative flex items-start gap-4 rounded-xl border border-neutral-200/70 dark:border-neutral-800/70 bg-white/80 dark:bg-neutral-900/80 p-4 sm:p-5 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
              >
                <span className="relative shrink-0">
                  <span className={`absolute -inset-1 rounded-xl bg-gradient-to-br ${accent} opacity-20 blur-md`} />
                  <span className={`relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-md`}>
                    <Icon className="h-5 w-5" />
                  </span>
                </span>

                <span className="flex min-w-0 flex-col text-left">
                  <span className="text-[15px] sm:text-base font-medium text-neutral-900 dark:text-neutral-100">
                    {title}
                  </span>
                  <span className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
                    {description}
                  </span>
                </span>

                <ChevronRight className="ml-auto mt-1 h-5 w-5 text-neutral-400 group-hover:text-neutral-500 dark:text-neutral-500 dark:group-hover:text-neutral-300 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {ActiveModal && <ActiveModal onClose={() => setModalType(null)} />}
    </div>
  );
}

export default MainPage;