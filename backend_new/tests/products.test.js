import request from "supertest";
import { createAppWithPrisma, makePrismaMock } from "./_helpers.js";

const prismaMock = makePrismaMock();
const app = await createAppWithPrisma(prismaMock);

describe("Products API", () => {
  beforeEach(() => {
    prismaMock.product.findMany.mockReset();
    prismaMock.product.create.mockReset();
  });

  test("GET /products returns products", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      { id: 1, name: "almendras", category: "frutos secos", pricePerKg: 12500, imageUrl: "/products/almendras.jpg" }
    ]);

    const res = await request(app).get("/products");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual(expect.objectContaining({ name: "almendras" }));
  });

  test("GET /products returns 500 on prisma error", async () => {
    prismaMock.product.findMany.mockRejectedValue(new Error("boom"));
    const res = await request(app).get("/products");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Failed to fetch products" });
  });

  test("POST /products validates body", async () => {
    const res = await request(app).post("/products").send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid body");
  });

  test("POST /products creates product", async () => {
    prismaMock.product.create.mockResolvedValue({
      id: 2,
      name: "nueces",
      pricePerKg: 14000,
      stock: 10,
      imageUrl: "/products/nueces.jpg",
      category: "frutos secos"
    });

    const res = await request(app).post("/products").send({
      name: "nueces",
      pricePerKg: 14000,
      stock: 10,
      imageUrl: "/products/nueces.jpg",
      category: "frutos secos"
    });

    expect(res.status).toBe(201);
    expect(prismaMock.product.create).toHaveBeenCalled();
    expect(res.body).toEqual(expect.objectContaining({ id: 2, name: "nueces" }));
  });
});
