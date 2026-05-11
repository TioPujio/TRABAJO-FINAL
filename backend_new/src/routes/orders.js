import express from "express";
import prisma from "../prisma.js";
import { z } from "zod";

const router = express.Router();

const orderItemSchema = z.object({
  id: z.number().int().optional(),
  productId: z.number().int().optional(),
  name: z.string().min(1),
  grams: z.coerce.number().int().nonnegative().optional(),
  unit: z.string().min(1).optional(),
  quantity: z.coerce.number().int().nonnegative().optional(),
  total: z.number().finite().optional()
});

const customerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6),
  pickupTime: z.string().min(2),
  transferred: z.boolean().optional()
});

async function priceOrderItems(items) {
  const productIds = Array.from(
    new Set(items.map((it) => it.productId).filter((id) => typeof id === "number"))
  );

  const namesWithoutId = Array.from(
    new Set(
      items
        .filter((it) => typeof it.productId !== "number")
        .map((it) => it.name)
        .filter(Boolean)
    )
  );

  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, pricePerKg: true, price: true, unit: true }
      })
    : [];

  const byName = namesWithoutId.length
    ? await prisma.product.findMany({
        where: {
          OR: namesWithoutId.map((name) => ({
            name: { equals: name, mode: "insensitive" }
          }))
        },
        select: { id: true, name: true, pricePerKg: true, price: true, unit: true }
      })
    : [];

  const byId = new Map(products.map((p) => [p.id, p]));
  const normalized = (s) => String(s || "").trim().toLowerCase();
  const byNormalizedName = new Map(byName.map((p) => [normalized(p.name), p]));

  const priced = items.map((it) => {
    const product =
      typeof it.productId === "number"
        ? byId.get(it.productId)
        : byNormalizedName.get(normalized(it.name));
    const base = product || { pricePerKg: 0, price: 0, unit: it.unit || "kg" };

    if (typeof it.grams === "number") {
      if (it.grams <= 0) return { ...it, total: 0 };
      const pricePerGram = (base.pricePerKg || 0) / 1000;
      const total = it.grams * pricePerGram;
      return { ...it, total: Math.round(total) };
    }

    const qty = typeof it.quantity === "number" ? Math.max(0, it.quantity) : 1;

    const unit = String(it.unit || base.unit || "unidad");
    const unitLower = unit.toLowerCase();

    // Prefer explicit price; if missing but it's a kg-like unit, fall back to pricePerKg.
    const unitPrice =
      (base.price || 0) > 0
        ? base.price || 0
        : unitLower === "kg" || unitLower === "1kg"
          ? base.pricePerKg || 0
          : 0;

    const total = unitPrice * qty;
    return {
      ...it,
      unit: unitLower === "1kg" ? "kg" : unit,
      quantity: qty,
      total: Math.round(total)
    };
  });

  const total = priced.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
  return { items: priced, total: Math.round(total) };
}

router.post("/preview", async (req, res) => {
  const schema = z.object({ items: z.array(orderItemSchema).default([]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });

  const { items } = parsed.data;
  const priced = await priceOrderItems(items);
  res.json(priced);
});

router.post("/", async (req, res) => {
  const schema = z.object({
    customer: customerSchema,
    items: z.array(orderItemSchema).min(1)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });

  const { customer, items } = parsed.data;
  const priced = await priceOrderItems(items);

  const transferred = Boolean(customer.transferred);
  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        customerName: customer.name,
        customerPhone: customer.phone,
        pickupTime: customer.pickupTime,
        transferred,
        total: priced.total
      }
    });

    await tx.orderItem.createMany({
      data: priced.items.map((it) => ({
        orderId: order.id,
        productId: it.productId ?? null,
        name: it.name,
        grams: it.grams ?? null,
        unit: it.unit ?? null,
        quantity: it.quantity ?? null,
        total: it.total ?? 0
      }))
    });

    return order;
  });

  res.status(201).json({
    id: created.id,
    total: created.total,
    status: created.status
  });
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true }
  });
  if (!order) return res.status(404).json({ error: "Not found" });
  res.json(order);
});

export default router;
