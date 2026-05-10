import express from "express";
import prisma from "../prisma.js";
import OpenAI from "openai";
import { z } from "zod";

const router = express.Router();

function calcularPrecio(mensaje, productos) {
  const regex = /(\d+)\s?(g|kg)/i;
  const match = mensaje.match(regex);

  if (!match) return null;

  let cantidad = parseInt(match[1]);
  const unidad = match[2].toLowerCase();

  if (unidad === "kg") cantidad = cantidad * 1000;

  // buscar producto
  const producto = productos.find((p) =>
    mensaje.toLowerCase().includes(p.name.toLowerCase())
  );

  if (!producto) return null;

  const precioPorGramo = producto.pricePerKg / 1000;
  const total = cantidad * precioPorGramo;

  return {
    producto: producto.name,
    gramos: cantidad,
    total: Math.round(total)
  };
}

router.post("/", async (req, res) => {
  try {
    const bodySchema = z.object({ message: z.string().min(1) });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
    }
    const { message } = parsed.data;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const productos = await prisma.product.findMany({
      take: 20
    });

    const calculo = calcularPrecio(message, productos);

    if (calculo) {
      let extra = "";
      if (calculo.producto.toLowerCase() === "almendras") {
        extra = "👉 También tenemos nueces y mix premium que combinan perfecto 👌";
      }

      return res.json({
        reply: `💰 ${calculo.gramos}g de ${calculo.producto} te salen $${calculo.total}.\n\n👉 ¿Querés que te lo prepare?\n\nPodés:\n1️⃣ Escribirme por WhatsApp  \n2️⃣ Pedirlo por email  \n3️⃣ Pasar a retirarlo\n\nDecime cómo preferís 👍\n\n${extra}`
      });
    }

    if (
      message.toLowerCase().includes("quiero") ||
      message.toLowerCase().includes("llevar")
    ) {
      return res.json({
        reply: `Genial 🙌\n\nTe lo dejo preparado sin problema.\n\n📲 WhatsApp: 2994221315  \n📧 Email: elviejoalmacentodosuelto@hotmail.com  \n\nMandanos un mensaje con el pedido y lo coordinamos 👍`
      });
    }

    const productContext = productos
      .map((p) => `${p.name} - $${p.pricePerKg}/kg`)
      .join("\n");

    const prompt = `
Sos FER, vendedor de almacén.
Productos:
${productContext}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: message }
      ]
    });

    res.json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error(err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Chat error", detail });
  }
});

export default router;
