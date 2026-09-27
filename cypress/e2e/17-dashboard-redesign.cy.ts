/**
 * The dashboard redesign is presentation-only — same dashboardMetrics() call,
 * same permission checks as before. These tests exist to catch the two real
 * failure modes a visual pass like this can introduce: a section silently
 * failing to render (verified by finding this project's OWN prior instance of
 * exactly that — see dashboard-ui.tsx's note on the removed entrance
 * animation) and a role seeing a number it should not.
 */
describe("Dashboard redesign", () => {
  it("renders every section for an owner", () => {
    cy.viewport(1440, 960);
    cy.login();
    cy.visit("/dashboard");
    cy.contains("h1", "Dashboard", { timeout: 20000 }).should("be.visible");

    // Hero + financial KPIs
    cy.contains(/tied up in unsold stock/i).should("be.visible");
    cy.contains("p", "Unsold investment").should("be.visible");
    cy.contains("p", "Sales value (period)").should("be.visible");
    cy.contains("p", "Gross vehicle profit").should("be.visible");
    cy.contains("p", "Seller balance due").should("be.visible");
    cy.contains("p", "Customer balance due").should("be.visible");

    // Stock pipeline, pending actions, sales performance, recent activity
    cy.contains("h2", "Stock pipeline").should("be.visible");
    cy.contains("ENQUIRIES", { matchCase: false }).should("be.visible");
    cy.contains("h2", "Pending actions").should("be.visible");
    cy.contains("h2", "Sales performance").should("be.visible");
    cy.contains("h2", "Recent activity").should("be.visible");

    // The pre-existing disclaimer footer, unchanged
    cy.contains("p", /Metric definitions/i).should("be.visible");
  });

  it("has no horizontal overflow at phone, tablet or desktop widths", () => {
    cy.login();
    for (const width of [390, 834, 1440]) {
      cy.viewport(width, 1000);
      cy.visit("/dashboard");
      cy.contains("h1", "Dashboard", { timeout: 20000 }).should("be.visible");
      // .should() with a callback retries until it passes or times out — a
      // single .then()+expect only checks once, and under a busy dev server
      // (many specs deep into a full run) a scrollbar can appear transiently
      // while fonts/icons are still settling and disappear a moment later.
      // The assertion should tolerate that settle time, not race it.
      cy.document().should((doc) => {
        const el = doc.documentElement;
        expect(el.scrollWidth, `${width}px must not scroll horizontally`).to.be.at.most(el.clientWidth + 1);
      });
    }
  });

  it("throws no console errors on load", () => {
    cy.viewport(1440, 960);
    cy.login();
    cy.visit("/dashboard", {
      onBeforeLoad(win) {
        cy.spy(win.console, "error").as("consoleError");
      }
    });
    cy.contains("h1", "Dashboard", { timeout: 20000 }).should("be.visible");
    cy.get("@consoleError").should("not.have.been.called");
  });

  it("a sales role sees sales figures but not profit or purchase balances", () => {
    cy.viewport(1440, 960);
    cy.loginAs("sales");
    cy.visit("/dashboard");
    cy.contains("h1", "Dashboard", { timeout: 20000 }).should("be.visible");

    // The glossary footer legitimately names "Gross vehicle profit" as a
    // defined TERM for every role — that sentence is unchanged from before
    // this redesign. A KPI card is a distinct element: its label carries this
    // exact class combination, which the footer paragraph does not.
    cy.contains("p", /Metric definitions/i).should("exist");
    cy.get("p.text-xs.font-medium.uppercase.tracking-wide").contains(/Gross vehicle profit/i).should("not.exist");
    cy.get("p.text-xs.font-medium.uppercase.tracking-wide").contains(/Seller balance due/i).should("not.exist");
    cy.get("p.text-xs.font-medium.uppercase.tracking-wide").contains(/Customer balance due/i).should("not.exist");
    cy.get("p.text-xs.font-medium.uppercase.tracking-wide").contains(/Sales value/i).should("exist");
  });

  it("an operations role sees inventory figures but not profit", () => {
    cy.viewport(1440, 960);
    cy.loginAs("operations");
    cy.visit("/dashboard");
    cy.contains("h1", "Dashboard", { timeout: 20000 }).should("be.visible");
    cy.get("p.text-xs.font-medium.uppercase.tracking-wide").contains(/Gross vehicle profit/i).should("not.exist");
    cy.contains("h2", "Stock pipeline").should("be.visible");
  });
});
