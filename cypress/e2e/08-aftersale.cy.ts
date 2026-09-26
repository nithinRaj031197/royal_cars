/** Stage 9: commitments made at sale time, and what they cost. */
describe("After-sale service", () => {
  beforeEach(() => cy.login());

  it("lists after-sale activity", () => {
    cy.visit("/aftersale");
    cy.contains("h1", /After-Sale/).should("be.visible");
  });

  it("raises a service request against a delivered sale", () => {
    cy.visit("/aftersale/new");
    cy.field("Sale").find("option").its("length").should("be.greaterThan", 1);
    cy.field("Sale").then(($s) => {
      const value = $s.find("option").not('[value=""]').first().attr("value") ?? "";
      cy.wrap($s).select(value, { force: true });
    });
    cy.fill("Complaint", "Cypress: AC not cooling after delivery");
    cy.submitForm();
    cy.location("pathname", { timeout: 30000 }).should("not.include", "/new");
  });
});
