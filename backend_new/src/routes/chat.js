import express from "express";
import prisma from "../prisma.js";
import OpenAI from "openai";
import { z } from "zod";

const router = express.Router();

const WHATSAPP_NUMBER = "5492994221315";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function calcularPrecio(mensaje, productos) {
  const regex = /(\d+)\s?(g|kg)/i;
  const match = mensaje.match(regex);

  if (!match) return null;

  let cantidad = parseInt(match[1]);
  const unidad = match[2].toLowerCase();

  if (unidad === "kg") cantidad = cantidad * 1000;

  const producto = productos.find((p) => mensaje.toLowerCase().includes(p.name.toLowerCase()));
  if (!producto) return null;

  const precioPorGramo = (producto.pricePerKg || 0) / 1000;
  const total = cantidad * precioPorGramo;

  return {
    producto: producto.name,
    gramos: cantidad,
    total: Math.round(total)
  };
}

function parseQuantity(message) {
  const m = message.match(/(\d+(?:[.,]\d+)?)\s?(kg|k|g|gr)\b/i);
  if (!m) return null;
  const value = Number(String(m[1]).replace(",", "."));
  if (!Number.isFinite(value)) return null;
  const unit = m[2].toLowerCase();
  if (unit === "kg" || unit === "k") return { grams: Math.round(value * 1000) };
  return { grams: Math.round(value) };
}

function findProductInMessage(message, products) {
  const msg = normalize(message);
  let best = null;
  let bestLen = 0;

  for (const p of products) {
    const name = normalize(p.name);
    if (!name) continue;
    if (msg.includes(name) && name.length > bestLen) {
      best = p;
      bestLen = name.length;
    }
  }
  return best;
}

function formatMoneyARS(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return Math.round(safe).toLocaleString("es-AR");
}

function computeOrderTotals(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const total = items.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
  return { items, total: Math.round(total) };
}

function formatOrderSummary(order) {
  if (!order?.items?.length) return "";
  const lines = order.items.map((it) => {
    const qty = it.grams ? `${it.grams}g` : `${it.quantity ?? 1} ${it.unit ?? ""}`.trim();
    const price = it.total ? `$${formatMoneyARS(it.total)}` : "";
    return `- ${it.name}: ${qty}${price ? ` (${price})` : ""}`;
  });
  const total = order.total ? `\nTotal aprox: $${formatMoneyARS(order.total)}` : "";
  return `Pedido:\n${lines.join("\n")}${total}`;
}

function buildWhatsAppText(order) {
  const summary = formatOrderSummary(order);
  return `Hola! Quiero hacer este pedido:\n\n${summary}\n\n¿Me lo preparan para retirar?`;
}

function updateOrderFromMessage(message, products, currentOrder) {
  const order = computeOrderTotals(currentOrder);
  const msg = normalize(message);

  if (msg.includes("vaciar") || msg.includes("cancelar pedido") || msg.includes("borrar pedido")) {
    return { items: [], total: 0 };
  }

  const product = findProductInMessage(message, products);
  if (!product) return order;

  const shouldRemove = msg.includes("quitar") || msg.includes("sacar") || msg.includes("eliminar");
  if (shouldRemove) {
    const next = order.items.filter((it) => normalize(it.name) !== normalize(product.name));
    return computeOrderTotals({ items: next });
  }

  const qty = parseQuantity(message);
  const existingIndex = order.items.findIndex((it) => normalize(it.name) === normalize(product.name));

  let item;
  if (qty?.grams) {
    const pricePerGram = (product.pricePerKg || 0) / 1000;
    const total = qty.grams * pricePerGram;
    item = {
      id: product.id,
      name: product.name,
      grams: qty.grams,
      total: Math.round(total)
    };
  } else {
    const unit = product.unit || "kg";
    const price = product.price || 0;
    item = {
      id: product.id,
      name: product.name,
      unit,
      quantity: 1,
      total: Math.round(price)
    };
  }

  const next = [...order.items];
  if (existingIndex >= 0) next[existingIndex] = item;
  else next.push(item);

  return computeOrderTotals({ items: next });
}

router.post("/", async (req, res) => {
  try {
    const orderItemSchema = z.object({
      id: z.number().int().optional(),
      name: z.string(),
      grams: z.number().int().optional(),
      unit: z.string().optional(),
      quantity: z.number().int().optional(),
      total: z.number().int().optional()
    });

    const bodySchema = z.object({
      message: z.string().min(1),
      order: z
        .object({
          items: z.array(orderItemSchema).default([])
        })
        .optional()
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
    }

    const { message, order: incomingOrder } = parsed.data;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const productos = await prisma.product.findMany({ take: 200 });
    const updatedOrder = updateOrderFromMessage(message, productos, incomingOrder);

    const calculo = calcularPrecio(message, productos);
    if (calculo) {
      let extra = "";
      if (normalize(calculo.producto) === "almendras") {
        extra = "👉 También tenemos nueces y mix premium que combinan perfecto 👌";
      }

      return res.json({
        reply: `💰 ${calculo.gramos}g de ${calculo.producto} te salen $${formatMoneyARS(calculo.total)}.\n\n👉 ¿Querés que te lo prepare?\n\nDecime “quiero llevarlo” y te paso el WhatsApp.\n\n${extra}`,
        order: updatedOrder,
        whatsappText: updatedOrder.items.length ? buildWhatsAppText(updatedOrder) : undefined,
        whatsappUrl: updatedOrder.items.length
          ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppText(updatedOrder))}`
          : undefined
      });
    }

    if (normalize(message).includes("quiero") || normalize(message).includes("llevar")) {
      return res.json({
        reply: `Genial 🙌\n\nTe lo dejo preparado sin problema.\n\n📲 WhatsApp: 2994221315\n\nSi querés, tocá “Enviar por WhatsApp” y me llega tu pedido completo 👌`,
        order: updatedOrder,
        whatsappText: updatedOrder.items.length ? buildWhatsAppText(updatedOrder) : undefined,
        whatsappUrl: updatedOrder.items.length
          ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppText(updatedOrder))}`
          : undefined
      });
    }

    const productContext = productos.map((p) => `${p.name} - $${p.pricePerKg}/kg`).join("\n");
    const prompt = `Sos FER, vendedor de almacén.\n\nProductos:\n${productContext}\n\nSi el usuario pide armar un pedido, pedile cantidades (en g o kg) y confirmá el resumen.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: message }
      ]
    });

    const suffix = updatedOrder.items.length ? `\n\n${formatOrderSummary(updatedOrder)}` : "";
    const reply = `${response.choices[0].message.content}${suffix}`;

    res.json({
      reply,
      order: updatedOrder,
      whatsappText: updatedOrder.items.length ? buildWhatsAppText(updatedOrder) : undefined,
      whatsappUrl: updatedOrder.items.length
        ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppText(updatedOrder))}`
        : undefined
    });
  } catch (err) {
    console.error(err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Chat error", detail });
  }
});

export default router;

