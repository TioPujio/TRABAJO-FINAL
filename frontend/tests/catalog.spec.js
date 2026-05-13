import { test, expect } from "@playwright/test";

test("catalog loads correctly", async ({ page }) => {
  await page.goto("https://el-viejo-almacen-todo-suelto.vercel.app");

  await expect(page.locator("text=El Viejo Almacén")).toBeVisible();
});

test("chat FER opens correctly", async ({ page }) => {
  await page.goto("https://el-viejo-almacen-todo-suelto.vercel.app");

  // Floating button
  await page.getByRole("button", { name: /abrir chat con fer/i }).click();

  // Greeting in the widget
  await expect(page.getByText(/hola/i).first()).toBeVisible();
});
