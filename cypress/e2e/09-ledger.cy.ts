/**
 * The money trail: seller -> showroom -> customer.
 *
 * These assertions check arithmetic, not just rendering — the double-counting
 * bug this feature exists to prevent would show up as a wrong total.
 */
const toPaise = (text: string) => Number(text.replace(/[^0-9]/g, ""));

describe("Ledger — car money trail", () => {
  beforeEach(() => cy.login());

  it("lists every car with its investment and sale figures", () => {
    cy.visit("/ledger");
    cy.contains("h1", /money trail/i).should("be.visible");
    cy.contains("STK-00001").should("be.visible");
    cy.contains("STK-00002").should("be.visible");
  });

  it("totals bought + spent into total invested", () => {
    cy.visit("/ledger");
    cy.contains("tr", "STK-00001").within(() => {
      cy.get("td").then(($tds) => {
        const cells = $tds.toArray().map((td) => td.innerText.trim());
        const bought = toPaise(cells[1] ?? "");
        const spent = toPaise(cells[3] ?? "");
        const invested = toPaise(cells[4] ?? "");
        expect(invested, `bought ${bought} + spent ${spent} should equal invested`).to.eq(bought + spent);
      });
    });
  });

  it("opens one car's full trail", () => {
    cy.visit("/ledger");
    cy.contains("tr", "STK-00001").contains("a", /Full trail/).click();
    cy.location("pathname").should("match", /\/ledger\/.+/);
    cy.contains(/STK-00001/).should("be.visible");
  });
});
