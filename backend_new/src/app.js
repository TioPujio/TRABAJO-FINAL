import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import chatRoutes from "./routes/chat.js";
import prisma from "./prisma.js";
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

      // Support wildcard entries like "*.vercel.app"
      try {
        const { host } = new URL(origin);
        const wildcardMatch = allowList.some((entry) => {
          if (!entry.startsWith("*.")) return false;
          const suffix = entry.slice(1); // ".vercel.app"
          return host.endsWith(suffix);
        });
        if (wildcardMatch) return cb(null, true);
      } catch {
        // ignore URL parsing failures
      }
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

app.get("/health", async (_req, res) => {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

  try {
    await prisma.product.count();
    res.json({ ok: true, hasDatabaseUrl, hasOpenAIKey });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, hasDatabaseUrl, hasOpenAIKey, error: detail });
  }
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

