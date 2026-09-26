/**
 * Optional-field tolerance.
 *
 * The showroom does not always have complete records, so forms must accept
 * partial input. A blank optional field must behave exactly like an omitted
 * one — the bug class that produced 24 failures in the unit contract tests.
 */
describe("Form validation and optional fields", () => {
  beforeEach(() => cy.login());

  it("accepts a lead with everything optional left blank", () => {
    const name = `Cypress Minimal ${Date.now()}`;
    cy.visit("/leads/new");
    cy.contains("label", "New customer").find('input[type="checkbox"]').check();
    cy.fill("Customer", name);
    cy.submitForm();
    cy.location("pathname", { timeout: 30000 }).should("not.include", "/new");
  });

  it("accepts an acquisition with no email, no address and no prices", () => {
    const model = `Minimal-${Date.now()}`;
    cy.visit("/acquisitions/new");
    cy.fill("Seller name", "Cypress Sparse");
    cy.fill("Model", model);
    cy.submitForm();
    cy.location("pathname", { timeout: 30000 }).should("not.include", "/new");
  });

  it("rejects a malformed email rather than storing it", () => {
    cy.visit("/acquisitions/new");
    cy.fill("Seller name", "Cypress Bad Email");
    cy.fill("Model", "Swift");
    cy.fill("Seller email", "not-an-email");
    cy.submitForm();
    cy.location("pathname").should("include", "/new");
  });

  it("keeps the user on the form when nothing identifies the seller or car", () => {
    cy.visit("/acquisitions/new");
    cy.fill("Seller address", "Only an address, nothing else");
    cy.submitForm();
    cy.location("pathname").should("include", "/new");
  });
});
