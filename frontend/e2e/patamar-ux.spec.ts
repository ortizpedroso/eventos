import { test, expect } from "@playwright/test";

import {
  seedPreVendaEvent,
  seedPublicProducer,
  seedSoldOutWaitlistEvent,
  seedOrganizerSession,
  waitForApiReady,
} from "./helpers/api-setup";

test.describe("Patamar UX — vitrine e navbar", () => {
  test("rodapé permanece no fim ao navegar para login", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const footer = page.locator("body > footer");
    await page.getByRole("link", { name: "Login" }).click();
    await expect(page).toHaveURL(/\/auth/);

    const viewportHeight = 800;
    const assertFooterNearBottom = async () => {
      const box = await footer.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        // Rodapé colado ao fundo da viewport (grid layout) — não no meio da tela
        expect(box.y + box.height).toBeGreaterThan(viewportHeight * 0.85);
        expect(box.y).toBeGreaterThan(viewportHeight * 0.45);
      }
    };

    // Checagem imediata pós-navegação (antes da hidratação estabilizar)
    await assertFooterNearBottom();
    await assertFooterNearBottom();
    // Aguarda estabilização pós-hidratação / checagem de sessão
    await expect
      .poll(async () => {
        const box = await footer.boundingBox();
        return box ? box.y + box.height : 0;
      })
      .toBeGreaterThan(viewportHeight * 0.85);
    await assertFooterNearBottom();
  });

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
    await page.goto("/eventos", { waitUntil: "networkidle" });
    const btn = page.getByRole("button", { name: "Este fim de semana" });
    await btn.click();
    await expect(btn).toHaveClass(/bg-emerald-700/);
    await expect
      .poll(async () => page.evaluate(() => window.location.search))
      .toMatch(/de=/);
  });

  test("seletor de intervalo de datas na vitrine", async ({ page }) => {
    // `networkidle`: inputs controlados só respondem após hidratação do React
    // (mesma convenção dos formulários em /auth e lista de interesse).
    await page.goto("/eventos", { waitUntil: "networkidle" });
    await page.getByTestId("filtro-data-de").fill("2026-12-01");
    await page.getByTestId("filtro-data-ate").fill("2026-12-31");
    await expect(page.getByTestId("filtro-data-de")).toHaveValue("2026-12-01");
    await page.getByTestId("filtro-data-aplicar").click();
    await expect
      .poll(async () => page.evaluate(() => window.location.search))
      .toMatch(/de=/);
    await expect
      .poll(async () => page.evaluate(() => window.location.search))
      .toMatch(/ate=/);
  });
});

test.describe("Checkout — copy de pagamento", () => {
  test("página de planos menciona taxa EventosBR", async ({ page }) => {
    await page.goto("/planos");
    await expect(page.getByText(/EventosBR|taxa/i).first()).toBeVisible();
  });

  test("planos: cards de preço visíveis ao carregar (sem depender de scroll)", async ({ page }) => {
    await page.goto("/planos", { waitUntil: "domcontentloaded" });
    const titulo = page.getByRole("heading", { level: 3, name: "Eventos gratuitos" });
    await expect(titulo).toBeVisible({ timeout: 15_000 });
    const opacidade = await titulo.evaluate((el) => {
      let node: HTMLElement | null = el;
      while (node) {
        const o = Number.parseFloat(window.getComputedStyle(node).opacity);
        if (o < 1) return o;
        node = node.parentElement;
      }
      return 1;
    });
    expect(opacidade).toBeGreaterThan(0.9);
  });

  test("home menciona transparência de taxas", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/taxas|PIX/i).first()).toBeVisible();
  });
});

