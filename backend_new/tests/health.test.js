import request from "supertest";
import { createAppWithPrisma, makePrismaMock } from "./_helpers.js";

const prismaMock = makePrismaMock();
const app = await createAppWithPrisma(prismaMock);

describe("GET /health", () => {
  beforeEach(() => {
    prismaMock.product.count.mockReset();
  });

  test("returns ok=true when database reachable", async () => {
    prismaMock.product.count.mockResolvedValue(1);
    process.env.DATABASE_URL = "postgres://example";
    process.env.OPENAI_API_KEY = "sk-test";

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        hasDatabaseUrl: true,
        hasOpenAIKey: true
      })
    );
  });

  test("returns 500 when prisma throws", async () => {
    prismaMock.product.count.mockRejectedValue(new Error("db down"));

    const res = await request(app).get("/health");
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain("db down");
  });
});
