/**
 * Company & site configuration. Values marked PLACEHOLDER must be confirmed.
 */
export const site = {
  name: "FINAI SOLUTIONS",
  legalName: "FINAI SOLUTIONS LLC",
  address: {
    line1: "1409 Rock Quarry Rd",
    city: "Louisa",
    state: "VA",
    zip: "23093",
    country: "United States",
  },
  supportEmail: "support@finaisolutions.co",
  // PLACEHOLDER: must match EXACTLY what appears on the customer's card statement
  // (Authorize.Net / processor "merchant descriptor"). Shown on checkout & receipts.
  cardDescriptor: "FINAI SOLUTIONS",
  // PLACEHOLDER: support phone shown on checkout/receipts (recommended for approval rates).
  supportPhone: "",
  tagline: "[PLACEHOLDER] Practical AI courses for professionals and teams.",
  nav: [
    { href: "/", label: "Home" },
    { href: "/courses/", label: "Courses" },
    { href: "/pricing/", label: "Pricing" },
    { href: "/about/", label: "About" },
    { href: "/contact/", label: "Contact" },
  ],
  policies: [
    { href: "/terms-conditions/", label: "Terms & Conditions" },
    { href: "/privacy-policy/", label: "Privacy Policy" },
    { href: "/refund-policy/", label: "Refund Policy" },
  ],
} as const;

export const companyAddressOneLine = `${site.address.line1}, ${site.address.city}, ${site.address.state} ${site.address.zip}`;
