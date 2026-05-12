import { useEffect, useMemo, useRef, useState } from "react";
import "./ChatWidget.css";
import { API_URL } from "../services/api";
import { useOrder } from "../lib/orderContext";

function formatARS(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export default function ChatWidget({ presetMessage, suggestProduct, embedded = false }) {
  const { order, setOrder, setView, previewTotals, view } = useOrder();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [quickGrams, setQuickGrams] = useState("");
  const [quickKg, setQuickKg] = useState("");
  const [suggestedTotal, setSuggestedTotal] = useState(0);
  const [showSuggestPanel, setShowSuggestPanel] = useState(false);

  const [messages, setMessages] = useState([
    { from: "fer", text: "Hola, soy FER. ¿Qué estás buscando hoy?" }
  ]);

  const bodyRef = useRef(null);

  const itemsCount = order.items?.length || 0;

  useEffect(() => {
    if (presetMessage) {
      setInput(presetMessage);
      setOpen(true);
    }
  }, [presetMessage]);

  useEffect(() => {
    if (!open) return;
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages.length, loading]);

  const describeProduct = (product) => {
    const name = product?.name || "Este producto";
    const category = String(product?.category || "").toLowerCase();

    let note = "Buena opción para sumar al día a día.";
    if (category.includes("frutos")) note = "Ideal para snacks, granolas o repostería.";
    else if (category.includes("condimento")) note = "Perfecto para darle sabor a tus comidas.";
    else if (category.includes("harina")) note = "Útil para panificados, rebozados o repostería.";
    else if (category.includes("legumbre")) note = "Rinde un montón para guisos, ensaladas o sopas.";
    else if (category.includes("semilla")) note = "Excelente para ensaladas, yogur o panes.";
    else if (category.includes("cereal") || category.includes("copetin")) note = "Ideal para picar o armar mix.";

    return `Te cuento rápido sobre ${name}:\n${note}\n\n¿Querés que lo agregue al pedido?`;
  };

  useEffect(() => {
    if (!suggestProduct?.id) return;
    setOpen(true);
    setShowSuggestPanel(true);
    setMessages((prev) => [...prev, { from: "fer", text: describeProduct(suggestProduct) }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestProduct?.id]);

  const suggestedGrams = useMemo(() => {
    const grams = Number(String(quickGrams || "").replace(",", "."));
    if (Number.isFinite(grams) && grams > 0) return Math.round(grams);
    const kg = Number(String(quickKg || "").replace(",", "."));
    if (Number.isFinite(kg) && kg > 0) return Math.round(kg * 1000);
    return 0;
  }, [quickGrams, quickKg]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!suggestProduct || !showSuggestPanel || suggestedGrams <= 0) {
        setSuggestedTotal(0);
        return;
      }

      try {
        const priced = await previewTotals([
          {
            productId: suggestProduct.id,
            name: suggestProduct.name,
            grams: suggestedGrams
          }
        ]);
        if (!active) return;
        setSuggestedTotal(Number(priced?.total) || 0);
      } catch {
        if (!active) return;
        setSuggestedTotal(0);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [previewTotals, suggestProduct, suggestedGrams, showSuggestPanel]);

  const addSuggestedFromInputs = async () => {
    if (!suggestProduct || suggestedGrams <= 0) return;

    const nextItems = [
      ...(order.items || []),
      {
        productId: suggestProduct.id,
        name: suggestProduct.name,
        grams: suggestedGrams
      }
    ];

    try {
      const priced = await previewTotals(nextItems);
      setOrder({
        items: Array.isArray(priced?.items) ? priced.items : nextItems,
        total: Number(priced?.total) || 0
      });
      setQuickGrams("");
      setQuickKg("");
      setShowSuggestPanel(false);
      setMessages((prev) => [...prev, { from: "fer", text: "Listo, lo sumé al pedido 🙌" }]);
    } catch {
      setMessages((prev) => [...prev, { from: "fer", text: "No pude agregarlo al pedido. Probá de nuevo." }]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const messageToSend = input;
    setMessages((prev) => [...prev, { from: "user", text: messageToSend }]);
    setInput("");
    // While the user is chatting, hide the grams/kg panel until they consult/add again.
    setShowSuggestPanel(false);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend, order })
      });
      const data = await res.json();
      if (data.order) setOrder(data.order);
      setMessages((prev) => [...prev, { from: "fer", text: data.reply || "OK" }]);
    } catch {
      setMessages((prev) => [...prev, { from: "fer", text: "No pude conectar. Intentá de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  const isOpen = embedded ? true : open;

  return (
    <>
      {!embedded && (
        <button className="chat-fab" onClick={() => setOpen((v) => !v)} aria-label="Abrir chat con FER">
          <span className="chat-fab-icon" aria-hidden="true">
            💬
          </span>
        </button>
      )}

      {isOpen && (
        <div className={`chat-window ${embedded ? "embedded" : ""}`} role="dialog" aria-label="Chat con FER">
          <div className="chat-topbar">
            <div className="chat-title">
              <span className="chat-dot" aria-hidden="true" />
              asistente virtual
            </div>
            {!embedded && (
              <button className="chat-close" onClick={() => setOpen(false)} aria-label="Cerrar chat">
                ×
              </button>
            )}
          </div>

          <div className="chat-body" ref={bodyRef}>
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.from}`}>
                {m.text}
              </div>
            ))}
            {loading && <div className="msg fer">Escribiendo…</div>}
          </div>

          <div className="chat-input">
            <input
              type="text"
              placeholder="Escribí tu mensaje…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button onClick={sendMessage} disabled={loading}>
              enviar
            </button>
          </div>

          <div className="chat-bottom">
            {suggestProduct && showSuggestPanel && (
              <div className="chat-suggest">
                <div className="chat-suggest-fields">
                  <label>
                    Gramos
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      placeholder="Ej: 250"
                      value={quickGrams}
                      onChange={(e) => setQuickGrams(e.target.value)}
                    />
                  </label>
                  <label>
                    Kilos
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      inputMode="decimal"
                      placeholder="Ej: 0,5"
                      value={quickKg}
                      onChange={(e) => setQuickKg(e.target.value)}
                    />
                  </label>
                  <div className="chat-suggest-total" aria-live="polite">
                    Total aprox: <b>${formatARS(suggestedTotal)}</b>
                    {suggestedGrams > 0 ? <span> ({suggestedGrams}g)</span> : null}
                  </div>
                </div>
                <button type="button" className="chat-suggest-add" onClick={addSuggestedFromInputs}>
                  Agregar
                </button>
              </div>
            )}

            {view !== "order" && (
              <div className="chat-orderbar">
                <button type="button" className="chat-orderbar-btn" onClick={() => setView("order")}>
                  Ver mi pedido ({itemsCount})
                </button>
                <div className="chat-orderbar-total">
                  Total: $
                  {Number(order.total || 0).toLocaleString("es-AR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
