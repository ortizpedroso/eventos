import { expect, test } from "@playwright/test";

test.describe("Smoke — páginas públicas", () => {
  test("home carrega e tem link para eventos", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/EventosBR/i);
    await expect(page.getByRole("link", { name: /eventos/i }).first()).toBeVisible();
  });

  test("lista de eventos responde", async ({ page }) => {
    await page.goto("/eventos", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("documentação técnica resumida", async ({ page }) => {
    await page.goto("/documentacao", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/documenta/i);
  });

  test("alias /evento redireciona para /eventos", async ({ page }) => {
    const res = await page.goto("/evento/rota-teste-alias", { waitUntil: "domcontentloaded" });
    expect(res?.url()).toMatch(/\/eventos\/rota-teste-alias/);
  });
});
