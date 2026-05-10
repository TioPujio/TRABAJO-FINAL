import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import chatRoutes from "./routes/chat.js";
import productRoutes from "./routes/products.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: (origin, cb) => {
      const allowList = (process.env.CORS_ORIGIN || "http://localhost:5173")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (!origin) return cb(null, true);
      if (allowList.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    }
  })
);

app.use(express.json());

// Static product images:
// http://localhost:3000/products/almendras.jpg
app.use(
  "/products",
  express.static("public/products", {
    index: false,
    redirect: false
  })
);

// TEST
app.get("/", (_req, res) => {
  res.send("Backend funcionando 🚀");
});

// Chrome DevTools may probe this path on localhost. Safe to ignore; returning 204 removes console noise.
app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.status(204).end();
});

app.use("/products", productRoutes);
app.use("/chat", chatRoutes);

app.use((err, _req, res, _next) => {
  const message = err instanceof Error ? err.message : "Unexpected error";
  res.status(500).json({ error: message });
});

export default app;

