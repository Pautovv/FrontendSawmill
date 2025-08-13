export default function ToolsTable({ items }) {
    return (
        <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
            {/* Заголовок */}
            <table className="min-w-full bg-white dark:bg-black text-left table-fixed">
                <thead className="bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 text-sm">
                    <tr>
                        <th className="px-6 py-4 font-semibold cursor-pointer select-none w-[40%]">Название</th>
                        <th className="px-6 py-4 font-semibold text-right cursor-pointer select-none w-[12%]">Количество (шт)</th>
                        <th className="px-6 py-4 font-semibold text-right cursor-pointer select-none w-[12%]">Количество (кг)</th>
                        <th className="px-6 py-4 font-semibold text-right cursor-pointer select-none w-[12%]">Количество (л)</th>
                    </tr>
                </thead>
            </table>

            <div className="max-h-[240px] overflow-y-auto custom-scroll">
                <table className="min-w-full bg-white dark:bg-black text-left table-fixed">
                    <tbody>
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="text-center py-6 text-neutral-400">
                                    Нет данных
                                </td>
                            </tr>
                        ) : (
                            items.map((item, i) => (
                                <tr
                                    key={item.id}
                                    className={`transition-all group ${
                                        i % 2 === 0
                                            ? "bg-white dark:bg-black"
                                            : "bg-neutral-50 dark:bg-neutral-900"
                                    } hover:bg-neutral-100 dark:hover:bg-neutral-800`}
                                >
                                    <td className="px-6 py-4 w-[40%]">{item.name}</td>
                                    <td className="px-6 py-4 text-right w-[12%]">{item.pcs}</td>
                                    <td className="px-6 py-4 text-right w-[12%]">{item.kg}</td>
                                    <td className="px-6 py-4 text-right w-[12%]">{item.l}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
