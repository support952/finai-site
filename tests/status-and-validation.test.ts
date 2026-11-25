import { describe, expect, it } from "vitest";
import { mergeStatus, paymentStatus, last4, toCents } from "@/lib/payments/status";
import { customerSchema } from "@/lib/checkout/schema";
import { redact } from "@/lib/log";

describe("order status", () => {
  it("maps Authorize.Net response codes", () => {
    expect(paymentStatus({ responseCode: 1, transactionStatus: "capturedPendingSettlement" })).toBe("approved");
    expect(paymentStatus({ responseCode: 2, transactionStatus: "declined" })).toBe("declined");
    expect(paymentStatus({ responseCode: 3 })).toBe("error");
    expect(paymentStatus({ responseCode: 4 })).toBe("held");
    expect(paymentStatus({ responseCode: 1, transactionStatus: "FDSPendingReview" })).toBe("held");
    expect(paymentStatus({ responseCode: 1, transactionStatus: "voided" })).toBe("voided");
  });
  it("never downgrades an approved order on a later failed retry", () => {
    expect(mergeStatus("approved", "declined")).toBe("approved");
    expect(mergeStatus("declined", "approved")).toBe("approved");
    expect(mergeStatus("approved", "refunded")).toBe("refunded");
    expect(mergeStatus("refunded", "approved")).toBe("refunded");
  });
  it("extracts last4 / cents", () => {
    expect(last4("XXXX1111")).toBe("1111");
    expect(last4(undefined)).toBeNull();
    expect(toCents(400)).toBe(40000);
    expect(toCents(19.99)).toBe(1999);
  });
});

describe("checkout validation (server-side)", () => {
  const ok = { firstName: " Ann ", lastName: "Lee", email: "ANN@Example.com", phone: "+1 434 555 0100", address: "1 Main St", city: "Louisa", state: "va", zip: "23093", country: "US" };
  it("accepts and normalises a valid customer", () => {
    const r = customerSchema.parse(ok);
    expect(r).toMatchObject({ firstName: "Ann", email: "ann@example.com", state: "VA", country: "US" });
  });
  it.each(["firstName", "lastName", "email", "phone", "address", "city", "state", "zip", "country"])("requires %s", (k) => {
    expect(customerSchema.safeParse({ ...ok, [k]: "" }).success).toBe(false);
    const { [k]: _omit, ...rest } = ok as any;
    void _omit;
    expect(customerSchema.safeParse(rest).success).toBe(false);
  });
  it("validates US ZIP and state", () => {
    expect(customerSchema.safeParse({ ...ok, zip: "00000x" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...ok, state: "XX" }).success).toBe(false);
  });
  it("allows free-text regions outside US/CA", () => {
    expect(customerSchema.safeParse({ ...ok, country: "DE", state: "Bayern", zip: "80331" }).success).toBe(true);
  });
});

describe("log redaction", () => {
  it("redacts secrets and card-like numbers", () => {
    expect(redact({ transactionKey: "abc", nested: { signature: "x" }, note: "card 4111111111111111" })).toEqual({
      transactionKey: "[redacted]", nested: { signature: "[redacted]" }, note: "card [redacted-pan]",
    });
  });
});
