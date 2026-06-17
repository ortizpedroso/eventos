import { expect, test } from "@playwright/test";

import { seedPublishedEvent, waitForApiReady } from "./helpers/api-setup";

/**
 * Fluxo completo no browser com ASAAS_DISABLED=true na API.
 * Local: docker compose -f docker-compose.e2e.yml up -d && npm run test:e2e:compra
 */
test.describe("Checkout — compra com Asaas mock", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await waitForApiReady(90_000);
  });

  test("registro, checkout e confirmação", async ({ page }) => {
    const { slug } = await seedPublishedEvent();
    const suf = Date.now();
    const email = `e2e_cli_${suf}@test.com`;
    const senha = "senha12345";

    await page.goto("/auth?mode=register", { waitUntil: "networkidle" });
    await page.waitForSelector("form[data-auth-ready=true]", { timeout: 15_000 });
    await page.locator("#email").fill(email);
    await page.locator("#nome").fill("Cliente E2E");
    await page.locator("#senha").fill(senha);
    await page.getByRole("button", { name: "Cadastrar", exact: true }).click();

    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 30_000 });

    await page.goto(`/eventos/${slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /sobre o evento/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: /li o termo/i }).click();
    await page.getByRole("checkbox", { name: /li e aceito o termo/i }).check();
    await page.getByTestId("checkout-continuar").click();

    await expect(page.getByTestId("checkout-confirmacao")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /compra confirmada/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /ver meu ingresso/i })).toBeVisible();
  });
});
