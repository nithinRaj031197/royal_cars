import { describe, it, expect } from "vitest";
import { optionalMoney, optionalMoneyInput, optionalCount, optionalWholeNumber } from "../src/lib/schema";
import { enquiryInputSchema } from "../src/lib/form-schemas";

/**
 * An empty <input type="number"> reaches the server as `null`, not "".
 *
 * The form-contract tests blanked scalars to "" only, so a union of
 * string|number rejected null before any transform could normalise it, and
 * every form carrying an untouched price or count failed with "Invalid input".
 */
describe("optional numeric fields accept null as well as blank", () => {
  const cases: Array<[string, { safeParse: (v: unknown) => { success: boolean } }]> = [
    ["optionalMoney", optionalMoney],
    ["optionalMoneyInput", optionalMoneyInput],
    ["optionalCount", optionalCount(1, 10, "Owners")],
    ["optionalWholeNumber", optionalWholeNumber(1900, 2100, "Year")]
  ];

  cases.forEach(([name, schema]) => {
    it(`${name} treats null, "" and undefined alike`, () => {
      for (const blank of [null, "", "   ", undefined]) {
        const r = schema.safeParse(blank);
        expect(r.success, `${name} rejected ${JSON.stringify(blank)}`).toBe(true);
      }
    });
  });

  it("still rejects a genuinely bad amount", () => {
    expect(optionalMoney.safeParse("not-money").success).toBe(false);
  });

  it("still rejects an out-of-range count", () => {
    expect(optionalCount(1, 5, "Owners").safeParse(99).success).toBe(false);
  });
});

describe("enquiry form payload as the browser actually sends it", () => {
  it("accepts a seller name and model with every untouched field blank or null", () => {
    const asSentByReactHookForm = {
      sellerName: "Cypress Seller",
      sellerPhone: "", sellerAltPhone: "", sellerEmail: "", sellerAddress: "",
      leadSource: "Walk-in",
      make: "", model: "Alto800", variant: "",
      fuel: "Petrol", transmission: "Manual", bodyType: "", colour: "",
      ownershipCount: 1,
      registrationNumber: "", vin: "", engineNumber: "", registrationLocation: "",
      expectedPrice: null,
      inspectionAppointmentAt: "", followUpDate: "", negotiationNotes: ""
    };
    const r = enquiryInputSchema.safeParse(asSentByReactHookForm);
    expect(r.success ? "" : JSON.stringify(r.error.issues)).toBe("");
    expect(r.success).toBe(true);
  });

  it("still requires something identifying the seller and the car", () => {
    expect(enquiryInputSchema.safeParse({ sellerAddress: "only an address" }).success).toBe(false);
  });
});
