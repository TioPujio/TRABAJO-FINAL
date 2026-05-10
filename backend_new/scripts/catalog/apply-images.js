import fs from "node:fs";
import path from "node:path";
import prisma from "../../src/prisma.js";

function stripDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slug(value) {
  const s = stripDiacritics(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s;
}

function compact(value) {
  return stripDiacritics(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length;
  const n = b.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n];
}

function similarityScore(productName, fileBase) {
  const pSlug = slug(productName);
  const fSlug = slug(fileBase);
  if (!pSlug || !fSlug) return 0;
  if (pSlug === fSlug) return 1000;

  const pComp = compact(productName);
  const fComp = compact(fileBase);
  const maxLen = Math.max(pComp.length, fComp.length) || 1;
  const dist = levenshtein(pComp, fComp);
  const ratio = 1 - dist / maxLen; // 0..1

  let score = Math.round(ratio * 100);
  if (pComp.includes(fComp) || fComp.includes(pComp)) score += 20;
  if (pSlug.startsWith(fSlug) || fSlug.startsWith(pSlug)) score += 10;
  return score;
}

function readImagesIndex() {
  const productsDir = path.join(process.cwd(), "public", "products");
  const files = fs
    .readdirSync(productsDir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((name) => !name.toLowerCase().endsWith(".json"))
    .filter((name) => name !== ".gitkeep");

  return files.map((filename) => {
    const base = filename.replace(/\.[^.]+$/, "");
    return { filename, base, url: `/products/${filename}` };
  });
}

async function main() {
  const images = readImagesIndex();
  if (!images.length) {
    console.error("No images found in public/products.");
    process.exit(1);
  }

  const DEFAULTS = new Set([
    "/products/almendras.jpg",
    "/products/almendra.jpg",
    "/products/nueces.jpg",
    "/products/chia.jpg"
  ]);

  const products = await prisma.product.findMany({
    select: { id: true, name: true, imageUrl: true }
  });

  let updated = 0;
  let blanked = 0;

  for (const product of products) {
    const current = product.imageUrl || "";

    // Only replace if it's empty or currently a default placeholder.
    const canReplace = !current || DEFAULTS.has(current);
    if (!canReplace) continue;

    let best = null;
    let bestScore = 0;
    for (const img of images) {
      const score = similarityScore(product.name, img.base);
      if (score > bestScore) {
        bestScore = score;
        best = img;
      }
    }

    // Threshold tuned to pick abbreviations but avoid random matches.
    if (best && bestScore >= 55) {
      if (best.url !== current) {
        await prisma.product.update({ where: { id: product.id }, data: { imageUrl: best.url } });
        updated += 1;
      }
    } else if (current && DEFAULTS.has(current)) {
      // If no match, clear the placeholder (user wants blank).
      await prisma.product.update({ where: { id: product.id }, data: { imageUrl: "" } });
      blanked += 1;
    }
  }

  console.log(JSON.stringify({ updated, blanked, total: products.length }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

