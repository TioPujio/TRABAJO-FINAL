import request from "supertest";
import { createAppWithPrisma, makePrismaMock } from "./_helpers.js";

const prismaMock = makePrismaMock();
prismaMock.product.count.mockResolvedValue(0);
const app = await createAppWithPrisma(prismaMock);

describe("App misc routes", () => {
  test("GET / returns backend banner", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text.toLowerCase()).toContain("backend funcionando");
  });

  test("GET /.well-known/appspecific/... returns 204", async () => {
    const res = await request(app).get("/.well-known/appspecific/com.chrome.devtools.json");
    expect(res.status).toBe(204);
  });
});

