import { expect, test } from "@playwright/test";

import {
  seedPublishedEvent,
  seedPublishedEventMeiaEntrada,
  waitForApiReady,
} from "./helpers/api-setup";

/**
 * Item 1 (aviso de meia-entrada) e Item 2 (confirmação de e-mail) no checkout.
 * Local: docker compose -f docker-compose.e2e.yml up -d && npm run test:e2e:compra
 */
test.describe("Checkout — aviso de meia-entrada e confirmação de e-mail", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await waitForApiReady(90_000);
  });

  async function registrarEIrParaEvento(page: import("@playwright/test").Page, slug: string, email: string) {
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
  }

  test("lote de meia-entrada mostra aviso de documento", async ({ page }) => {
    const { slug } = await seedPublishedEventMeiaEntrada();
    const suf = Date.now();
    await registrarEIrParaEvento(page, slug, `e2e_meia_${suf}@test.com`);

    await expect(page.getByText(/Documento de Identificação Estudantil/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Lei 12\.933\/2013/i)).toBeVisible();
  });

  test("lote inteira não mostra aviso de meia-entrada", async ({ page }) => {
    const { slug } = await seedPublishedEvent();
    const suf = Date.now();
    await registrarEIrParaEvento(page, slug, `e2e_inteira_${suf}@test.com`);

    await expect(page.getByText(/Documento de Identificação Estudantil/i)).not.toBeVisible();
  });

  test("e-mails de participante diferentes bloqueiam o envio", async ({ page }) => {
    const { slug } = await seedPublishedEvent();
    const suf = Date.now();
    await registrarEIrParaEvento(page, slug, `e2e_dif_${suf}@test.com`);

    await page.getByRole("checkbox", { name: /Sou eu \(mesmo e-mail da conta\)/i }).uncheck();
    await page.locator("#part_nome").fill("Convidado Teste");
    await page.locator("#part_email").fill("convidado@test.com");
    await page.locator("#part_email_confirmacao").fill("outro@test.com");
    await page.locator("#part_cpf").fill("529.982.247-25");
    await page.locator("#part_tel").fill("11988887777");

    await page.getByRole("button", { name: /li o termo/i }).click();
    await page.getByRole("checkbox", { name: /li e aceito o termo/i }).check();

    await expect(page.getByText(/Os e-mails não coincidem/i)).toBeVisible();

    await page.getByTestId("checkout-continuar").click();
    await expect(page.getByRole("alert").filter({ hasText: /Os e-mails não coincidem/i })).toBeVisible();
    await expect(page.getByTestId("checkout-confirmacao")).not.toBeVisible();
  });

  test("e-mails de participante iguais (maiúsculas/espaços) passam", async ({ page }) => {
    const { slug } = await seedPublishedEvent();
    const suf = Date.now();
    await registrarEIrParaEvento(page, slug, `e2e_igual_${suf}@test.com`);

    await page.getByRole("checkbox", { name: /Sou eu \(mesmo e-mail da conta\)/i }).uncheck();
    await page.locator("#part_nome").fill("Convidado Teste");
    await page.locator("#part_email").fill("convidado@test.com");
    await page.locator("#part_email_confirmacao").fill("  CONVIDADO@TEST.COM  ");
    await page.locator("#part_cpf").fill("529.982.247-25");
    await page.locator("#part_tel").fill("11988887777");

    await page.getByRole("button", { name: /li o termo/i }).click();
    await page.getByRole("checkbox", { name: /li e aceito o termo/i }).check();
    await page.getByTestId("checkout-continuar").click();

    await expect(page.getByText(/Os e-mails não coincidem/i)).not.toBeVisible();
    await expect(page.getByText(/Pagamento seguro/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
