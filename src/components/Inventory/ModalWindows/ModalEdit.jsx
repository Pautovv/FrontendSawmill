import React, { useState, useEffect } from "react";

export default function EditItemModal({ item, onClose, onSave }) {
    const [quantity, setQuantity] = useState(""); // пустое поле по умолчанию
    const [location, setLocation] = useState(item.location || "");
    const [shelf, setShelf] = useState(item.shelf || "");
    const [available, setAvailable] = useState(true);

    useEffect(() => {
        if (quantity === "") return; // не проверяем пока поле пустое

        const checkSpace = async () => {
            try {
                const res = await fetch(`http://localhost:3001/storage?location=${location}&shelf=${shelf}`);
                const data = await res.json();
                const total = (data.currentQuantity || 0) + Number(quantity) - (item.quantity || 0);
                setAvailable(total <= (data.capacity || 0));
            } catch (err) {
                console.error(err);
                setAvailable(false);
            }
        };
        checkSpace();
    }, [item.quantity, location, shelf, quantity]);

    const handleSave = async () => {
        if (!available) return;

        try {
            const res = await fetch(`http://localhost:3001/inventory/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    quantity: Number(quantity), 
                    location, 
                    shelf 
                }),
            });

            if (!res.ok) throw new Error('Ошибка сервера');

            const updatedItem = await res.json();
            onSave(updatedItem);
            onClose();
        } catch (err) {
            console.error(err);
            alert('Ошибка при сохранении на сервере');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-2xl w-full max-w-lg">
                <h2 className="text-2xl font-bold mb-6 text-center">Редактировать товар</h2>

                <div className="flex flex-col gap-4">
                    <input
                        type="number"
                        value={quantity}
                        placeholder={item.quantity || ""}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="border border-gray-300 dark:border-neutral-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                    <input
                        type="text"
                        value={location}
                        placeholder="Местоположение"
                        onChange={(e) => setLocation(e.target.value)}
                        className="border border-gray-300 dark:border-neutral-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                    <input
                        type="text"
                        value={shelf}
                        placeholder="Полка"
                        onChange={(e) => setShelf(e.target.value)}
                        className="border border-gray-300 dark:border-neutral-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                </div>

                {!available && <p className="text-red-600 mt-2 text-center">Места на этой полке недостаточно!</p>}

                <div className="mt-6 flex justify-center gap-4">
                    <button
                        onClick={handleSave}
                        disabled={!available || quantity === ""}
                        className="bg-black text-white py-2 px-6 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition"
                    >
                        Сохранить
                    </button>
                    <button
                        onClick={onClose}
                        className="py-2 px-6 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                    >
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    );
}
