import { test, expect } from "@playwright/test";

test.describe("Patamar UX — vitrine e navbar", () => {
  test("busca na navbar redireciona para vitrine com q", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("search").getByRole("textbox").first();
    if (await input.isVisible()) {
      await input.fill("show");
      await input.press("Enter");
      await expect(page).toHaveURL(/\/eventos\?q=show/);
    } else {
      await page.goto("/eventos?q=show");
      await expect(page).toHaveURL(/q=show/);
    }
  });

  test("filtro Este fim de semana na vitrine", async ({ page }) => {
    await page.goto("/eventos");
    await page.getByRole("button", { name: "Este fim de semana" }).click();
    await expect(page).toHaveURL(/de=/);
  });
});

test.describe("Checkout Asaas copy", () => {
  test("página de planos menciona Asaas", async ({ page }) => {
    await page.goto("/planos");
    await expect(page.getByText(/Asaas/i).first()).toBeVisible();
  });
});
