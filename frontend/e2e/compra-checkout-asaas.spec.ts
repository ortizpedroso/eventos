import { expect, test } from "@playwright/test";

import {
  apiLogin,
  seedParcelamentoEventAsaas,
  seedPublishedEventAsaas,
  simularWebhookAsaasPago,
  waitForApiReady,
} from "./helpers/api-setup";

/**
 * Checkout Asaas no browser (mock E2E).
 *
 *   docker compose -p eventosbr-e2e -f docker-compose.e2e.yml -f docker-compose.e2e.asaas.yml up -d --build --wait
 *   cd frontend && PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e:asaas
 */
test.describe("Checkout — fluxo Asaas (mock)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await waitForApiReady(90_000);
  });

  test("PIX mock, webhook e confirmação", async ({ page }) => {
    const { slug } = await seedPublishedEventAsaas();
    const suf = Date.now();
    const email = `e2e_asaas_cli_${suf}@test.com`;
    const senha = "senha12345";
    const cpf = "52998224725";

    await page.goto("/auth?mode=register", { waitUntil: "networkidle" });
    await page.waitForSelector("form[data-auth-ready=true]", { timeout: 15_000 });
    await page.locator("#email").fill(email);
    await page.locator("#nome").fill("Cliente Asaas E2E");
    await page.locator("#senha").fill(senha);
    await page.getByRole("button", { name: "Cadastrar", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 30_000 });

    await page.goto(`/eventos/${slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /sobre o evento/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: /li o termo/i }).click();
    await page.getByRole("checkbox", { name: /li e aceito o termo/i }).check();

    const cpfInput = page.locator("#cpf_comprador, #part_cpf").first();
    if (await cpfInput.isVisible().catch(() => false)) {
      await cpfInput.fill(cpf);
    }

    await page.getByTestId("checkout-continuar").click();

    await expect(page.getByText(/Pagamento seguro/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Stripe/i)).not.toBeVisible();

    await expect(page.getByRole("button", { name: /Pagar .* com PIX/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Pagar .* com PIX/i }).click();

    await expect(page.getByText(/Copiar código PIX|QR Code PIX/i)).toBeVisible({ timeout: 20_000 });

    const token = await apiLogin(email, senha);
    const ingressoId = await fetchIngressoPendente(token);
    expect(ingressoId).toBeTruthy();

    const payId = await fetchPaymentId(token, ingressoId!);
    expect(payId).toBeTruthy();

    await simularWebhookAsaasPago(payId!, ingressoId!);

    await expect(page.getByTestId("checkout-confirmacao")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("heading", { name: /compra confirmada/i })).toBeVisible();
  });

  test("cartão parcelado 3x, webhook e confirmação", async ({ page }) => {
    const { slug } = await seedParcelamentoEventAsaas();
    const suf = Date.now();
    const email = `e2e_parc_full_${suf}@test.com`;
    const senha = "senha12345";
    const cpf = "52998224725";

    await page.goto("/auth?mode=register", { waitUntil: "networkidle" });
    await page.waitForSelector("form[data-auth-ready=true]", { timeout: 15_000 });
    await page.locator("#email").fill(email);
    await page.locator("#nome").fill("Cliente Parcelado Full");
    await page.locator("#senha").fill(senha);
    await page.getByRole("button", { name: "Cadastrar", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 30_000 });

    await page.goto(`/eventos/${slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /sobre o evento/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: /li o termo/i }).click();
    await page.getByRole("checkbox", { name: /li e aceito o termo/i }).check();
    const cpfInput = page.locator("#cpf_comprador, #part_cpf").first();
    if (await cpfInput.isVisible().catch(() => false)) {
      await cpfInput.fill(cpf);
    }
    await page.getByTestId("checkout-continuar").click();

    await expect(page.getByText(/Pagamento seguro/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /cartão/i }).click();
    await expect(page.getByTestId("checkout-parcelas")).toBeVisible({ timeout: 15_000 });
    await page.getByLabel(/3x de/i).check();

    await page.getByPlaceholder("Nome no cartão").fill("Teste Silva");
    await page.getByPlaceholder("Número do cartão").fill("4111111111111111");
    await page.getByPlaceholder("MM").fill("12");
    await page.getByPlaceholder("AAAA").fill("2030");
    await page.getByPlaceholder("CVV").fill("123");
    await page.getByPlaceholder("CPF do titular").fill(cpf);
    await page.getByPlaceholder("CEP").fill("01310100");
    await page.getByPlaceholder("Nº endereço").fill("100");

    await page.getByRole("button", { name: /Pagar /i }).click();
    await expect(page.getByText(/confirmação|Aguardando/i)).toBeVisible({ timeout: 30_000 });

    const token = await apiLogin(email, senha);
    const ingressoId = await fetchIngressoPendente(token);
    expect(ingressoId).toBeTruthy();

    const payId = await fetchPaymentId(token, ingressoId!);
    expect(payId).toBeTruthy();

    await simularWebhookAsaasPago(payId!, ingressoId!);

    await expect(page.getByTestId("checkout-confirmacao")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("heading", { name: /compra confirmada/i })).toBeVisible();
  });

  test("exibe seletor de parcelas no cartão", async ({ page }) => {
    const { slug } = await seedParcelamentoEventAsaas();
    const suf = Date.now();
    const email = `e2e_parc_ui_${suf}@test.com`;
    const senha = "senha12345";

    await page.goto("/auth?mode=register", { waitUntil: "networkidle" });
    await page.waitForSelector("form[data-auth-ready=true]", { timeout: 15_000 });
    await page.locator("#email").fill(email);
    await page.locator("#nome").fill("Cliente Parcelado");
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

    await expect(page.getByText(/Pagamento seguro/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /cartão/i }).click();
    await expect(page.getByTestId("checkout-parcelas")).toBeVisible({ timeout: 15_000 });
    await page.getByLabel(/3x de/i).check();
    await expect(page.getByText(/3x de/i).first()).toBeVisible();
  });
});

const API = (process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

async function fetchIngressoPendente(token: string): Promise<string | null> {
  const res = await fetch(`${API}/api/pagamentos/meus?status=pendente`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as { id: string }[];
  return rows[0]?.id ?? null;
}

async function fetchPaymentId(token: string, ingressoId: string): Promise<string | null> {
  const res = await fetch(`${API}/api/pagamentos/asaas/status/${ingressoId}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!res.ok) return null;
  const st = (await res.json()) as { payment_id?: string };
  return st.payment_id ?? null;
}
