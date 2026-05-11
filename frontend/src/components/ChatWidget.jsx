import { useEffect, useRef, useState } from "react";
import "./ChatWidget.css";
import { API_URL } from "../services/api";

export default function ChatWidget({ presetMessage }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState({ items: [], total: 0 });
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    pickupTime: "",
    transferred: false
  });
  const [receiptFileName, setReceiptFileName] = useState("");
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

  const buildWhatsAppText = () => {
    const lines = [];

    lines.push("Hola! Quiero hacer este pedido:\n");

    lines.push("Pedido:");
    for (const item of order.items || []) {
      const name = item.name || "Producto";

      let qty = "";
      if (item.grams) {
        qty = `${item.grams}g`;
      } else {
        const unit = String(item.unit || "").toLowerCase();
        const q = item.quantity ?? 1;
        if (unit === "1kg" || unit === "kg") qty = `${q}kg`;
        else if (unit === "1lt" || unit === "lt" || unit === "l") qty = `${q}lt`;
        else if (unit) qty = `${q} ${unit}`;
        else qty = String(q);
      }

      const total = Number(item.total);
      const price = Number.isFinite(total) && total > 0 ? ` ($${total.toLocaleString("es-AR")})` : "";
      lines.push(`- ${name}: ${qty}${price}`);
    }

    if (order.total) {
      lines.push(`\nTotal aprox: $${Number(order.total).toLocaleString("es-AR")}\n`);
    } else {
      lines.push("");
    }

    lines.push("Datos:");
    lines.push(`Nombre: ${customer.name.trim()}`);
    lines.push(`Teléfono: ${customer.phone.trim()}`);
    lines.push(`Retiro: ${customer.pickupTime.trim()}`);
    lines.push(`Pago: ${customer.transferred ? "Transferencia (adjunto comprobante)" : "Al retirar"}`);

    lines.push("\n¿Me lo preparan para retirar?");

    return lines.join("\n");
  };

  const whatsappUrl =
    order.items?.length > 0 ? `https://wa.me/5492994221315?text=${encodeURIComponent(buildWhatsAppText())}` : "";

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
        body: JSON.stringify({ message: messageToSend, order, customer })
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

  const customerComplete =
    customer.name.trim().length > 0 &&
    customer.phone.trim().length > 0 &&
    customer.pickupTime.trim().length > 0;

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

          {order.items?.length > 0 && (
            <div className="chat-actions">
              <div className="chat-form">
                <div className="chat-form-row">
                  <label>
                    Nombre y apellido
                    <input
                      value={customer.name}
                      onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
                      placeholder="Ej: Juan Pérez"
                    />
                  </label>
                  <label>
                    Teléfono
                    <input
                      value={customer.phone}
                      onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
                      placeholder="Ej: 299 123 4567"
                    />
                  </label>
                </div>

                <label>
                  Horario aproximado de retiro
                  <input
                    value={customer.pickupTime}
                    onChange={(e) => setCustomer((c) => ({ ...c, pickupTime: e.target.value }))}
                    placeholder="Ej: hoy 18:30 / mañana 10:00"
                  />
                </label>

                <div className="chat-form-row chat-form-inline">
                  <label className="chat-checkbox">
                    <input
                      type="checkbox"
                      checked={customer.transferred}
                      onChange={(e) => setCustomer((c) => ({ ...c, transferred: e.target.checked }))}
                    />
                    Ya transferí
                  </label>

                  {customer.transferred && (
                    <label className="chat-receipt">
                      Comprobante (opcional)
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setReceiptFileName(e.target.files?.[0]?.name || "")}
                      />
                      {receiptFileName ? <span className="chat-file">{receiptFileName}</span> : null}
                      <span className="chat-receipt-hint">Se adjunta manualmente en WhatsApp.</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="chat-order-hint">
                Pedido: {order.items.length} item{order.items.length === 1 ? "" : "s"} • Total aprox: $
                {order.total.toLocaleString("es-AR")}
              </div>
              <a
                className={`chat-whatsapp ${customerComplete ? "" : "disabled"}`}
                href={customerComplete ? whatsappUrl : undefined}
                onClick={(e) => {
                  if (!customerComplete) e.preventDefault();
                }}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!customerComplete}
              >
                Enviar por WhatsApp
              </a>
              {!customerComplete && (
                <div className="chat-order-hint">Completá tus datos para poder enviar el pedido.</div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
