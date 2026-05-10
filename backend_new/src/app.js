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
      const rawAllowList = (process.env.CORS_ORIGIN || "http://localhost:5173")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (!origin) return cb(null, true);
      const normalizedOrigin = origin.replace(/\/$/, "");

      // Allow all origins if explicitly configured.
      if (rawAllowList.includes("*")) return cb(null, true);

      let originHost = "";
      try {
        originHost = new URL(normalizedOrigin).host;
      } catch {
        originHost = "";
      }

      // Exact matches (normalize trailing slash)
      const exactAllowList = rawAllowList
        .filter((entry) => entry !== "*" && !entry.includes("*"))
        .map((entry) => entry.replace(/\/$/, ""));
      if (exactAllowList.includes(normalizedOrigin)) return cb(null, true);

      // Host-only matches: allow specifying just "example.com" (or "example.com:1234")
      if (originHost) {
        const hostAllowList = exactAllowList
          .filter((entry) => !entry.startsWith("http://") && !entry.startsWith("https://"))
          .map((entry) => entry.replace(/\/$/, ""));
        if (hostAllowList.includes(originHost)) return cb(null, true);
      }

      // Support wildcard entries like "*.vercel.app"
      try {
        const { host } = new URL(normalizedOrigin);
        const wildcardMatch = rawAllowList.some((entry) => {
          if (!entry.includes("*")) return false;

          // Accept "*.vercel.app" or "https://*.vercel.app"
          let wildcardHost = entry;
          if (wildcardHost.startsWith("http://") || wildcardHost.startsWith("https://")) {
            try {
              wildcardHost = new URL(wildcardHost).host;
            } catch {
              return false;
            }
          }

          if (!wildcardHost.startsWith("*.")) return false;
          const suffix = wildcardHost.slice(1); // ".vercel.app"
          return host.endsWith(suffix);
        });
        if (wildcardMatch) return cb(null, true);
      } catch {
        // ignore URL parsing failures
      }

      // Don't throw: returning `false` avoids a confusing 500 response.
      return cb(null, false);
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

