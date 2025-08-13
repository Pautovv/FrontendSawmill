import React, { useEffect, useState } from "react";
import WoodTable from "../ui/WoodTable";

export default function PlanedProductStorage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:3001/inventory?category=PLANED_PRODUCTS")
      .then((res) => res.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-lg">Загрузка...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Бревно</h1>
      <WoodTable items={items} />
    </div>
  );
}
