export {};

/**
 * One car's whole life, written to the REAL spreadsheet.
 *
 * Every record carries the run tag so cleanup can find it again. Nothing here
 * touches rows that do not carry that tag.
 */
const TAG = Cypress.env("TESTTAG") as string;
const OWNER = { email: Cypress.env("OWNER_EMAIL") as string, password: Cypress.env("OWNER_PASSWORD") as string };
const PRICE = 300000;
const rupees = (t: string) => Number(t.replace(/[^0-9]/g, ""));

/**
 * Picks a vehicle, reloading if the option is not there yet.
 *
 * Against Sheets a page render can fail transiently (the store surfaces a 502
 * once its retry budget is spent), leaving a page with no options at all. One
 * reload is enough; failing on the first miss just makes the run flaky.
 */
const selectVehicle = (vehicleId: string, attempt = 0): void => {
  cy.get("body", { timeout: 90000 }).then(($b) => {
    if ($b.find(`option[value="${vehicleId}"]`).length === 0) {
      if (attempt >= 3) throw new Error(`Vehicle ${vehicleId} never appeared in the picker`);
      cy.wait(3000);
      cy.reload();
      selectVehicle(vehicleId, attempt + 1);
      return;
    }
    cy.field("Vehicle").select(vehicleId, { force: true });
  });
};

const expectBalance = (expected: number, label: string) =>
  cy
    .contains(/Balance due/i, { timeout: 60000 })
    .should((el) => {
      expect(rupees(Cypress.$(el as unknown as HTMLElement).text()), label).to.eq(expected);
    });

