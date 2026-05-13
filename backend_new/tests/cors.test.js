import request from "supertest";
import { createAppWithPrisma, makePrismaMock } from "./_helpers.js";

const prismaMock = makePrismaMock();
prismaMock.product.count.mockResolvedValue(0);
const app = await createAppWithPrisma(prismaMock);

describe("CORS behavior", () => {
  test("sets Access-Control-Allow-Origin for allowed origin", async () => {
    process.env.CORS_ORIGIN = "https://frontend.example.com";

    const res = await request(app)
      .get("/health")
      .set("Origin", "https://frontend.example.com");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("https://frontend.example.com");
  });

  test("does not set Access-Control-Allow-Origin for disallowed origin", async () => {
    process.env.CORS_ORIGIN = "https://frontend.example.com";

    const res = await request(app).get("/health").set("Origin", "https://evil.example.com");

    // Express-cors returns 200 but omits the header when origin callback returns false.
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

