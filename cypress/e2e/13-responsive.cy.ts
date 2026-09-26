/** Mobile-first: the app is used on phones in the showroom. */
describe("Mobile layout", () => {
  beforeEach(() => cy.login());

  ["/dashboard", "/inventory", "/ledger", "/acquisitions"].forEach((path) => {
    it(`has no horizontal page overflow at 390px on ${path}`, () => {
      cy.viewport(390, 844);
      cy.visit(path);
      cy.get("h1").first().should("be.visible");
      cy.document().then((doc) => {
        const el = doc.documentElement;
        expect(el.scrollWidth, `${path} must not scroll horizontally`).to.be.at.most(el.clientWidth + 1);
      });
    });
  });

  it("opens the mobile navigation drawer", () => {
    cy.viewport(390, 844);
    cy.visit("/dashboard");
    cy.get("button").filter(":visible").first().click();
    cy.get('a[href="/inventory"]').should("exist");
  });
});
