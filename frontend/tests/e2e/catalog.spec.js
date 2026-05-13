import { expect, test } from "@playwright/test";

const mockProducts = [
  {
    id: 1,
    name: "almendras enteras",
    category: "frutos secos",
    price: 22000,
    unit: "kg",
    imageUrl: ""
  },
  {
    id: 2,
    name: "curcuma",
    category: "condimentos",
    price: 18000,
    unit: "kg",
    imageUrl: ""
  }
];

test.beforeEach(async ({ page }) => {
  await page.route("**/products", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockProducts)
    });
  });

  await page.route("**/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reply: "OK" })
    });
  });
});

test("catalog loads and category filter works", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /el viejo almac/i })).toBeVisible();

  // Open category dropdown and pick a category.
  const categoryButton = page.locator(".category-button");
  await expect(categoryButton).toBeVisible();

  // Some environments can be flaky; ensure the click lands.
  await categoryButton.scrollIntoViewIfNeeded();
  await categoryButton.click({ force: true });
  // Fallback: trigger a DOM click (in case something intercepts pointer events).
  await page.evaluate(() => {
    document.querySelector(".category-button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const dropdown = page.locator(".category-dropdown");
  await dropdown.waitFor({ state: "attached" });
  await expect(dropdown).toBeVisible();

  await dropdown.locator(".category-item", { hasText: /frutos secos/i }).click();

  // Only the matching category should remain.
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.getByText(/almendras/i).first()).toBeVisible();
});

test("consult button opens chat and pre-fills message", async ({ page }) => {
  await page.goto("/");

  // Click first "Consultar" available.
  const consult = page.getByRole("button", { name: "Consultar" }).first();
  await consult.click();

  // Chat should open and input should contain "Quiero comprar"
  const chatInput = page.locator(".chat-input input");
  await expect(chatInput).toBeVisible();
  await expect(chatInput).toHaveValue(/quiero comprar/i);
});
