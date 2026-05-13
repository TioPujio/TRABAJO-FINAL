import request from "supertest";
import { createAppWithPrisma, makePrismaMock } from "./_helpers.js";

const prismaMock = makePrismaMock();
const app = await createAppWithPrisma(prismaMock);

describe("POST /orders/preview", () => {
  beforeEach(() => {
    prismaMock.product.findMany.mockReset();
  });

  test("prices grams items using pricePerKg", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      { id: 1, name: "chia", pricePerKg: 13000, price: 0, unit: "kg" }
    ]);

    const res = await request(app)
      .post("/orders/preview")
      .send({ items: [{ productId: 1, name: "chia", grams: 250 }] });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3250); // 250g * 13 ARS/g
    expect(res.body.items[0]).toEqual(expect.objectContaining({ total: 3250, grams: 250 }));
  });

  test("converts kg quantity to grams for consistent UX", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      { id: 1, name: "almendras enteras", pricePerKg: 22000, price: 0, unit: "kg" }
    ]);

    const res = await request(app)
      .post("/orders/preview")
      .send({ items: [{ productId: 1, name: "almendras enteras", unit: "kg", quantity: 2 }] });

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toEqual(
      expect.objectContaining({
        grams: 2000,
        unit: "kg",
        total: 44000
      })
    );
    expect(res.body.total).toBe(44000);
  });

  test("uses product.price for non-kg units", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      { id: 9, name: "golfan", pricePerKg: 0, price: 13000, unit: "unidad" }
    ]);

    const res = await request(app)
      .post("/orders/preview")
      .send({ items: [{ productId: 9, name: "golfan", unit: "unidad", quantity: 2 }] });

    expect(res.status).toBe(200);
    expect(res.body.items[0].total).toBe(26000);
    expect(res.body.total).toBe(26000);
  });

  test("rejects invalid body", async () => {
    const res = await request(app).post("/orders/preview").send({ items: [{ name: "" }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid body");
  });
});
