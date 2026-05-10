import { PrismaClient } from "@prisma/client";
import "../src/env.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.product.createMany({
    skipDuplicates: true,
    data: [
      {
        name: "almendras",
        pricePerKg: 12500,
        stock: 100,
        imageUrl: "/products/almendras.jpg",
        category: "frutos secos"
      },
      {
        name: "nueces",
        pricePerKg: 14000,
        stock: 80,
        imageUrl: "/products/nueces.jpg",
        category: "frutos secos"
      },
      {
        name: "chia",
        pricePerKg: 10000,
        stock: 120,
        imageUrl: "/products/chia.jpg",
        category: "semillas"
      }
    ]
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
