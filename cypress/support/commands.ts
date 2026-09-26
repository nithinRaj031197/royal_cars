/// <reference types="cypress" />

export const DEMO_OWNER = { email: "owner@royalcars.demo", password: "Showroom-Demo-2026" };

declare global {
  // Cypress augments its Chainable interface through this namespace; there is
  // no module-syntax equivalent for it.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Signs in through the real login form. Cached across specs via cy.session. */
      login(email?: string, password?: string): Chainable<void>;
      /** Signs in as any role using the demo provider (demo mode only). */
      loginAs(role: "owner" | "sales" | "operations" | "accounts"): Chainable<void>;
      /** The form control associated with a visible <label>, resolved via its `for`. */
      field(label: string | RegExp): Chainable<JQuery<HTMLElement>>;
      /** Types into the control for a label, clearing first. Tolerates selects. */
      fill(label: string | RegExp, value: string): Chainable<void>;
      /** Submits the primary form and waits for navigation away or an error. */
      submitForm(): Chainable<void>;
      /**
       * Buys a car through the real acquisition API and returns its vehicle id.
       *
       * The demo dataset holds a single sellable car, so any spec that reserves
       * or sells it starves the ones that follow. Each spec that consumes a
       * vehicle makes its own instead.
       */
      createSellableVehicle(label?: string): Chainable<string>;
    }
  }
}

function sessionLogin(email: string, password: string) {
  cy.visit("/login");
  cy.get('input[type="email"]').should("be.visible").clear().type(email);
  cy.get('input[type="password"]').clear().type(password, { log: false });
  cy.get('button[type="submit"]').click();
  cy.location("pathname", { timeout: 30000 }).should("not.include", "/login");
}

Cypress.Commands.add("login", (email = DEMO_OWNER.email, password = DEMO_OWNER.password) => {
  cy.session(
    ["password", email],
    () => sessionLogin(email, password),
    {
      validate() {
        cy.request("/api/auth/session").its("body.user.email").should("eq", email);
      },
      cacheAcrossSpecs: true
    }
  );
});

/**
 * Demo-provider sign-in. The password provider only admits owners
 * (LOGIN_ENABLED_ROLES), so role-permission tests need this path.
 */
Cypress.Commands.add("loginAs", (role) => {
  const email = `${role}@royalcars.demo`;
  cy.session(
    ["demo", role],
    () => {
      cy.request("/api/auth/csrf").then((res) => {
        cy.request({
          method: "POST",
          url: "/api/auth/callback/demo",
          form: true,
          body: { csrfToken: res.body.csrfToken, email, role, json: "true" }
        });
      });
    },
    {
      validate() {
        cy.request("/api/auth/session").its("body.user.role").should("eq", role);
      },
      cacheAcrossSpecs: true
    }
  );
});

Cypress.Commands.add("field", (label: string | RegExp) => {
  return cy
    .contains("label", label)
    .should("exist")
    .first()
    .invoke("attr", "for")
    .then((id) => {
      if (!id) throw new Error(`Label ${label} has no "for" attribute`);
      // Generated ids contain characters that break CSS selectors; use an
      // attribute match rather than "#id".
      return cy.get(`[id="${id}"]`);
    });
});

Cypress.Commands.add("fill", (label: string | RegExp, value: string) => {
  cy.field(label).then(($el) => {
    const tag = $el.prop("tagName");
    if (tag === "SELECT") {
      cy.wrap($el).select(value, { force: true });
    } else {
      cy.wrap($el).clear({ force: true }).type(value, { force: true });
    }
  });
});

/**
 * Most create screens render the primary action as `<button class="btn-primary">`
 * with no `type`, and four of them have no <form> element at all, so there is no
 * `button[type=submit]` to target. Match the styled primary action instead.
 */
Cypress.Commands.add("submitForm", () => {
  cy.get('button.btn-primary, button[type="submit"]').filter(":visible").last().click();
});


Cypress.Commands.add("createSellableVehicle", (label = "Cypress") => {
  const stamp = `${label}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return cy
    .request("POST", "/api/acquisitions", { sellerName: `${stamp} Seller`, model: stamp })
    .then((created) => {
      const caseId = created.body.caseRow.id as string;
      const vehicleId = created.body.vehicle.id as string;
      return cy
        .request("POST", `/api/acquisitions/${caseId}`, { action: "approve", agreedPrice: "400000" })
        .then(() =>
          cy.request("POST", `/api/acquisitions/${caseId}`, {
            action: "acquire",
            purchasePrice: "400000",
            purchaseDate: new Date().toISOString().slice(0, 10)
          })
        )
        .then(() => vehicleId);
    });
});
