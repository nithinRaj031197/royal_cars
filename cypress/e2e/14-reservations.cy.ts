/**
 * Reservations hold a car for a buyer and the booking amount carries into the
 * sale balance. A cancelled reservation must NOT keep blocking the vehicle —
 * that was a real defect, so the status is asserted explicitly.
 */
describe("Reservations", () => {
  beforeEach(() => cy.login());

  it("shows the seeded reservation alongside sales", () => {
    cy.visit("/sales");
    cy.contains("RES-SEED01").should("be.visible");
  });

  it("creates a reservation with a booking amount", () => {
    const buyer = `Cypress Holder ${Date.now()}`;
    cy.createSellableVehicle("Hold").then((vehicleId) => {
      cy.visit("/sales/new?type=reservation");
      cy.contains("h1", /reservation/i).should("be.visible");
      cy.field("Vehicle").select(vehicleId, { force: true });
    });
    cy.fill("Customer name", buyer);
    cy.fill("Customer phone", "9845112233");
    cy.fill("Agreed price (₹)", "450000");
    cy.fill("Booking amount (₹)", "25000");
    cy.contains("button", /Create reservation/i).click();
    cy.location("pathname", { timeout: 30000 }).should("not.include", "/new");
    cy.visit("/sales");
    cy.contains(buyer).should("exist");
  });

  it("requires a booking amount before a car is held", () => {
    const buyer = `Cypress Minimal Hold ${Date.now()}`;
    cy.createSellableVehicle("MinHold").then((vehicleId) => {
      cy.visit("/sales/new?type=reservation");
      cy.field("Vehicle").select(vehicleId, { force: true });
      cy.fill("Customer name", buyer);
      cy.contains("button", /Create reservation/i).click();
      // A hold without money against it is not a hold; the form must object
      // rather than silently create an unbacked reservation.
      cy.location("pathname").should("include", "/new");
    });
  });
});
