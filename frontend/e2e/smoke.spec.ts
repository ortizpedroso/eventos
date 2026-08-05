import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Smoke — páginas públicas", () => {
  test("home carrega e tem link para eventos", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/EventosBR/i);
    await expect(page.getByRole("link", { name: /eventos/i }).first()).toBeVisible();
  });

  test("home sem violações axe críticas/sérias", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/EventosBR/i);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const graves = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });

  test("lista de eventos responde", async ({ page }) => {
    await page.goto("/eventos", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("documentação técnica não é pública", async ({ page }) => {
    const res = await page.goto("/documentacao", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(404);
    const resApi = await page.goto("/documentacao/api", { waitUntil: "domcontentloaded" });
    expect(resApi?.status()).toBe(404);
  });

  test("alias /evento redireciona para /eventos", async ({ page }) => {
    const res = await page.goto("/evento/rota-teste-alias", { waitUntil: "domcontentloaded" });
    expect(res?.url()).toMatch(/\/eventos\/rota-teste-alias/);
  });
});
