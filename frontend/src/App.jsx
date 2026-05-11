import { useEffect, useState } from "react";
import API from "./services/api";
import Home from "./pages/Home";
import OrderPage from "./pages/Order";
import { OrderProvider, useOrder } from "./lib/orderContext";

function AppInner() {
  const [products, setProducts] = useState([]);
  const { view } = useOrder();

  useEffect(() => {
    API.get("/products")
      .then((res) => setProducts(res.data || []))
      .catch(() => setProducts([]));
  }, []);

  if (view === "order") return <OrderPage />;
  return <Home products={products} />;
}

export default function App() {
  return (
    <OrderProvider>
      <AppInner />
    </OrderProvider>
  );
}
