import { expect, test } from "@playwright/test";

/**
 * Fluxo real organizador + cliente com contas criadas pelo qa-funcional.py
 * ou credenciais passadas via env QA_ORG_EMAIL / QA_CLI_EMAIL / QA_SENHA / QA_EVENT_SLUG.
 */
test.describe("Fluxo organizador e cliente", () => {
  test.describe.configure({ mode: "serial" });

  const orgEmail = process.env.QA_ORG_EMAIL ?? "qa_org_1781622876@test.com";
  const cliEmail = process.env.QA_CLI_EMAIL ?? "qa_cli_1781622876@test.com";
  const senha = process.env.QA_SENHA ?? "SenhaTeste123!";
  const eventSlug = process.env.QA_EVENT_SLUG ?? "evento-qa-1781622876";

  async function login(page: import("@playwright/test").Page, email: string) {
    await page.goto("/auth?login=1", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("form[data-auth-ready=true]", { timeout: 20_000 });
    await page.locator("#email").fill(email);
    await page.locator("#senha").fill(senha);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 30_000 });
  }

  test("organizador — login, painel e eventos", async ({ page }) => {
    await login(page, orgEmail);
    await page.goto("/organizador/eventos", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: /meus eventos/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/evento qa/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("cliente — login, ingressos e evento público", async ({ page }) => {
    await login(page, cliEmail);
    await page.goto("/conta/ingressos", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: /meus ingressos/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/evento qa/i).first()).toBeVisible({ timeout: 15_000 });

    await page.goto(`/eventos/${eventSlug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /sobre o evento/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto("/conta/pagamentos", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: /pagamentos/i })).toBeVisible({
      timeout: 20_000,
    });
  });
});
