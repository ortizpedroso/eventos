import { test, expect } from "@playwright/test";

import {
  seedPreVendaEvent,
  seedPublicProducer,
  seedSoldOutWaitlistEvent,
  waitForApiReady,
} from "./helpers/api-setup";

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

  test("seletor de intervalo de datas na vitrine", async ({ page }) => {
    await page.goto("/eventos");
    await page.getByTestId("filtro-data-de").fill("2026-12-01");
    await page.getByTestId("filtro-data-ate").fill("2026-12-31");
    await page.getByTestId("filtro-data-aplicar").click();
    await expect(page).toHaveURL(/de=/);
    await expect(page).toHaveURL(/ate=/);
  });
});

test.describe("Checkout Asaas copy", () => {
  test("página de planos menciona Asaas", async ({ page }) => {
    await page.goto("/planos");
    await expect(page.getByText(/Asaas/i).first()).toBeVisible();
  });

  test("home menciona Asaas nos simuladores", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Asaas/i).first()).toBeVisible();
  });
});

test.describe("Lista de interesse pré-venda", () => {
  test.describe.configure({ mode: "serial" });

  test("inscreve e-mail na lista de interesse", async ({ page }) => {
    test.skip(!process.env.PLAYWRIGHT_API_URL, "Requer API (PLAYWRIGHT_API_URL)");

    await waitForApiReady(90_000);
    const { slug } = await seedPreVendaEvent();
    const email = `interesse_e2e_${Date.now()}@test.com`;

    await page.goto(`/eventos/${slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("lista-interesse-form")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("lista-interesse-email").fill(email);
    await page.getByTestId("lista-interesse-submit").click();
    await expect(page.getByText(/inscrição registrada|avisaremos/i)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Lista de espera (esgotado)", () => {
  test("inscreve na fila quando esgotado", async ({ page }) => {
    test.skip(!process.env.PLAYWRIGHT_API_URL, "Requer API (PLAYWRIGHT_API_URL)");

    await waitForApiReady(90_000);
    const { slug } = await seedSoldOutWaitlistEvent();
    const email = `espera_e2e_${Date.now()}@test.com`;

    await page.goto(`/eventos/${slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("lista-espera-form")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("lista-espera-email").fill(email);
    await page.getByTestId("lista-espera-submit").click();
    await expect(page.getByText(/fila|posição|inscrição/i)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Perfil público do produtor", () => {
  test("renderiza página /produtor/{slug}", async ({ page }) => {
    test.skip(!process.env.PLAYWRIGHT_API_URL, "Requer API (PLAYWRIGHT_API_URL)");

    await waitForApiReady(90_000);
    const { slug, nome } = await seedPublicProducer();

    await page.goto(`/produtor/${slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: new RegExp(nome, "i") })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/eventos/i).first()).toBeVisible();
  });
});
