import { useEffect, useState } from "react";
import API from "./services/api";
import Home from "./pages/Home";

function App() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    API.get("/products")
      .then((res) => setProducts(res.data || []))
      .catch(() => setProducts([]));
  }, []);

  return <Home products={products} />;
}

export default App
