/** Stage 5: what we own, and what we are asking for it. */
describe("Inventory", () => {
  beforeEach(() => cy.login());

  it("shows the seeded stock", () => {
    cy.visit("/inventory");
    cy.contains("h1", "Inventory").should("be.visible");
    cy.contains("STK-00001").should("be.visible");
    cy.contains("STK-00002").should("be.visible");
  });

  it("opens a vehicle and shows its money summary to an owner", () => {
    cy.visit("/inventory");
    cy.contains("a", "STK-00002").click();
    cy.location("pathname").should("match", /\/inventory\/.+/);
    cy.contains(/STK-00002/).should("be.visible");
    // Owners have profit.view, so cost figures must be present.
    cy.contains(/₹/).should("be.visible");
  });
});
