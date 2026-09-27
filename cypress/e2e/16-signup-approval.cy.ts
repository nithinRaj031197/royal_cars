/**
 * Self sign-up + owner approval.
 *
 * A newly signed-up account cannot sign in until an owner approves it from
 * Settings — the same `active` flag that already gates any staff account,
 * not a separate approval column.
 */
describe("Signup and owner approval", () => {
  it("shows the signup form and links back to login", () => {
    cy.visit("/signup");
    cy.contains("h1", /Request an account/i).should("be.visible");
    cy.contains("a", /Sign in/i).should("have.attr", "href", "/login");
  });

  it("links from the login page to signup", () => {
    cy.visit("/login");
    cy.contains("a", /Request an account/i).should("have.attr", "href", "/signup");
  });

  it("a signed-up account cannot sign in until an owner approves it, then can", () => {
    const email = `cypress.signup.${Date.now()}@royalcars.demo`;
    const password = "Cypress-signup-1";

    // --- request the account -------------------------------------------
    cy.visit("/signup");
    cy.get('input[autocomplete="name"]').type("Cypress Signup");
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type(password);
    cy.get("form").contains("button", /Request account/i).click();
    cy.contains(/Request submitted/i, { timeout: 20000 }).should("be.visible");

    // --- rejected before approval ---------------------------------------
    cy.visit("/login");
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.contains(/not active yet/i, { timeout: 20000 }).should("be.visible");
    cy.location("pathname").should("include", "/login");

    // --- owner approves from Settings ------------------------------------
    cy.login(); // owner session
    cy.visit("/settings");
    cy.contains("tr", email, { timeout: 20000 }).scrollIntoView().within(() => {
      cy.contains("Pending").should("exist");
      cy.contains("button", /Approve/i).scrollIntoView().click();
    });
    cy.contains("tr", email, { timeout: 20000 }).contains("Active").should("exist");

    // --- now signs in normally --------------------------------------------
    cy.clearCookies();
    cy.visit("/login");
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.location("pathname", { timeout: 20000 }).should("not.include", "/login");
    cy.request("/api/auth/session").its("body.user.email").should("eq", email);
  });

  it("refuses a second request for an email already used", () => {
    const email = `cypress.dup.${Date.now()}@royalcars.demo`;
    const submit = () => {
      cy.visit("/signup");
      cy.get('input[autocomplete="name"]').type("Cypress Dup");
      cy.get('input[type="email"]').type(email);
      cy.get('input[type="password"]').type("Cypress-signup-1");
      cy.get("form").contains("button", /Request account/i).click();
    };
    submit();
    cy.contains(/Request submitted/i, { timeout: 20000 }).should("be.visible");
    submit();
    cy.contains(/already exists/i, { timeout: 20000 }).should("be.visible");
  });
});
