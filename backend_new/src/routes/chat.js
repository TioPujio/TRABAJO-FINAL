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
  return safe.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function computeOrderTotals(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const total = items.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
  return { items, total: Math.round(total) };
}

function formatOrderSummary(order) {
  if (!order?.items?.length) return "";
  const lines = order.items.map((it) => {
    const unit = String(it.unit || "").toLowerCase() === "1kg" ? "kg" : String(it.unit || "");
    const qty = it.grams ? `${it.grams}g` : `${it.quantity ?? 1} ${unit}`.trim();
    const price = it.total ? `$${formatMoneyARS(it.total)}` : "";
    return `- ${it.name}: ${qty}${price ? ` (${price})` : ""}`;
  });
  const total = order.total ? `\nTotal aprox: $${formatMoneyARS(order.total)}` : "";
  return `Pedido:\n${lines.join("\n")}${total}`;
}

function buildWhatsAppText(order, customer) {
  const summary = formatOrderSummary(order);

  const name = customer?.name ? String(customer.name).trim() : "";
  const phone = customer?.phone ? String(customer.phone).trim() : "";
  const pickupTime = customer?.pickupTime ? String(customer.pickupTime).trim() : "";
  const transferred = Boolean(customer?.transferred);

  const customerLines = [
    name ? `Nombre: ${name}` : null,
    phone ? `Teléfono: ${phone}` : null,
    pickupTime ? `Retiro: ${pickupTime}` : null,
    `Pago: ${transferred ? "Transferencia (adjunto comprobante)" : "Al retirar"}`
  ].filter(Boolean);

  const customerBlock = customerLines.length ? `\n\nDatos:\n${customerLines.join("\n")}` : "";

  return `Hola! Quiero hacer este pedido:\n\n${summary}${customerBlock}\n\n¿Me lo preparan para retirar?`;
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
    const next = order.items.filter((it) => {
      if (typeof it.productId === "number") return it.productId !== product.id;
      return normalize(it.name) !== normalize(product.name);
    });
    return computeOrderTotals({ items: next });
  }

  const qty = parseQuantity(message);
  const existingIndex = order.items.findIndex((it) => {
    if (typeof it.productId === "number") return it.productId === product.id;
    return normalize(it.name) === normalize(product.name);
  });

  let item;
  if (qty?.grams) {
    const pricePerGram = (product.pricePerKg || 0) / 1000;
    const total = qty.grams * pricePerGram;
    item = {
      productId: product.id,
      name: product.name,
      grams: qty.grams,
      total: Math.round(total)
    };
  } else {
    const rawUnit = product.unit || "kg";
    const unit = rawUnit.toLowerCase() === "1kg" ? "kg" : rawUnit;
    const price = product.price || 0;
    const unitPrice = price > 0 ? price : unit.toLowerCase() === "kg" ? product.pricePerKg || 0 : 0;

    // For kg-priced items, keep everything in grams for consistent editing (1000g = 1kg).
    if (unit.toLowerCase() === "kg") {
      const grams = 1000;
      const pricePerGram = (product.pricePerKg || 0) / 1000;
      const total = grams * pricePerGram;
      item = {
        productId: product.id,
        name: product.name,
        grams,
        total: Math.round(total)
      };
    } else {
      item = {
        productId: product.id,
        name: product.name,
        unit,
        quantity: 1,
        total: Math.round(unitPrice)
      };
    }
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
      productId: z.number().int().optional(),
      name: z.string(),
      grams: z.number().int().optional(),
      unit: z.string().optional(),
      quantity: z.number().int().optional(),
      total: z.number().int().optional()
    });

    const customerSchema = z
      .object({
        name: z.string().optional(),
        phone: z.string().optional(),
        pickupTime: z.string().optional(),
        transferred: z.boolean().optional()
      })
      .optional();

    const bodySchema = z.object({
      message: z.string().min(1),
      order: z
        .object({
          items: z.array(orderItemSchema).default([])
        })
        .optional(),
      customer: customerSchema
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
    }

    const { message, order: incomingOrder, customer } = parsed.data;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const productos = await prisma.product.findMany({ take: 200 });
    const updatedOrder = updateOrderFromMessage(message, productos, incomingOrder);
    const whatsappText = updatedOrder.items.length ? buildWhatsAppText(updatedOrder, customer) : undefined;
    const whatsappUrl = whatsappText
      ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappText)}`
      : undefined;

    const calculo = calcularPrecio(message, productos);
    if (calculo) {
      let extra = "";
      if (normalize(calculo.producto) === "almendras") {
        extra = "👉 También tenemos nueces y mix premium que combinan perfecto 👌";
      }

      return res.json({
        reply: `💰 ${calculo.gramos}g de ${calculo.producto} te salen $${formatMoneyARS(calculo.total)}.\n\n👉 ¿Querés que te lo prepare?\n\nSi ya tenés tu pedido armado, completá tus datos y tocá “Enviar por WhatsApp”.\n\n${extra}`,
        order: updatedOrder,
        whatsappText,
        whatsappUrl
      });
    }

    if (normalize(message).includes("quiero") || normalize(message).includes("llevar")) {
      return res.json({
        reply: `Genial 🙌\n\nTe lo dejo preparado sin problema.\n\n📲 WhatsApp: 2994221315\n\nCompletá tus datos y tocá “Enviar por WhatsApp” para mandarme el pedido completo 👌`,
        order: updatedOrder,
        whatsappText,
        whatsappUrl
      });
    }

    const productContext = productos.map((p) => `${p.name} - $${p.pricePerKg}/kg`).join("\n");
    const prompt =
      `Sos FER, vendedor de almacén.\n\nProductos:\n${productContext}\n\n` +
      `Tu objetivo: ayudar a armar un pedido para retirar en el local.\n` +
      `Si el usuario quiere comprar, pedile cantidades (en g o kg).\n` +
      `Una vez armado el pedido, pedile datos obligatorios: nombre, teléfono y horario aproximado de retiro.\n` +
      `Si el usuario dice que ya transfirió, pedile que adjunte el comprobante en WhatsApp.\n` +
      `Mantené respuestas cortas y claras.`;

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
      whatsappText,
      whatsappUrl
    });
  } catch (err) {
    console.error(err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Chat error", detail });
  }
});

export default router;
