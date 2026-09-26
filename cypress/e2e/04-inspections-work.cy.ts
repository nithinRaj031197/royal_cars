/** Stages 2 and 4: inspection findings, then refurbishment work orders. */
describe("Inspections and refurbishment", () => {
  beforeEach(() => cy.login());

  it("lists inspections", () => {
    cy.visit("/inspections");
    cy.contains("h1", /Inspections/).should("be.visible");
  });

  it("records an inspection against a seeded vehicle", () => {
    cy.visit("/inspections/new");
    cy.field("Vehicle").find("option").its("length").should("be.greaterThan", 1);
    cy.field("Vehicle").then(($s) => {
      const value = $s.find("option").not('[value=""]').first().attr("value") ?? "";
      cy.wrap($s).select(value, { force: true });
    });
    cy.fill("Odometer (km)", "54000");
    cy.fill("Estimated repair (₹)", "12000");
    cy.fill("Recommended work", "Cypress: brake pads, wheel alignment");
    cy.submitForm();
    cy.location("pathname", { timeout: 30000 }).should("not.include", "/new");
  });

  it("raises a work order with an estimated cost", () => {
    cy.visit("/work/new");
    cy.field("Vehicle").then(($s) => {
      const value = $s.find("option").not('[value=""]').first().attr("value") ?? "";
      cy.wrap($s).select(value, { force: true });
    });
    cy.fill("Required work", "Cypress: full body polish");
    cy.fill("Estimated cost (₹)", "8500");
    cy.submitForm();
    cy.location("pathname", { timeout: 30000 }).should("not.include", "/new");
  });

  it("lists vendors and expenses", () => {
    cy.visit("/vendors");
    cy.contains("h1", /Vendors/).should("be.visible");
  });
});
