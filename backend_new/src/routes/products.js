import express from "express";
import prisma from "../prisma.js";
import { z } from "zod";

const router = express.Router();

const createProductSchema = z.object({
  name: z.string().min(1),
  pricePerKg: z.coerce.number().finite().nonnegative(),
  stock: z.coerce.number().finite().nonnegative(),
  imageUrl: z.string().min(1),
  category: z.string().min(1)
});

// GET productos
router.get("/", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      distinct: ["name", "category", "pricePerKg", "imageUrl"],
      orderBy: { createdAt: "asc" }
    });
    res.json(products);
  } catch (err) {
    console.error("GET /products failed:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// POST producto
router.post("/", async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  }

  try {
    const { name, pricePerKg, stock, imageUrl, category } = parsed.data;
    const product = await prisma.product.create({
      data: { name, pricePerKg, stock, imageUrl, category }
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("POST /products failed:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

export default router;
