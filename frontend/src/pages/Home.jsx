import "./Home.css";
import { useState } from "react";
import { API_URL } from "../services/api";
import ChatWidget from "../components/ChatWidget";

export default function Home({ products }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [chatInput, setChatInput] = useState("");

  const consultarProducto = (p) => {
    setChatInput(`Quiero comprar ${p.name}`);
  };

  const handleChat = async (message) => {
    try {
      const res = await fetch("http://localhost:3000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message })
      });

      const data = await res.json();

      console.log("FER:", data.reply);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "todos" || p.category === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="container">
      {/* HEADER */}
      <div className="header">
        <h1>El Viejo Almacén Todo Suelto</h1>

        <input
          className="search"
          type="text"
          placeholder="Buscar productos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* FILTROS */}
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

      {/* GRID */}
      <div className="products-grid">
        {filteredProducts.map((p) => (
          <div key={p.id} className="card">
            <img src={`${API_URL}${p.imageUrl}`} alt={p.name} />

            <h3>{p.name}</h3>

            <p className="price">
              ${p.pricePerKg} <span>/kg</span>
            </p>

            <p className="category">{p.category}</p>

            <button onClick={() => consultarProducto(p)}>Consultar</button>
          </div>
        ))}
      </div>

      <ChatWidget presetMessage={chatInput} />
    </div>
  );
}
