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