/**
 * The full money journey on one car: book the sale, pay it down in stages,
 * and hand it over.
 *
 * The overpayment step is the important one. Payments run through the
 * serialized critical path with an `assert-sum` guard, and the defect it
 * exists to prevent is taking more money than the sale is worth.
 */
const rupees = (text: string) => Number(text.replace(/[^0-9]/g, ""));

/**
 * Asserts the outstanding balance, retrying until the page catches up.
 *
 * Reading the text through .then() and asserting on the resolved number does
 * NOT retry, so it captures whatever was on screen before router.refresh()
 * re-rendered the figure. Assert inside .should() so Cypress re-queries.
 */
const expectBalance = (expected: number, label: string) =>
  cy.contains(/Balance due/i, { timeout: 30000 }).should(($el) => {
    expect(rupees($el.text()), label).to.eq(expected);
  });

describe("Sale payments and delivery", () => {
  const PRICE = 300000;

  beforeEach(() => cy.login());

  it("books a sale, settles it in two payments, refuses an overpayment, then delivers", () => {
    const buyer = `Cypress Payer ${Date.now()}`;
    cy.intercept("POST", "/api/sales").as("sales");

    // --- book the sale on a car this spec owns ----------------------------
    cy.createSellableVehicle("Payer").then((vehicleId) => {
      cy.visit("/sales/new");
      cy.field("Vehicle").select(vehicleId, { force: true });
    });
    cy.fill("Customer name", buyer);
    cy.fill("Customer phone", "9845998877");
    cy.fill("Final net price (₹)", String(PRICE));
    cy.contains("button", /Book sale/i).click();

    // Navigate by the id the API returns. Matching a row in the list opened
    // the wrong sale, because several rows share a customer column shape.
    cy.wait("@sales").then((i) => {
      expect(i.response?.statusCode, "sale should be created").to.eq(201);
      const saleId = (i.response?.body as { id: string }).id;
      cy.visit(`/sales/${saleId}`);
    });

    expectBalance(PRICE, "balance on a new sale");

    // --- first payment -----------------------------------------------------
    cy.fill("Amount (₹)", "100000");
    cy.contains("button", /Record payment/i).click();
    cy.wait("@sales").its("response.statusCode").should("eq", 200);
    expectBalance(PRICE - 100000, "balance after the first payment");

    // --- overpayment must be refused --------------------------------------
    cy.fill("Amount (₹)", "999999");
    cy.contains("button", /Record payment/i).click();
    cy.wait("@sales").then((i) => {
      expect(i.response?.statusCode, "overpayment must be rejected").to.be.gte(400);
    });
    cy.contains(/exceeds the balance/i).should("be.visible");
    expectBalance(PRICE - 100000, "an overpayment must not change the balance");

    // --- settle the balance ------------------------------------------------
    cy.fill("Amount (₹)", "200000");
    cy.contains("button", /Record payment/i).click();
    cy.wait("@sales").its("response.statusCode").should("eq", 200);
    expectBalance(0, "balance once settled");

    // --- deliver -----------------------------------------------------------
    cy.contains("h3", /Complete delivery/i).should("be.visible");
    cy.fill("Odometer at delivery (km)", "41000");
    // Handover is blocked until the mandatory checklist is signed off.
    cy.contains("legend", /Checklist/i)
      .parent()
      .find('input[type="checkbox"]')
      .each(($c) => cy.wrap($c).check({ force: true }));
    cy.contains("button", /Complete delivery/i).click();
    // A completed handover returns to the car, not the sale.
    cy.location("pathname", { timeout: 30000 }).should("include", "/inventory/");
    cy.contains(/Delivered/i, { timeout: 30000 }).should("exist");
  });

  it("refuses a further payment on a sale that is already settled", () => {
    cy.visit("/sales");
    cy.contains("tr", "SAL-SEED01").find('a[href^="/sales/"]').first().click();
    cy.location("pathname").then((p) => {
      const saleId = p.split("/").pop();
      cy.request({
        method: "POST",
        url: "/api/sales",
        failOnStatusCode: false,
        body: {
          type: "payment",
          saleId,
          date: new Date().toISOString().slice(0, 10),
          amount: "500000",
          method: "Cash",
          idempotencyKey: `cypress-${Date.now()}`
        }
      }).then((res) => {
        expect(res.status, "a fully-paid sale must refuse another payment").to.be.gte(400);
      });
    });
  });
});
