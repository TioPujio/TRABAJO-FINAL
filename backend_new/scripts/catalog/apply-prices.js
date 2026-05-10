import fs from "node:fs";
import path from "node:path";
import prisma from "../../src/prisma.js";

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parsePrice(raw) {
  const s = String(raw || "")
    .trim()
    .replace(/\$/g, "")
    .replace(/\s+/g, "");
  if (!s) return null;
  // "22.000,00" -> "22000.00"
  const normalized = s.replace(/\./g, "").replace(/,/g, ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return value;
}

function normalizeUnit(unit) {
  const u = String(unit || "").trim().toLowerCase();
  if (!u) return "kg";
  return u;
}

function unitToPricePerKg(unit, price) {
  if (!Number.isFinite(price)) return 0;
  const u = normalizeUnit(unit);
  if (u === "kg" || u === "1kg") return price;
  if (u === "100gr" || u === "100g") return price * 10;
  // Non-weight units: can't convert to kg safely.
  return 0;
}

async function main() {
  const inputPath = process.argv[2] || path.join("scripts", "catalog", "prices.tsv");
  const fullPath = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath);

  if (!fs.existsSync(fullPath)) {
    console.error(`Input file not found: ${fullPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(fullPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);

  // Skip header if present
  const rows = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.toLowerCase().startsWith("name\t")) continue;
    rows.push(trimmed);
  }

  if (!rows.length) {
    console.error("No rows found in prices file.");
    process.exit(1);
  }

  const products = await prisma.product.findMany({
    select: { id: true, name: true }
  });
  const idsByName = new Map();
  for (const p of products) {
    const key = normalizeName(p.name);
    const list = idsByName.get(key) || [];
    list.push(p.id);
    idsByName.set(key, list);
  }

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const [name, unitRaw, priceRaw] = row.split("\t");
    const normalized = normalizeName(name);
    if (!normalized) continue;
    const unit = normalizeUnit(unitRaw);
    const price = parsePrice(priceRaw);

    const ids = idsByName.get(normalized);
    if (!ids || !ids.length) {
      skipped += 1;
      continue;
    }

    const pricePerKg = price == null ? 0 : unitToPricePerKg(unit, price);

    const data = {
      unit,
      price: price ?? 0,
      pricePerKg
    };

    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data
    });
    updated += result.count;
  }

  console.log(
    JSON.stringify({ updated, skipped, totalRows: rows.length }, null, 2)
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
