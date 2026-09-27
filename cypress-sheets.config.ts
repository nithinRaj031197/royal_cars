import { defineConfig } from "cypress";

/** Runs against a server wired to the real spreadsheet. Slower, so longer waits. */
export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? "http://localhost:3300",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e-sheets/**/*.cy.ts",
    video: false,
    defaultCommandTimeout: 30000,
    requestTimeout: 60000,
    responseTimeout: 60000,
    pageLoadTimeout: 90000,
    retries: { runMode: 0, openMode: 0 },
    viewportWidth: 1280,
    viewportHeight: 900
  }
});
