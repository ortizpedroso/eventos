import { waitForApiReady } from "./helpers/api-setup";

export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_SKIP_API_CHECK === "1") {
    return;
  }
  try {
    await waitForApiReady(90_000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (process.env.CI) {
      throw new Error(`${msg}\nDica CI: inicie API com STRIPE_DISABLED=true ou use docker-compose.e2e.yml`);
    }
    console.warn(`[playwright] ${msg} — testes de compra podem falhar; smoke segue sem API.`);
  }
}
