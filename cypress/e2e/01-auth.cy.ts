import { DEMO_OWNER } from "../support/commands";

describe("Authentication", () => {
  it("shows the sign-in form", () => {
    cy.visit("/login");
    cy.contains("Royal Cars").should("be.visible");
    cy.get('input[type="email"]').should("be.visible");
    cy.get('input[type="password"]').should("be.visible");
    cy.get('button[type="submit"]').should("be.visible");
  });

  it("sends an unauthenticated visitor to the login page", () => {
    cy.visit("/dashboard");
    cy.location("pathname").should("include", "/login");
  });

  it("rejects a wrong password without revealing whether the email exists", () => {
    cy.visit("/login");
    cy.get('input[type="email"]').type(DEMO_OWNER.email);
    cy.get('input[type="password"]').type("definitely-not-the-password");
    cy.get('button[type="submit"]').click();
    cy.contains(/incorrect|invalid/i, { timeout: 20000 }).should("be.visible");
    cy.location("pathname").should("include", "/login");
  });

  it("rejects an unknown email with the same message", () => {
    cy.visit("/login");
    cy.get('input[type="email"]').type("nobody@royalcars.demo");
    cy.get('input[type="password"]').type("definitely-not-the-password");
    cy.get('button[type="submit"]').click();
    cy.contains(/incorrect|invalid/i, { timeout: 20000 }).should("be.visible");
  });

  it("signs in with valid credentials and reaches the dashboard", () => {
    cy.visit("/login");
    cy.get('input[type="email"]').type(DEMO_OWNER.email);
    cy.get('input[type="password"]').type(DEMO_OWNER.password);
    cy.get('button[type="submit"]').click();
    cy.location("pathname", { timeout: 30000 }).should("not.include", "/login");
    cy.request("/api/auth/session").its("body.user.role").should("eq", "owner");
  });

  it("signs out and blocks protected pages again", () => {
    cy.login();
    cy.visit("/dashboard");
    cy.contains("h1", "Dashboard").should("be.visible");
    cy.contains(/sign out/i).click();
    cy.location("pathname", { timeout: 30000 }).should("include", "/login");
    cy.visit("/dashboard");
    cy.location("pathname").should("include", "/login");
  });
});
