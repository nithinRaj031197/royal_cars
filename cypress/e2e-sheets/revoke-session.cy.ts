export {};

/**
 * assertAccountActive() is a no-op under DEMO_MODE, so this scenario only
 * means anything against the real (Sheets-backed) auth path — hence its own
 * spec here rather than in cypress/e2e/.
 */
const OWNER = { email: Cypress.env("OWNER_EMAIL") as string, password: Cypress.env("OWNER_PASSWORD") as string };

function signIn(email: string, password: string) {
  cy.intercept("POST", "/api/auth/callback/password").as("signin");
  cy.visit("/login");
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password, { log: false });
  cy.get('button[type="submit"]').click();
  cy.wait("@signin", { timeout: 90000 }).its("response.statusCode").should("eq", 200);
}

describe("Deactivating an already signed-in account cuts it off immediately", () => {
  it("blocks the very next request of a session issued BEFORE deactivation, not just new sign-ins", () => {
    const email = `cytest-revoke-${Date.now()}@royalcars.demo`;
    const password = "Cypress-revoke-1";

    cy.request("POST", "/api/auth/signup", { email, name: "Cypress Revoke", password, role: "sales" });

    // --- owner approves ------------------------------------------------
    cy.session(["password", OWNER.email], () => signIn(OWNER.email, OWNER.password), { cacheAcrossSpecs: true });
    cy.visit("/settings");
    cy.contains("tr", email, { timeout: 60000 }).scrollIntoView().within(() => {
      cy.contains("button", /Approve/i).scrollIntoView().click();
    });
    cy.contains("tr", email, { timeout: 60000 }).contains("Active").should("exist");

    // --- session A: the new account signs in, and keeps a live cookie --
    cy.session(["password", email], () => signIn(email, password));
    cy.visit("/dashboard");
    cy.contains("h1", "Dashboard", { timeout: 60000 }).should("be.visible");

    // --- owner deactivates it, in a fresh session of its own -----------
    cy.session(["password", OWNER.email], () => signIn(OWNER.email, OWNER.password), { cacheAcrossSpecs: true });
    cy.visit("/settings");
    cy.contains("tr", email, { timeout: 60000 }).scrollIntoView().within(() => {
      cy.contains("button", /Deactivate/i).scrollIntoView().click();
    });
    cy.contains("tr", email, { timeout: 60000 }).contains("Pending").should("exist");

    // --- session A restored: the SAME cookie issued before deactivation.
    // Cypress requires the identical setup callback for a given session key,
    // so this calls signIn(email, password) again verbatim — but since the
    // session was already cached above and nothing invalidated it, Cypress
    // restores the STORED cookies rather than re-running the callback. If it
    // signed in again here, that would be a fresh post-deactivation attempt
    // and would prove nothing about the pre-existing session.
    cy.session(["password", email], () => signIn(email, password));
    cy.visit("/dashboard");
    cy.location("pathname", { timeout: 20000 }).should("include", "/login");
  });
});
