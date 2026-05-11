import { useEffect, useRef, useState } from "react";
import "./ChatWidget.css";
import { API_URL } from "../services/api";

export default function ChatWidget({ presetMessage }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState({ items: [], total: 0 });
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [messages, setMessages] = useState([
    { from: "fer", text: "Hola, soy FER. ¿Qué estás buscando hoy?" }
  ]);

  const bodyRef = useRef(null);

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

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const messageToSend = input;
    setMessages((prev) => [...prev, { from: "user", text: messageToSend }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend, order })
      });
      const data = await res.json();
      if (data.order) setOrder(data.order);
      if (data.whatsappUrl) setWhatsappUrl(data.whatsappUrl);
      setMessages((prev) => [...prev, { from: "fer", text: data.reply || "OK" }]);
    } catch {
      setMessages((prev) => [...prev, { from: "fer", text: "No pude conectar. Intentá de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen((v) => !v)} aria-label="Abrir chat con FER">
        <span className="chat-fab-icon" aria-hidden="true">
          💬
        </span>
      </button>

      {open && (
        <div className="chat-window" role="dialog" aria-label="Chat con FER">
          <div className="chat-topbar">
            <div className="chat-title">
              <span className="chat-dot" aria-hidden="true" />
              asistente virtual
            </div>
            <button className="chat-close" onClick={() => setOpen(false)} aria-label="Cerrar chat">
              ×
            </button>
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

          {order.items?.length > 0 && whatsappUrl && (
            <div className="chat-actions">
              <div className="chat-order-hint">
                Pedido: {order.items.length} item{order.items.length === 1 ? "" : "s"} • Total aprox: $
                {order.total.toLocaleString("es-AR")}
              </div>
              <a className="chat-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">
                Enviar por WhatsApp
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}

