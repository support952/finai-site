/**
 * Maps validated customer input to Authorize.Net billTo.
 *
 * Rules (tested in tests/billto.test.ts):
 *  - every field comes from the customer's input — no defaults, no placeholders;
 *  - an empty value is an error, never silently replaced;
 *  - values are only trimmed and truncated to Authorize.Net's max lengths;
 *  - property order follows the Authorize.Net XSD (the JSON API is order-sensitive).
 */
export interface CustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string; // ISO 3166-1 alpha-2
}

export interface AnetBillTo {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phoneNumber: string;
}

// Authorize.Net field limits (customerAddressType)
export const BILLTO_LIMITS = {
  firstName: 50,
  lastName: 50,
  address: 60,
  city: 40,
  state: 40,
  zip: 20,
  country: 60,
  phoneNumber: 25,
} as const;

/** Strip characters Authorize.Net rejects in address fields and collapse whitespace. */
function clean(v: string): string {
  return v.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

function take(field: keyof AnetBillTo, value: string | undefined): string {
  const v = clean(value ?? "");
  if (!v) throw new Error(`billTo.${field} is empty — refusing to send a partial billing address`);
  return v.slice(0, BILLTO_LIMITS[field]);
}

export function mapBillTo(c: CustomerInput): AnetBillTo {
  // NOTE: "company" is intentionally omitted (not collected) rather than defaulted.
  return {
    firstName: take("firstName", c.firstName),
    lastName: take("lastName", c.lastName),
    address: take("address", c.address),
    city: take("city", c.city),
    state: take("state", c.state),
    zip: take("zip", c.zip),
    country: take("country", c.country.toUpperCase()),
    phoneNumber: take("phoneNumber", c.phone),
  };
}
