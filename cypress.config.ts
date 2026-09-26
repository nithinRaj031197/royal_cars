import { defineConfig } from "cypress";

/**
 * End-to-end suite for Royal Cars.
 *
 * Runs against a dev server started with DEMO_MODE=1, so the fictional dataset
 * is seeded and deterministic. Nothing here touches the real spreadsheet.
 */
export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? "http://localhost:3200",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 12000,
    requestTimeout: 15000,
    pageLoadTimeout: 60000,
    viewportWidth: 1280,
    viewportHeight: 900,
    retries: { runMode: 1, openMode: 0 }
  }
});
