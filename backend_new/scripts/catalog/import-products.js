import fs from "node:fs";
import path from "node:path";
import prisma from "../../src/prisma.js";

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function titleCase(name) {
  const cleaned = String(name || "")
    .trim()
    .replace(/\s+/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function normalizeCategory(cat) {
  return String(cat || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function guessCategory(name) {
  const n = normalizeName(name);

  const condimentos = [
    "aji",
    "ajinomoto",
    "ajo",
    "albahaca",
    "anis",
    "bouquet",
    "cardamomo",
    "cebolla",
    "chimichurri",
    "clavo",
    "comino",
    "cond.",
    "coriandro",
    "curcuma",
    "curry",
    "estragon",
    "enebro",
    "eneldo",
    "fenobreco",
    "hinojo",
    "hongos",
    "humo",
    "jenjibre",
    "kummel",
    "laurel",
    "merken",
    "mostaza",
    "nuez moscada",
    "oregano",
    "perejil",
    "pimenton",
    "pimienta",
    "provenzal",
    "romero",
    "salvia",
    "tomates secos",
    "tomillo",
    "verduras deshidratadas",
    "wasabi",
    "achiote",
    "azafran"
  ];

  const limpieza = [
    "alcohol",
    "jabon",
    "lavandina",
    "limpia vidrios",
    "multiuso",
    "shampoo auto",
    "silicona",
    "suavizante",
    "detergente",
    "desengrasante",
    "cloro",
    "lysoform",
    "blem",
    "poett",
    "raid",
    "guantes",
    "virulana",
    "esponja",
    "estropajo",
    "papel higienico",
    "rollo cocina",
    "repasador",
    "algodon",
    "baldes",
    "cabos",
    "escoba",
    "escobillon",
    "franela",
    "mopas",
    "lampazo",
    "pala"
  ];

  const reposteria = [
    "chocolate",
    "chips",
    "polvo de hornear",
    "bicarbonato",
    "chantilly",
    "crema pastelera",
    "merengue",
    "cerezas",
    "guindas",
    "gelatina",
    "mouse",
    "levadura",
    "margarina",
    "manteca",
    "ddl",
    "dulce",
    "escencia"
  ];

  const cereales = [
    "copos",
    "aritos",
    "baloncitos",
    "cereal",
    "arroz inflado",
    "crespines",
    "granola",
    "mix cereales",
    "almohaditas",
    "quinoa pop",
    "cafe"
  ];

  const copetin = [
    "papas",
    "chizitos",
    "tutuca",
    "puflito",
    "esponjitas",
    "heladitos",
    "palitos",
    "rosquitas",
    "pochoclos",
    "dulcitas",
    "cascarones"
  ];

  const harinas = [
    "almidon",
    "gluten",
    "harina",
    "salvado",
    "farina",
    "pan rallado",
    "rebozador",
    "semolin",
    "semola",
    "avena",
    "germen"
  ];

  const legumbres = ["poroto", "arvejas", "lentejas", "garbanzos"];

  const semillas = ["chia", "sesamo", "amapola", "amaranto", "lino", "girasol", "alpiste", "zapallo", "mix de semillas"];

  const frutosSecos = [
    "nueces",
    "almendras",
    "pasas",
    "avellanas",
    "castañas",
    "caju",
    "mani",
    "mix frutos",
    "pistachos"
  ];

  const chacinados = ["chorizo", "salame", "hamburguesa", "salchicha", "matambre", "milanesa", "tripa"];

  const embasados = ["cif embasado", "linea foodie"];

  const sinTacc = ["sin tacc", "s/tacc"];
  const sinGluten = ["sin gluten"];

  const matchesAny = (arr) => arr.some((kw) => n.includes(kw));

  if (matchesAny(sinTacc)) return "SIN TACC";
  if (matchesAny(sinGluten)) return "SIN GLUTEN";
  if (matchesAny(limpieza)) return "ARTICULOS DE LIMPIEZA";
  if (matchesAny(chacinados)) return "CHACINADOS";
  if (matchesAny(condimentos)) return "CONDIMENTOS";
  if (matchesAny(reposteria)) return "REPOSTERIA";
  if (matchesAny(copetin)) return "COPETIN";
  if (matchesAny(cereales)) return "CEREALES";
  if (matchesAny(harinas)) return "HARINAS";
  if (matchesAny(legumbres)) return "LEGUMBRES";
  if (matchesAny(semillas)) return "SEMILLAS";
  if (matchesAny(frutosSecos)) return "FRUTOS SECOS";
  if (matchesAny(embasados)) return "EMBASADOS";

  // fallback
  return "GRANOS";
}

function defaultImageUrl(name) {
  const n = normalizeName(name);
  if (n.includes("almendras")) return "/products/almendras.jpg";
  if (n.includes("nueces")) return "/products/nueces.jpg";
  if (n.includes("chia")) return "/products/chia.jpg";
  return "/products/almendras.jpg";
}

async function main() {
  const inputPath = process.argv[2] || path.join("scripts", "catalog", "products.txt");
  const fullPath = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath);

  if (!fs.existsSync(fullPath)) {
    console.error(`Input file not found: ${fullPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(fullPath, "utf8");
  const names = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (!names.length) {
    console.error("No products found in input file.");
    process.exit(1);
  }

  const existing = await prisma.product.findMany({
    select: { id: true, name: true, category: true, pricePerKg: true, imageUrl: true }
  });
  const existingKeys = new Set(
    existing.map(
      (p) => `${normalizeName(p.name)}|${normalizeCategory(p.category)}|${p.pricePerKg}|${p.imageUrl}`
    )
  );

  const toCreate = [];
  for (const name of names) {
    const category = guessCategory(name);
    const product = {
      name: titleCase(name),
      category,
      pricePerKg: 0,
      stock: 0,
      imageUrl: defaultImageUrl(name)
    };

    const key = `${normalizeName(product.name)}|${normalizeCategory(product.category)}|${product.pricePerKg}|${product.imageUrl}`;
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    toCreate.push(product);
  }

  if (!toCreate.length) {
    console.log("No new products to import (all duplicates).");
    return;
  }

  const result = await prisma.product.createMany({ data: toCreate, skipDuplicates: true });
  console.log(`Imported ${result.count} products (pricePerKg=0, stock=0).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
