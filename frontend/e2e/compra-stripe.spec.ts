import { expect, test } from "@playwright/test";

/**
 * Compra com Stripe Elements (cartão 4242…) — opcional.
 * Requer: API com Stripe test, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, stripe listen ativo.
 *
 * Uso: E2E_STRIPE=1 npm run test:e2e -- e2e/compra-stripe.spec.ts
 */
test.describe("Checkout — Stripe real (opcional)", () => {
  test.skip(
    !process.env.E2E_STRIPE,
    "Defina E2E_STRIPE=1 e configure API + stripe listen para executar",
  );

  test("placeholder — configure evento manual e complete no browser", async () => {
    test.info().annotations.push({
      type: "note",
      description:
        "Use scripts/compra_teste_stripe.py para validação automatizada; este spec reserva slot para E2E Elements futuro.",
    });
    expect(true).toBe(true);
  });
});
