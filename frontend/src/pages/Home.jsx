import "./Home.css";
import { useMemo, useState } from "react";
import { API_URL } from "../services/api";
import ChatWidget from "../components/ChatWidget";
import logo from "../assets/logo.svg";

export default function Home({ products }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [chatInput, setChatInput] = useState("");

  const consultarProducto = (product) => {
    setChatInput(`Quiero comprar ${product.name}`);
  };

  const dedupedProducts = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const product of products) {
      const key = `${product.name}|${product.category}|${product.pricePerKg}|${product.imageUrl}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(product);
    }
    return out;
  }, [products]);

  const filteredProducts = dedupedProducts.filter((product) => {
    const matchSearch = product.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "todos" || product.category === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <img className="brand-logo" src={logo} alt="" aria-hidden="true" />
          <h1>El Viejo Almacén Todo Suelto</h1>
        </div>

        <input
          className="search"
          type="text"
          placeholder="Buscar productos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="filters">
        {["todos", "frutos secos", "semillas", "harinas", "legumbres", "especias"].map((cat) => (
          <button
            key={cat}
            className={`filter ${filter === cat ? "active" : ""}`}
            onClick={() => setFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="products-grid">
        {filteredProducts.map((product) => (
          <div key={product.id} className="card">
            <img src={`${API_URL}${product.imageUrl}`} alt={product.name} loading="lazy" />

            <h3>{product.name}</h3>

            <p className="price">
              ${product.pricePerKg} <span>/kg</span>
            </p>

            <p className="category">{product.category}</p>

            <button className="consult" onClick={() => consultarProducto(product)}>
              Consultar
            </button>
          </div>
        ))}
      </div>

      <ChatWidget presetMessage={chatInput} />
    </div>
  );
}
