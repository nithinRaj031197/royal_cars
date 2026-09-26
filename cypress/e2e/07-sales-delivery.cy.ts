/** Stages 7-8: the sale, its payments, and handover. */
describe("Sales, payments and delivery", () => {
  beforeEach(() => cy.login());

  it("lists sales", () => {
    cy.visit("/sales");
    cy.contains("h1", /Sales/).should("be.visible");
  });

  it("records a sale against an available vehicle", () => {
    const buyer = `Cypress Buyer ${Date.now()}`;
    cy.visit("/sales/new");
    cy.field("Vehicle").find("option").its("length").should("be.greaterThan", 1);
    cy.field("Vehicle").then(($s) => {
      const value = $s.find("option").not('[value=""]').first().attr("value") ?? "";
      cy.wrap($s).select(value, { force: true });
    });
    cy.fill("Customer name", buyer);
    cy.fill("Customer phone", "9845777888");
    cy.fill("Final net price (₹)", "500000");
    cy.submitForm();
    cy.location("pathname", { timeout: 30000 }).should("not.include", "/new");
  });

  it("opens a seeded sale and shows payment information", () => {
    cy.visit("/sales");
    cy.get('a[href^="/sales/"]').not('[href="/sales/new"]').first().click();
    cy.location("pathname").should("match", /\/sales\/.+/);
    cy.contains(/₹/).should("be.visible");
  });
});
