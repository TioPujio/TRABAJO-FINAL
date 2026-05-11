import { createContext, useContext, useMemo, useRef, useState } from "react";
import { API_URL } from "../services/api";

const OrderContext = createContext(null);

const EMPTY_ORDER = { items: [], total: 0 };

export function OrderProvider({ children }) {
  const [view, setView] = useState("catalog"); // "catalog" | "order"
  const [order, setOrder] = useState(EMPTY_ORDER);
  const [orderId, setOrderId] = useState(null);
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    pickupTime: "",
    transferred: false
  });
  const [receiptFileName, setReceiptFileName] = useState("");

  // Avoid racey updates while typing quantities
  const refreshingRef = useRef(false);

  const customerComplete =
    customer.name.trim().length > 0 &&
    customer.phone.trim().length > 0 &&
    customer.pickupTime.trim().length > 0;

  const previewTotals = async (items) => {
    const res = await fetch(`${API_URL}/orders/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    if (!res.ok) throw new Error("preview_failed");
    return res.json();
  };

  const normalizePriced = (priced) => ({
    items: Array.isArray(priced?.items) ? priced.items : [],
    total: Number.isFinite(Number(priced?.total)) ? Number(priced.total) : 0
  });

  const refreshOrderTotals = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const priced = await previewTotals(order.items || []);
      const normalized = normalizePriced(priced);
      setOrder(normalized);
    } finally {
      refreshingRef.current = false;
    }
  };

  const clearOrder = () => {
    setOrder(EMPTY_ORDER);
    setOrderId(null);
    setCustomer({ name: "", phone: "", pickupTime: "", transferred: false });
    setReceiptFileName("");
  };

  const value = useMemo(
    () => ({
      view,
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
      previewTotals,
      refreshOrderTotals,
      clearOrder
    }),
    [view, order, orderId, customer, receiptFileName, customerComplete]
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrder must be used inside <OrderProvider>");
  return ctx;
}

