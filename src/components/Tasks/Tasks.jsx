import React, { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export default function Tasks() {
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [productFilter, setProductFilter] = useState({ name: "", category: "", difficulty: "" });
    const [stepWorkers, setStepWorkers] = useState({});
    const [secondaryWorkerSelections, setSecondaryWorkerSelections] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [workers, setWorkers] = useState([]);


    useEffect(() => {
        setLoading(true);
        fetch("http://localhost:3001/passports")
            .then(res => res.json())
            .then(data => {

                const formatted = data.map(p => ({
                    id: p.id,
                    name: p.productName,
                    category: p.category || "",
                    difficulty: p.difficulty || "",
                    components: p.components || [],
                    steps: p.steps
                        .sort((a, b) => a.stepNumber - b.stepNumber)
                        .map(s => s.operation?.name || `Шаг ${s.stepNumber || s.id}`),
                }));
                setProducts(formatted);
                setLoading(false);
            })
            .catch(e => {
                console.error(e);
                setError("Ошибка при загрузке продуктов");
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        fetch("http://localhost:3001/workers")
            .then(res => res.json())
            .then(data => setWorkers(data))
            .catch(err => console.error("Ошибка загрузки работников:", err));
    }, []);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productFilter.name.toLowerCase())
    );

    const resetForm = () => {
        setSelectedProduct(null);
        setProductFilter({ name: ""});
        setStepWorkers({});
        setSecondaryWorkerSelections({});
    };

    const handleAddSecondary = (stepIndex) => {
        const selectedId = secondaryWorkerSelections[stepIndex];
        if (!selectedId) return;

        setStepWorkers(prev => {
            const stepData = prev[stepIndex] || { mainWorker: null, secondaryWorkers: [] };
            if (stepData.secondaryWorkers.some(w => w.id === +selectedId)) return prev;
            const worker = workers.find(w => w.id === +selectedId);
            if (!worker) return prev;
            return {
                ...prev,
                [stepIndex]: {
                    ...stepData,
                    secondaryWorkers: [...stepData.secondaryWorkers, worker]
                }
            };
        });

        setSecondaryWorkerSelections(prev => ({ ...prev, [stepIndex]: "" }));
    };

    const handleRemoveSecondary = (stepIndex, workerId) => {
        setStepWorkers(prev => {
            const stepData = prev[stepIndex];
            if (!stepData) return prev;
            return {
                ...prev,
                [stepIndex]: {
                    ...stepData,
                    secondaryWorkers: stepData.secondaryWorkers.filter(w => w.id !== workerId)
                }
            };
        });
    };

    const handleMainWorkerChange = (stepIndex, workerId) => {
        setStepWorkers(prev => ({
            ...prev,
            [stepIndex]: {
                ...prev[stepIndex],
                mainWorker: workerId ? +workerId : null,
                secondaryWorkers: prev[stepIndex]?.secondaryWorkers || []
            }
        }));
    };

    const getAvailableWorkers = (stepIndex) => {
        const stepData = stepWorkers[stepIndex] || { mainWorker: null, secondaryWorkers: [] };
        return workers.filter(w =>
            w.id !== stepData.mainWorker &&
            !stepData.secondaryWorkers.some(sw => sw.id === w.id)
        );
    };

    const buildTaskPayload = () => {
        if (!selectedProduct) return null;

        const steps = selectedProduct.steps.map((stepName, idx) => {
            const stepData = stepWorkers[idx];
            return {
                stepNumber: idx + 1,
                mainWorkerId: stepData?.mainWorker,
                secondaryWorkerIds: stepData?.secondaryWorkers.map(w => w.id) || []
            };
        });

        return {
            passportId: selectedProduct.id,
            steps
        };
    };

    const handleSubmit = async () => {
        if (!selectedProduct) {
            alert("Пожалуйста, выберите изделие.");
            return;
        }
        for (let i = 0; i < selectedProduct.steps.length; i++) {
            const stepData = stepWorkers[i];
            if (!stepData || !stepData.mainWorker) {
                alert(`Пожалуйста, выберите главного работника для шага "${selectedProduct.steps[i]}".`);
                return;
            }
        }

        const payload = buildTaskPayload();

        try {
            setLoading(true);
            const res = await fetch("http://localhost:3001/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Ошибка при отправке задания");

            alert("Задание успешно отправлено!");
            resetForm();
        } catch (e) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Загрузка...</div>;
    if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-10 bg-white dark:bg-slate-900 rounded-2xl shadow-lg">
            <h1 className="text-3xl font-extrabold text-center text-slate-900 dark:text-white">Назначение задания</h1>

            {!selectedProduct && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {['name'].map(key => (
                        <input
                            key={key}
                            type="text"
                            placeholder={`Фильтр по ${key}`}
                            value={productFilter[key]}
                            onChange={(e) => setProductFilter({ ...productFilter, [key]: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-black dark:text-white placeholder-neutral-500 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                        />
                    ))}
                </div>
            )}

            {!selectedProduct ? (
                <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                    <table className="min-w-full bg-white dark:bg-black text-left">
                        <thead className="bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 text-sm">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Название</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="text-center py-6 text-neutral-400">
                                        Ничего не найдено
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product, i) => (
                                    <tr
                                        key={product.id}
                                        onClick={() => {
                                            setSelectedProduct(product);
                                            setStepWorkers({});
                                            setSecondaryWorkerSelections({});
                                        }}
                                        className={`transition-all group cursor-pointer ${i % 2 === 0
                                            ? "bg-white dark:bg-black"
                                            : "bg-neutral-50 dark:bg-neutral-900"
                                            } hover:bg-neutral-100 dark:hover:bg-neutral-800`}
                                    >
                                        <td className="px-6 py-4">{product.name}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

            ) : (
                <>
                    <div className="flex flex-col sm:flex-row items-center justify-between">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                            Выбранное изделие: {selectedProduct.name}
                        </h2>
                        <button
                            onClick={resetForm}
                            className="text-sm text-blue-600 hover:underline mt-2 sm:mt-0"
                        >
                            Изменить выбор
                        </button>
                    </div>

                    <div className="space-y-10">
                        {/* Компоненты */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Компоненты:</h3>
                            <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 mt-2">
                                {selectedProduct.components.map((c, i) => (
                                    <li key={i}>{c}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Шаги */}
                        <div className="space-y-8">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Технологическая карта:</h3>

                            {selectedProduct.steps.map((step, idx) => {
                                const stepData = stepWorkers[idx] || { mainWorker: null, secondaryWorkers: [] };
                                const availableWorkers = getAvailableWorkers(idx);

                                return (
                                    <div
                                        key={idx}
                                        className="bg-white dark:bg-black border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl px-6 py-6 space-y-5 transition-all"
                                    >
                                        <h4 className="text-slate-800 dark:text-white font-semibold text-base">
                                            Шаг {idx + 1}: <span className="font-normal text-slate-600 dark:text-slate-300"></span>
                                        </h4>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Главный работник</label>
                                            <div className="relative">
                                                <select
                                                    value={stepData.mainWorker || ""}
                                                    onChange={(e) => handleMainWorkerChange(idx, e.target.value)}
                                                    className="appearance-none w-full px-4 py-2.5 pr-10 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                                >
                                                    <option value="">Выберите главного работника</option>
                                                    {workers.map(w => (
                                                        <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute top-3.5 right-3 text-neutral-400 pointer-events-none" size={20} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Дополнительные работники</label>
                                            <div className="flex space-x-2">
                                                <select
                                                    value={secondaryWorkerSelections[idx] || ""}
                                                    onChange={e => setSecondaryWorkerSelections({ ...secondaryWorkerSelections, [idx]: e.target.value })}
                                                    className="appearance-none flex-1 px-4 py-2.5 pr-10 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                                >
                                                    <option value="">Выберите работника</option>
                                                    {availableWorkers.map(w => (
                                                        <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => handleAddSecondary(idx)}
                                                    className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all"
                                                >
                                                    Добавить
                                                </button>
                                            </div>

                                            {/* Список добавленных */}
                                            <div className="mt-3 flex flex-wrap gap-3">
                                                {stepData.secondaryWorkers.map(w => (
                                                    <div
                                                        key={w.id}
                                                        className="inline-flex items-center space-x-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full px-3 py-1 cursor-pointer select-none"
                                                        onClick={() => handleRemoveSecondary(idx, w.id)}
                                                        title="Удалить работника"
                                                    >
                                                        <span>{w.firstName}</span>
                                                        <span className="font-semibold text-lg leading-none">×</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full py-3 mt-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all"
                        >
                            Создать задание
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