test.describe("Lista de interesse pré-venda", () => {
  test.describe.configure({ mode: "serial" });

  test("inscreve e-mail na lista de interesse", async ({ page }) => {
    test.skip(!process.env.PLAYWRIGHT_API_URL, "Requer API (PLAYWRIGHT_API_URL)");

    await waitForApiReady(90_000);
    const { slug } = await seedPreVendaEvent();
    const email = `interesse_e2e_${Date.now()}@test.com`;

    // `networkidle` (não `domcontentloaded`): o formulário só fica interativo após a
    // hidratação do React; clicar antes disso aciona o submit nativo do <form> (GET,
    // recarrega a página) em vez do handler onSubmit — mesma convenção já usada para
    // páginas com formulário em /auth (ver compra-checkout*.spec.ts).
    await page.goto(`/eventos/${slug}`, { waitUntil: "networkidle" });
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

    await page.goto(`/eventos/${slug}`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("lista-espera-form")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("lista-espera-email").fill(email);
    await page.getByTestId("lista-espera-submit").click();
    await expect(page.getByText(/fila|posição|inscrição/i)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Organizador — perfil no painel", () => {
  test("perfil mantém menu Painel e abas horizontais", async ({ page, context }) => {
    test.skip(!process.env.PLAYWRIGHT_API_URL, "Requer API (PLAYWRIGHT_API_URL)");
    await waitForApiReady(90_000);

    await page.setViewportSize({ width: 1280, height: 900 });
    const { token } = await seedOrganizerSession();
    await context.addCookies([
      {
        name: "eventosbr_session",
        value: token,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.addInitScript(() => {
      window.localStorage.setItem("eventosbr_tour_v1", "1");
    });

    await page.goto("/organizador/eventos", { waitUntil: "domcontentloaded" });
    const painelNav = page.getByRole("navigation", { name: "Navegação do organizador" });
    await expect(painelNav.getByRole("link", { name: "Meus eventos" })).toBeVisible({
      timeout: 20_000,
    });

    await painelNav.getByRole("link", { name: "Perfil" }).click();
    await expect(page).toHaveURL(/\/organizador\/perfil/);
    await expect(page).not.toHaveURL(/\/conta\//);

    await expect(painelNav.getByRole("link", { name: "Meus eventos" })).toBeVisible();
    await expect(page.getByText("Minha conta")).not.toBeVisible();

    await page
      .getByRole("navigation", { name: "Seções do perfil" })
      .getByRole("link", { name: "Pagamentos" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: /pagamentos/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(painelNav.getByRole("link", { name: "Financeiro" })).toBeVisible();
    await expect(page.getByText("Minha conta")).not.toBeVisible();
  });
});

test.describe("Mobile — smoke viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("home e vitrine renderizam sem overflow horizontal", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(homeOverflow).toBe(false);

    await page.goto("/eventos");
    await expect(page.getByRole("button", { name: "Hoje" })).toBeVisible();
    const vitrineOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(vitrineOverflow).toBe(false);
  });
});

test.describe("Navegação — renderização imediata", () => {
  test("planos → home: título visível sem skeleton", async ({ page }) => {
    await page.goto("/planos");
    await expect(page.getByRole("heading", { name: /Planos para cada tipo/i })).toBeVisible();
    await page.getByRole("banner").getByRole("link", { name: /EventosBR — início/i }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1, name: /Venda ingressos/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test("home → planos: título visível imediatamente", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Ver detalhes em Planos/i }).click();
    await expect(page).toHaveURL(/\/planos/);
    await expect(page.getByRole("heading", { name: /Planos para cada tipo/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test("home → eventos: hero visível durante carregamento", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Explorar eventos/i }).first().click();
    await expect(page).toHaveURL(/\/eventos/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Encontre seu|Busca:|Eventos de/i }),
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Navegação — scroll e logo", () => {
  test("nova página inicia no topo após scroll", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.getByRole("link", { name: /Explorar eventos/i }).first().click();
    await page.waitForURL(/\/eventos/);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeLessThan(8);
  });

  test("logo na home rola para o topo", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.getByRole("link", { name: /EventosBR — início/i }).first().click();
    await page.waitForTimeout(400);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeLessThan(8);
  });
});

test.describe("Menu direito (organizador) — sidebar e rodapé estáveis", () => {
  test("Perfil no dropdown não troca a barra lateral nem colapsa o rodapé", async ({
    page,
    request,
  }) => {
    test.skip(!process.env.PLAYWRIGHT_API_URL, "Requer API (PLAYWRIGHT_API_URL)");
    await waitForApiReady(90_000);

    const suf = Date.now();
    const email = `e2e_navbar_org_${suf}@test.com`;
    const senha = "senha12345";
    const apiBase = (process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
    const reg = await request.post(`${apiBase}/api/auth/registrar`, {
      data: { email, nome: "Org Navbar E2E", senha, tipo: "organizador" },
    });
    expect(reg.ok()).toBeTruthy();

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem("eventosbr_tour_v1", "1");
    });
    await page.goto("/auth?login=1", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("form[data-auth-ready=true]", { timeout: 20_000 });
    await page.locator("#email").fill(email);
    await page.locator("#senha").fill(senha);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 30_000 });

    await page.goto("/organizador/eventos", { waitUntil: "domcontentloaded" });
    const sidebarNav = page.getByRole("navigation", { name: "Navegação do organizador" });
    const footer = page.locator("footer");
    const viewportHeight = 800;
    await expect(sidebarNav).toBeVisible();

    async function clicarItemDropdown(nome: string, urlParte: string) {
      await page.getByRole("button", { name: "Abrir menu da conta" }).click();
      await page.getByRole("menuitem", { name: nome, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(urlParte));
      // Barra lateral do organizador nunca deve sumir/ser trocada por outra
      await expect(sidebarNav).toBeVisible();
      // Rodapé não pode "piscar" saltando para o meio da tela durante a navegação
      for (let i = 0; i < 6; i++) {
        const box = await footer.boundingBox();
        if (box) {
          expect(box.y).toBeGreaterThan(viewportHeight * 0.3);
        }
        await page.waitForTimeout(80);
      }
    }

    await clicarItemDropdown("Perfil", "/organizador/perfil$");

    const perfilNav = page.getByRole("navigation", { name: "Seções do perfil" });
    await perfilNav.getByRole("link", { name: "Pagamentos" }).click();
    await expect(page).toHaveURL(/\/organizador\/perfil\/pagamentos/);
    await expect(sidebarNav).toBeVisible();

    await perfilNav.getByRole("link", { name: "Ingressos" }).click();
    await expect(page).toHaveURL(/\/organizador\/perfil\/ingressos/);
    await expect(sidebarNav).toBeVisible();

    await perfilNav.getByRole("link", { name: "Notificações" }).click();
    await expect(page).toHaveURL(/\/organizador\/perfil\/notificacoes/);
    await expect(sidebarNav).toBeVisible();
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
