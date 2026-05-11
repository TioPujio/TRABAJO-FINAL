import "./Home.css";
import { useMemo, useState } from "react";
import { API_URL } from "../services/api";
import ChatWidget from "../components/ChatWidget";
import logo from "../assets/logo.svg";

const CATEGORIES = [
  "TODAS",
  "FRUTOS SECOS",
  "CONDIMENTOS",
  "CHACINADOS",
  "HARINAS",
  "LEGUMBRES",
  "SEMILLAS",
  "ARTICULOS DE LIMPIEZA",
  "REPOSTERIA",
  "CEREALES",
  "GRANOS",
  "COPETIN",
  "EMBASADOS",
  "SIN TACC",
  "SIN GLUTEN"
];

function toTitleCase(value) {
  const lowerWords = new Set(["de", "y", "con", "sin", "a", "en", "x"]);
  const parts = String(value || "")
    .trim()
    .toLowerCase()
    .split(" ")
    .filter(Boolean);

  return parts
    .map((w, idx) => {
      if (idx !== 0 && lowerWords.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

function formatUnit(unit) {
  const u = String(unit || "kg").toLowerCase();
  if (u === "1kg") return "kg";
  if (u === "unidad") return "unidad";
  if (u === "paquete") return "paquete";
  if (u === "madeja") return "madeja";
  if (u === "1lt" || u === "lt" || u === "l") return "lt";
  if (u === "1m" || u === "m") return "m";
  if (u === "100gr" || u === "100g") return "100gr";
  return u;
}

function formatPrice(product) {
  const unit = formatUnit(product.unit || "kg");
  const price = Number(product.price);
  if (Number.isFinite(price) && price > 0) {
    return { value: price, unit };
  }
  const fallback = Number(product.pricePerKg);
  return { value: Number.isFinite(fallback) ? fallback : 0, unit: "kg" };
}

export default function Home({ products }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("TODAS");
  const [chatInput, setChatInput] = useState("");
  const [catOpen, setCatOpen] = useState(false);

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
    const productCategory = String(product.category || "").toUpperCase();
    const matchFilter = filter === "TODAS" || productCategory === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <img className="brand-logo" src={logo} alt="" aria-hidden="true" />
          <h1>El Viejo Almacén Todo Suelto</h1>
        </div>

        <div className="header-controls">
          <div
            className="category-menu"
            onMouseEnter={() => setCatOpen(true)}
            onMouseLeave={() => setCatOpen(false)}
          >
            <button
              type="button"
              className="category-button"
              onClick={() => setCatOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={catOpen}
            >
              Categorías
              <span className="category-caret" aria-hidden="true">
                ▾
              </span>
            </button>

            {catOpen && (
              <div className="category-dropdown" role="menu">
                {CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    role="menuitem"
                    className={`category-item ${filter === cat ? "active" : ""}`}
                    onClick={() => {
                      setFilter(cat);
                      setCatOpen(false);
                    }}
                  >
                    {toTitleCase(cat)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            className="search"
            type="text"
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="products-grid">
        {filteredProducts.map((product) => (
          <div key={product.id} className="card">
            {product.imageUrl ? (
              <img src={`${API_URL}${product.imageUrl}`} alt={product.name} loading="lazy" />
            ) : (
              <div className="img-placeholder" aria-hidden="true" />
            )}

            <h3>{product.name}</h3>

            {(() => {
              const p = formatPrice(product);
              return (
                <p className="price">
                  ${p.value} <span>/{p.unit}</span>
                </p>
              );
            })()}

            <p className="category">{toTitleCase(product.category)}</p>

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
