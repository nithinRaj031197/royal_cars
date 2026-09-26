/** Stage 6: demand side — leads, follow-ups, reservations. */
describe("Leads and customers", () => {
  beforeEach(() => cy.login());

  it("lists leads and customers", () => {
    cy.visit("/leads");
    cy.contains("h1", /Leads/).should("be.visible");
  });

  it("creates a lead with only a customer name", () => {
    const name = `Cypress Buyer ${Date.now()}`;
    cy.visit("/leads/new");
    // "Customer" is a picker of existing customers until this box is ticked.
    cy.contains("label", "New customer").find('input[type="checkbox"]').check();
    cy.fill("Customer", name);
    cy.submitForm();
    cy.location("pathname", { timeout: 30000 }).should("not.include", "/new");
    cy.visit("/leads");
    cy.contains(name).should("exist");
  });

  it("creates a lead with a budget and a source", () => {
    const name = `Cypress Budget ${Date.now()}`;
    cy.visit("/leads/new");
    cy.contains("label", "New customer").find('input[type="checkbox"]').check();
    cy.fill("Customer", name);
    cy.fill("Budget (₹)", "650000");
    cy.fill("Source", "Referral");
    cy.fill("Notes", "Cypress: wants a hatchback under 7L");
    cy.submitForm();
    cy.location("pathname", { timeout: 30000 }).should("not.include", "/new");
  });
});
