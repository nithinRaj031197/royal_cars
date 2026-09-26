/** Stage 1 of the lifecycle: a seller offers a car. */
describe("Acquisitions — seller enquiries", () => {
  beforeEach(() => cy.login());

  it("lists the seeded acquisition cases", () => {
    cy.visit("/acquisitions");
    cy.contains("h1", "Acquisitions").should("be.visible");
    cy.contains("ACQ-00001").should("be.visible");
  });

  it("creates an enquiry from a seller name and a model alone", () => {
    const model = `Alto-${Date.now()}`;
    cy.visit("/acquisitions/new");
    cy.fill("Seller name", "Cypress Seller");
    cy.fill("Model", model);
    cy.submitForm();
    cy.location("pathname", { timeout: 30000 }).should("not.include", "/new");
    cy.visit("/acquisitions");
    cy.contains(model).should("exist");
  });

  it("creates an enquiry from a phone number and a registration alone", () => {
    const reg = `KA01CY${String(Date.now()).slice(-4)}`;
    cy.visit("/acquisitions/new");
    cy.fill("Seller phone", "9845000111");
    cy.fill(/^Registration number$|^Registration$/, reg);
    cy.submitForm();
    cy.location("pathname", { timeout: 30000 }).should("not.include", "/new");
  });

  it("refuses a completely empty enquiry", () => {
    cy.visit("/acquisitions/new");
    cy.submitForm();
    // Must stay on the form and say why.
    cy.location("pathname").should("include", "/new");
    cy.contains(/required|enter|provide|at least/i, { timeout: 15000 }).should("be.visible");
  });

  it("opens an existing case", () => {
    cy.visit("/acquisitions");
    cy.contains("a", "ACQ-00001").click();
    cy.location("pathname").should("match", /\/acquisitions\/.+/);
    cy.contains(/ACQ-00001/).should("be.visible");
  });
});
