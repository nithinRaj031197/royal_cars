/**
 * Role permissions.
 *
 * The important guarantee is server-side: confidential fields are stripped from
 * projections, not merely hidden with CSS. These tests read the rendered page
 * for a non-owner role and assert the numbers are absent.
 */
describe("Role-based permissions", () => {
  it("an owner sees purchase cost and profit", () => {
    cy.loginAs("owner");
    cy.visit("/ledger");
    cy.contains(/Bought for/i).should("be.visible");
  });

  it("a sales user cannot see the purchase price column", () => {
    cy.loginAs("sales");
    cy.visit("/ledger", { failOnStatusCode: false });
    cy.get("body").then(($b) => {
      const text = $b.text();
      expect(text).to.not.match(/Bought for/i);
    });
  });

  it("a sales user is refused the confidential API projection", () => {
    cy.loginAs("sales");
    cy.request({ url: "/api/vehicles", failOnStatusCode: false }).then((res) => {
      if (res.status === 200) {
        // The key may still be present; what matters is that no figure is in it.
        const vehicles = (res.body as { vehicles?: Array<Record<string, unknown>> }).vehicles ?? [];
        expect(vehicles.length, "expected vehicles in the projection").to.be.greaterThan(0);
        vehicles.forEach((v) => {
          expect(v.purchasePricePaise, `purchase price for ${v.stockRef}`).to.be.oneOf([null, undefined]);
          expect(v.snapshotGrossProfitPaise, `profit for ${v.stockRef}`).to.be.oneOf([null, undefined]);
        });
      } else {
        expect(res.status).to.be.oneOf([401, 403]);
      }
    });
  });

  it("an operations user can reach inspections", () => {
    cy.loginAs("operations");
    cy.visit("/inspections");
    cy.contains("h1", /Inspections/).should("be.visible");
  });

  it("refuses an unauthenticated API write", () => {
    cy.clearCookies();
    cy.request({
      method: "POST",
      url: "/api/acquisitions",
      failOnStatusCode: false,
      body: { sellerName: "Intruder", make: "Ghost" }
    }).then((res) => {
      expect(res.status, "unauthenticated write must be refused").to.be.oneOf([401, 403]);
    });
  });
});
