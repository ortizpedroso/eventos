import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "smoke",
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "compra",
      testMatch: /compra-checkout\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "fluxo",
      testMatch: /fluxo-org-cliente\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "asaas",
      testMatch: /compra-checkout-asaas\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "patamar",
      testMatch: /patamar-ux\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(skipWebServer
    ? {}
    : {
        webServer: {
          command:
            process.env.CI || process.env.E2E_USE_START === "1"
              ? "npm run start"
              : "npm run dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          env: {
            ...process.env,
            INTERNAL_API_URL: process.env.INTERNAL_API_URL ?? "http://127.0.0.1:8000",
          },
        },
      }),
});