describe(`Google Sheets journey [${TAG}]`, () => {
  before(() => {
    cy.intercept("POST", "/api/auth/callback/password").as("signin");
    cy.visit("/login");
    cy.get('input[type="email"]').type(OWNER.email);
    cy.get('input[type="password"]').type(OWNER.password, { log: false });
    cy.get('button[type="submit"]').click();
    // Against Sheets the credentials call takes seconds. Wait for it to land
    // before navigating — the form's immediate window.location jump can beat
    // the session cookie, and the dashboard then 307s back to /login.
    cy.wait("@signin", { timeout: 90000 }).its("response.statusCode").should("eq", 200);
    cy.visit("/dashboard");
    cy.location("pathname", { timeout: 90000 }).should("include", "/dashboard");
    cy.contains("h1", "Dashboard", { timeout: 90000 }).should("be.visible");
  });

  it("writes the full lifecycle to Google Sheets", () => {
    cy.intercept("POST", "/api/acquisitions").as("acq");
    cy.intercept("POST", "/api/sales").as("sales");
    cy.intercept("POST", "/api/inspections").as("insp");
    cy.intercept("POST", "/api/work").as("work");

    // 1 — acquisition ------------------------------------------------------
    cy.visit("/acquisitions/new");
    cy.fill("Seller name", `${TAG} Seller`);
    cy.fill("Seller phone", "9845000000");
    cy.fill("Make", "Maruti Suzuki");
    cy.fill("Model", `${TAG} Alto`);
    cy.fill("Expected price (₹)", "420000");
    cy.contains("button", /Create enquiry/i).click();
    cy.wait("@acq", { timeout: 60000 }).then((i) => {
      expect(i.response?.statusCode, "acquisition created in Sheets").to.eq(201);
      const body = i.response?.body as { vehicle: { id: string }; caseRow: { id: string } };
      cy.wrap(body.vehicle.id).as("vehicleId");
      cy.wrap(body.caseRow.id).as("caseId");
    });

    cy.wait(2000);

    // 2 — inspection -------------------------------------------------------
    cy.get<string>("@vehicleId").then((vehicleId) => {
      cy.visit("/inspections/new");
      selectVehicle(vehicleId);
      cy.fill("Odometer (km)", "52000");
      cy.fill("Estimated repair (₹)", "18000");
      cy.fill("Recommended work", `${TAG} brake pads and alignment`);
      cy.contains("button", /Save inspection/i).click();
      cy.location("pathname", { timeout: 60000 }).should("not.include", "/new");
    });

    cy.wait(2000);

    // 3 — purchase the car so it enters inventory --------------------------
    cy.get<string>("@caseId").then((caseId) => {
      cy.request("POST", `/api/acquisitions/${caseId}`, { action: "approve", agreedPrice: "400000" });
      cy.request("POST", `/api/acquisitions/${caseId}`, {
        action: "acquire",
        purchasePrice: "400000",
        purchaseDate: new Date().toISOString().slice(0, 10)
      });
    });

    cy.wait(2000);

    // 4 — refurbishment work order, only possible on a car we own ----------
    cy.get<string>("@vehicleId").then((vehicleId) => {
      cy.visit("/work/new");
      selectVehicle(vehicleId);
      cy.fill("Required work", `${TAG} full polish and brake service`);
      cy.fill("Estimated cost (₹)", "18000");
      cy.contains("button", /Save/i).click();
      cy.location("pathname", { timeout: 60000 }).should("not.include", "/new");
    });

    cy.wait(2000);

    // 5 — inventory --------------------------------------------------------
    cy.visit("/inventory");
    cy.contains(`${TAG} Alto`, { timeout: 60000 }).should("be.visible");

    cy.wait(2000);

    // 6 — reservation ------------------------------------------------------
    cy.get<string>("@vehicleId").then((vehicleId) => {
      cy.visit("/sales/new?type=reservation");
      selectVehicle(vehicleId);
      cy.fill("Customer name", `${TAG} Buyer`);
      cy.fill("Customer phone", "9845111111");
      cy.fill("Agreed price (₹)", String(PRICE));
      cy.fill("Booking amount (₹)", "25000");
      cy.contains("button", /Create reservation/i).click();
      cy.wait("@sales", { timeout: 60000 }).its("response.statusCode").should("eq", 201);
    });

    cy.wait(2000);

    // 7 — sale -------------------------------------------------------------
    cy.get<string>("@vehicleId").then((vehicleId) => {
      cy.visit("/sales/new");
      selectVehicle(vehicleId);
      cy.fill("Customer name", `${TAG} Buyer`);
      cy.fill("Customer phone", "9845111111");
      cy.fill("Final net price (₹)", String(PRICE));
      cy.contains("button", /Book sale/i).click();
    });
    cy.wait("@sales", { timeout: 60000 }).then((i) => {
      expect(i.response?.statusCode, "sale created in Sheets").to.eq(201);
      const saleId = (i.response?.body as { id: string }).id;
      cy.wrap(saleId).as("saleId");
      cy.visit(`/sales/${saleId}`);
    });

    // 8 — payments, including a refused overpayment ------------------------
    // A ₹25,000 booking already transferred in, so the opening balance is net.
    expectBalance(PRICE - 25000, "opening balance after the booking transfers");

    cy.fill("Amount (₹)", "100000");
    cy.contains("button", /Record payment/i).click();
    cy.wait("@sales", { timeout: 60000 }).its("response.statusCode").should("eq", 200);
    expectBalance(PRICE - 25000 - 100000, "balance after the first payment");

    cy.fill("Amount (₹)", "999999");
    cy.contains("button", /Record payment/i).click();
    cy.wait("@sales", { timeout: 60000 }).then((i) => {
      expect(i.response?.statusCode, "overpayment must be refused").to.be.gte(400);
    });
    expectBalance(PRICE - 25000 - 100000, "an overpayment must not change the balance");

    cy.fill("Amount (₹)", String(PRICE - 25000 - 100000));
    cy.contains("button", /Record payment/i).click();
    cy.wait("@sales", { timeout: 60000 }).its("response.statusCode").should("eq", 200);
    expectBalance(0, "balance once settled");

    cy.wait(2000);

    // 9 — delivery ---------------------------------------------------------
    cy.contains("h3", /Complete delivery/i).should("be.visible");
    cy.fill("Odometer at delivery (km)", "52100");
    cy.contains("legend", /Checklist/i).parent().find('input[type="checkbox"]')
      .each(($c) => cy.wrap($c).check({ force: true }));
    cy.contains("button", /Complete delivery/i).click();
    cy.location("pathname", { timeout: 60000 }).should("include", "/inventory/");
    cy.contains(/Delivered/i, { timeout: 60000 }).should("exist");

    // 10 — ledger arithmetic ----------------------------------------------
    cy.visit("/ledger");
    cy.contains("tr", `${TAG} Alto`, { timeout: 60000 }).within(() => {
      cy.get("td").then(($tds) => {
        const c = $tds.toArray().map((td) => td.innerText.trim());
        const bought = rupees(c[1] ?? "");
        const spent = rupees(c[3] ?? "");
        const invested = rupees(c[4] ?? "");
        const sold = rupees(c[5] ?? "");
        expect(bought, "purchase price").to.eq(400000);
        expect(invested, "bought + spent must equal invested").to.eq(bought + spent);
        expect(sold, "sale price").to.eq(PRICE);
      });
    });
  });
});
