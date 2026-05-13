import request from "supertest";
import { createAppWithPrisma, makePrismaMock } from "./_helpers.js";

const prismaMock = makePrismaMock();
const app = await createAppWithPrisma(prismaMock);

describe("Orders API", () => {
  beforeEach(() => {
    prismaMock.product.findMany.mockReset();
    prismaMock.$transaction.mockReset();
    prismaMock.order.create.mockReset();
    prismaMock.orderItem.createMany.mockReset();
    prismaMock.order.findUnique.mockReset();
  });

  test("POST /orders creates an order and items", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      { id: 1, name: "chia", pricePerKg: 13000, price: 0, unit: "kg" }
    ]);

    prismaMock.$transaction.mockImplementation(async (fn) => fn(prismaMock));
    prismaMock.order.create.mockResolvedValue({ id: 10, total: 3250, status: "PENDING" });
    prismaMock.orderItem.createMany.mockResolvedValue({ count: 1 });

    const res = await request(app).post("/orders").send({
      customer: { name: "Juan Perez", phone: "2991234567", pickupTime: "hoy 18:30", transferred: false },
      items: [{ productId: 1, name: "chia", grams: 250 }]
    });

    expect(res.status).toBe(201);
    expect(prismaMock.order.create).toHaveBeenCalled();
    expect(prismaMock.orderItem.createMany).toHaveBeenCalled();
    expect(res.body).toEqual(expect.objectContaining({ id: 10, total: 3250 }));
  });

  test("GET /orders/:id returns 400 on invalid id", async () => {
    const res = await request(app).get("/orders/not-a-number");
    expect(res.status).toBe(400);
  });

  test("GET /orders/:id returns 404 when missing", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    const res = await request(app).get("/orders/999");
    expect(res.status).toBe(404);
  });
});

