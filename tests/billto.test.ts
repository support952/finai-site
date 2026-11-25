import { describe, expect, it } from "vitest";
import { mapBillTo, BILLTO_LIMITS, type CustomerInput } from "@/lib/authnet/billto";
import { buildHostedPaymentPageRequest, toAnetCustomerIp } from "@/lib/authnet/hosted";

// Deliberately unusual values so a hidden default could never coincide with them.
const input: CustomerInput = {
  firstName: "Zoë-Ann",
  lastName: "O'Rourke Smith",
  email: "zoe.ann+test@example.org",
  phone: "+1 (434) 555-0199",
  address: "742 Evergreen Terrace Apt 3B",
  city: "Charlottesville",
  state: "VA",
  zip: "22903-1234",
  country: "us",
};

const base = {
  merchant: { name: "LOGIN", transactionKey: "KEY" },
  refId: "REF1",
  amountCents: 40000,
  invoiceNumber: "FA251125-ABCDEFGH",
  description: "Professional bundle",
  lineItem: { itemId: "professional", name: "Professional bundle", description: "5 courses" },
  customer: input,
  customerIP: "203.0.113.7",
  merchantName: "FINAI SOLUTIONS",
  returnUrl: "https://example.test/r/",
  cancelUrl: "https://example.test/c/",
  iframeCommunicatorUrl: "https://example.test/anet/iframe-communicator.html",
};

describe("billTo mapping", () => {
  it("takes every field from the customer's input", () => {
    expect(mapBillTo(input)).toEqual({
      firstName: input.firstName,
      lastName: input.lastName,
      address: input.address,
      city: input.city,
      state: input.state,
      zip: input.zip,
      country: "US",
      phoneNumber: input.phone,
    });
  });

  it("changes in each input field show up in billTo (no field is hardcoded)", () => {
    const map: Record<string, keyof ReturnType<typeof mapBillTo>> = {
      firstName: "firstName", lastName: "lastName", address: "address", city: "city", state: "state", zip: "zip", country: "country", phone: "phoneNumber",
    };
    for (const [inKey, outKey] of Object.entries(map)) {
      const v = inKey === "country" ? "CA" : `X${inKey}Y`;
      const out = mapBillTo({ ...input, [inKey]: v });
      expect(out[outKey]).toBe(v);
    }
  });

  it.each(["firstName", "lastName", "address", "city", "state", "zip", "country", "phone"] as const)(
    "refuses to send an empty %s instead of defaulting it",
    (field) => {
      expect(() => mapBillTo({ ...input, [field]: "   " })).toThrow(/empty/);
    },
  );

  it("does not invent a company", () => {
    expect(mapBillTo(input)).not.toHaveProperty("company");
  });

  it("only trims/truncates to Authorize.Net limits", () => {
    const long = "A".repeat(100);
    const out = mapBillTo({ ...input, address: `  ${long}  `, city: long });
    expect(out.address).toBe(long.slice(0, BILLTO_LIMITS.address));
    expect(out.city).toBe(long.slice(0, BILLTO_LIMITS.city));
  });

  it("uses XSD element order", () => {
    expect(Object.keys(mapBillTo(input))).toEqual(["firstName", "lastName", "address", "city", "state", "zip", "country", "phoneNumber"]);
  });
});

describe("getHostedPaymentPageRequest", () => {
  const req = buildHostedPaymentPageRequest(base).getHostedPaymentPageRequest;
  const tr = req.transactionRequest as any;
  const settings = Object.fromEntries(req.hostedPaymentSettings.setting.map((s) => [s.settingName, JSON.parse(s.settingValue)]));

  it("is an authCaptureTransaction for the offer amount", () => {
    expect(tr.transactionType).toBe("authCaptureTransaction");
    expect(tr.amount).toBe("400.00");
    expect(tr.lineItems.lineItem[0].unitPrice).toBe("400.00");
  });

  it("carries invoiceNumber, description, line item, email, IP and the full billTo", () => {
    expect(tr.order.invoiceNumber).toBe(base.invoiceNumber);
    expect(tr.order.description).toBe(base.description);
    expect(tr.lineItems.lineItem[0]).toMatchObject({ itemId: "professional", quantity: "1" });
    expect(tr.customer.email).toBe(input.email);
    expect(tr.customerIP).toBe("203.0.113.7");
    expect(tr.billTo).toEqual(mapBillTo(input));
  });

  it("keeps transactionRequest keys in XSD order", () => {
    expect(Object.keys(tr)).toEqual(["transactionType", "amount", "order", "lineItems", "customer", "billTo", "customerIP"]);
  });

  it("hides the hosted billing address so it cannot overwrite billTo with empty values", () => {
    expect(settings.hostedPaymentBillingAddressOptions).toEqual({ show: false, required: false });
  });

  it("requires CVV and offers card only", () => {
    expect(settings.hostedPaymentPaymentOptions).toEqual({ cardCodeRequired: true, showCreditCard: true, showBankAccount: false });
  });

  it("uses the iframe communicator and our merchant name", () => {
    expect(settings.hostedPaymentIFrameCommunicatorUrl.url).toBe(base.iframeCommunicatorUrl);
    expect(settings.hostedPaymentOrderOptions.merchantName).toBe("FINAI SOLUTIONS");
  });

  it("rejects bad amounts and long invoice numbers", () => {
    expect(() => buildHostedPaymentPageRequest({ ...base, amountCents: 0 })).toThrow();
    expect(() => buildHostedPaymentPageRequest({ ...base, amountCents: 1.5 })).toThrow();
    expect(() => buildHostedPaymentPageRequest({ ...base, invoiceNumber: "X".repeat(21) })).toThrow();
  });
});

describe("customerIP normalisation", () => {
  it("accepts IPv4 and IPv4-mapped IPv6", () => {
    expect(toAnetCustomerIp("198.51.100.4")).toBe("198.51.100.4");
    expect(toAnetCustomerIp("::ffff:198.51.100.4")).toBe("198.51.100.4");
  });
  it("drops values Authorize.Net would reject", () => {
    expect(toAnetCustomerIp("2001:db8::1")).toBeUndefined();
    expect(toAnetCustomerIp("999.1.1.1")).toBeUndefined();
    expect(toAnetCustomerIp("")).toBeUndefined();
  });
});
