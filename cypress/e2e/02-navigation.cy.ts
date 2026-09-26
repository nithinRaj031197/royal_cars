const SECTIONS: Array<[string, string | RegExp]> = [
  ["/dashboard", "Dashboard"],
  ["/acquisitions", "Acquisitions"],
  ["/inspections", /Inspections/],
  ["/inventory", "Inventory"],
  ["/leads", /Leads/],
  ["/sales", /Sales/],
  ["/aftersale", /After-Sale/],
  ["/ledger", /money trail/i],
  ["/reports", "Reports"],
  ["/vendors", /Vendors/],
  ["/settings", "Settings"]
];

describe("Navigation", () => {
  beforeEach(() => cy.login());

  SECTIONS.forEach(([path, heading]) => {
    it(`renders ${path} with visible content`, () => {
      cy.visit(path);
      cy.contains("h1", heading, { timeout: 30000 }).should("be.visible");
      // Guards the regression where pages server-rendered at opacity:0.
      cy.get("h1").should("have.css", "opacity", "1");
    });
  });

  it("navigates between sections via the sidebar without a full reload", () => {
    cy.visit("/dashboard");
    cy.window().then((w) => ((w as unknown as Record<string, boolean>).__spa = true));
    // The sidebar uses plain-language labels ("Cars we own"), so target the href.
    cy.get('a[href="/inventory"]').first().click();
    cy.location("pathname", { timeout: 20000 }).should("include", "/inventory");
    cy.contains("h1", "Inventory").should("be.visible");
    cy.window().its("__spa").should("eq", true);
  });
});
