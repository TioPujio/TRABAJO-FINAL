import { useMemo, useState } from "react";
import { API_URL } from "../services/api";
import { useOrder } from "../lib/orderContext";
import ChatWidget from "../components/ChatWidget";
import "./Order.css";

const WHATSAPP_NUMBER = "5492994221315";

function formatARS(value) {
  return Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OrderPage() {
  const {
    setView,
    order,
    setOrder,
    orderId,
    setOrderId,
    customer,
    setCustomer,
    receiptFileName,
    setReceiptFileName,
    customerComplete,
    refreshOrderTotals,
    clearOrder
  } = useOrder();

  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const items = order.items || [];

  const totalText = useMemo(() => formatARS(order.total), [order.total]);

  const buildWhatsAppText = (finalOrderId) => {
    const lines = [];

    lines.push("Hola! Quiero hacer este pedido:\n");
    if (finalOrderId) lines.push(`Pedido #${finalOrderId}\n`);

    lines.push("Pedido:");
    for (const item of items) {
      const name = item.name || "Producto";

      let qty = "";
      if (typeof item.grams === "number") {
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
      const price =
        Number.isFinite(total) && total > 0
          ? ` ($${total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
          : "";

      lines.push(`- ${name}: ${qty}${price}`);
    }

    lines.push(`\nTotal aprox: $${formatARS(order.total)}\n`);

    lines.push("Datos:");
    lines.push(`Nombre: ${customer.name.trim()}`);
    lines.push(`Teléfono: ${customer.phone.trim()}`);
    lines.push(`Retiro: ${customer.pickupTime.trim()}`);
    lines.push(`Pago: ${customer.transferred ? "Transferencia (adjunto comprobante)" : "Al retirar"}`);
    if (customer.transferred) {
      lines.push(receiptFileName ? `Comprobante: ${receiptFileName}` : "Comprobante: (adjunto en WhatsApp)");
    }

    lines.push("\n¿Me lo preparan para retirar?");

    return lines.join("\n");
  };

  const createOrder = async () => {
    const res = await fetch(`${API_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          pickupTime: customer.pickupTime.trim(),
          transferred: Boolean(customer.transferred)
        },
        items
      })
    });
    if (!res.ok) throw new Error("create_failed");
    return res.json();
  };

  const sendToWhatsApp = async () => {
    if (!customerComplete || creating || !items.length) return;
    setCreating(true);
    try {
      const created = await createOrder();
      setOrderId(created.id);
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppText(created.id))}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setCreating(false);
    }
  };

  const recalc = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshOrderTotals();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="order-page">
      <div className="order-top">
        <button type="button" className="order-back" onClick={() => setView("catalog")}>
          ← Volver al catálogo
        </button>
        <h2>Mi pedido</h2>
        <div className="order-total order-total-top">
          Total aprox: <b>${totalText}</b>
          {orderId ? <span className="order-id"> #{orderId}</span> : null}
        </div>
      </div>

      <div className="order-layout">
        <div className="order-main">
          {items.length === 0 ? (
            <div className="order-empty">
              Todavía no agregaste productos. Volvé al catálogo y tocá “Consultar” para sumar al pedido.
            </div>
          ) : (
            <>
              <div className="order-actions">
                <button type="button" className="order-secondary" onClick={recalc} disabled={refreshing}>
                  {refreshing ? "Recalculando…" : "Recalcular totales"}
                </button>
                <button type="button" className="order-secondary" onClick={clearOrder}>
                  Vaciar pedido
                </button>
              </div>

              <div className="order-list">
                {items.map((it, idx) => (
                  <div key={`${it.name}-${idx}`} className="order-line">
                    <div className="order-line-main">
                      <div className="order-line-name">{it.name}</div>
                      <div className="order-line-sub">
                        {typeof it.grams === "number" ? `${it.grams}g` : `${it.quantity ?? 1} ${it.unit || ""}`.trim()}
                      </div>
                    </div>

                    <div className="order-line-controls">
                      {typeof it.grams === "number" ? (
                        <input
                          type="number"
                          min="0"
                          value={it.grams}
                          onChange={(e) => {
                            const grams = Math.max(0, Number(e.target.value || 0));
                            setOrder((o) => {
                              const next = [...(o.items || [])];
                              next[idx] = { ...next[idx], grams };
                              return { ...o, items: next };
                            });
                          }}
                          aria-label={`Gramos de ${it.name}`}
                        />
                      ) : (
                        <input
                          type="number"
                          min="0"
                          value={it.quantity ?? 1}
                          onChange={(e) => {
                            const quantity = Math.max(0, Number(e.target.value || 0));
                            setOrder((o) => {
                              const next = [...(o.items || [])];
                              next[idx] = { ...next[idx], quantity };
                              return { ...o, items: next };
                            });
                          }}
                          aria-label={`Cantidad de ${it.name}`}
                        />
                      )}

                      <div className="order-line-price">${formatARS(it.total || 0)}</div>
                      <button
                        type="button"
                        className="order-remove"
                        onClick={() => setOrder((o) => ({ ...o, items: (o.items || []).filter((_, i) => i !== idx) }))}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="order-total order-total-mid" aria-live="polite">
                Total aprox: <b>${totalText}</b>
                {orderId ? <span className="order-id"> #{orderId}</span> : null}
              </div>

              <div className="order-form">
                <h3>Datos para retirar</h3>

                <div className="order-form-row">
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

                <label className="order-check">
                  <input
                    type="checkbox"
                    checked={customer.transferred}
                    onChange={(e) => setCustomer((c) => ({ ...c, transferred: e.target.checked }))}
                  />
                  Ya transferí
                </label>

                {customer.transferred && (
                  <label>
                    Comprobante (opcional)
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setReceiptFileName(e.target.files?.[0]?.name || "")}
                    />
                    {receiptFileName ? <div className="order-file">{receiptFileName}</div> : null}
                    <div className="order-hint">Se adjunta manualmente en WhatsApp.</div>
                  </label>
                )}

                <button
                  type="button"
                  className={`order-whatsapp ${customerComplete && !creating ? "" : "disabled"}`}
                  onClick={sendToWhatsApp}
                  disabled={!customerComplete || creating}
                >
                  {creating ? "Generando…" : "Enviar pedido por WhatsApp"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="order-chat">
          <ChatWidget embedded />
        </div>
      </div>
    </div>
  );
}
