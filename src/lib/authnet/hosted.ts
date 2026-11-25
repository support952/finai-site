/**
 * Pure builder for getHostedPaymentPageRequest (Accept Hosted).
 * Kept free of env/network access so it can be unit tested.
 *
 * Authorize.Net's JSON API is converted to XML server-side, so PROPERTY ORDER
 * MUST FOLLOW THE XSD. Do not reorder keys.
 */
import { mapBillTo, type CustomerInput } from "./billto";

export interface HostedPageInput {
  merchant: { name: string; transactionKey: string };
  refId: string; // <= 20 chars
  amountCents: number;
  invoiceNumber: string; // <= 20 chars
  description: string; // <= 255
  lineItem: { itemId: string; name: string; description: string };
  customer: CustomerInput;
  customerIP?: string; // IPv4 only (Authorize.Net max 15 chars)
  merchantName: string; // shown on the payment form (match card descriptor)
  returnUrl: string;
  cancelUrl: string;
  iframeCommunicatorUrl: string;
}

export function formatAmount(cents: number): string {
  if (!Number.isInteger(cents) || cents <= 0) throw new Error("amount must be a positive integer of cents");
  return (cents / 100).toFixed(2);
}

const cut = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);

export function buildHostedPaymentPageRequest(i: HostedPageInput) {
  const amount = formatAmount(i.amountCents);
  if (i.invoiceNumber.length > 20) throw new Error("invoiceNumber > 20 chars");
  const billTo = mapBillTo(i.customer);
  const email = i.customer.email.trim();
  if (!email) throw new Error("customer email is required");

  const transactionRequest: Record<string, unknown> = {
    transactionType: "authCaptureTransaction",
    amount,
    order: {
      invoiceNumber: i.invoiceNumber,
      description: cut(i.description, 255),
    },
    lineItems: {
      lineItem: [
        {
          itemId: cut(i.lineItem.itemId, 31),
          name: cut(i.lineItem.name, 31),
          description: cut(i.lineItem.description, 255),
          quantity: "1",
          unitPrice: amount,
        },
      ],
    },
    customer: { email: cut(email, 255) },
    billTo,
  };
  if (i.customerIP) transactionRequest.customerIP = i.customerIP;

  const settings: Array<{ settingName: string; settingValue: string }> = [
    {
      settingName: "hostedPaymentReturnOptions",
      settingValue: JSON.stringify({
        showReceipt: false,
        url: i.returnUrl,
        urlText: "Continue",
        cancelUrl: i.cancelUrl,
        cancelUrlText: "Cancel",
      }),
    },
    { settingName: "hostedPaymentButtonOptions", settingValue: JSON.stringify({ text: `Pay $${amount}` }) },
    { settingName: "hostedPaymentStyleOptions", settingValue: JSON.stringify({ bgColor: "#1d4ed8" }) },
    {
      settingName: "hostedPaymentPaymentOptions",
      // CVV is always required. Card only (no eCheck).
      settingValue: JSON.stringify({ cardCodeRequired: true, showCreditCard: true, showBankAccount: false }),
    },
    { settingName: "hostedPaymentSecurityOptions", settingValue: JSON.stringify({ captcha: false }) },
    {
      // Billing address is NOT shown on the hosted form, so the full billTo we
      // send (from the customer's input) is used as-is and can never be
      // overwritten by empty hosted-form fields.
      settingName: "hostedPaymentBillingAddressOptions",
      settingValue: JSON.stringify({ show: false, required: false }),
    },
    { settingName: "hostedPaymentShippingAddressOptions", settingValue: JSON.stringify({ show: false, required: false }) },
    {
      settingName: "hostedPaymentCustomerOptions",
      settingValue: JSON.stringify({ showEmail: false, requiredEmail: false, addPaymentProfile: false }),
    },
    {
      settingName: "hostedPaymentOrderOptions",
      settingValue: JSON.stringify({ show: true, merchantName: cut(i.merchantName, 40) }),
    },
    { settingName: "hostedPaymentIFrameCommunicatorUrl", settingValue: JSON.stringify({ url: i.iframeCommunicatorUrl }) },
  ];

  return {
    getHostedPaymentPageRequest: {
      merchantAuthentication: { name: i.merchant.name, transactionKey: i.merchant.transactionKey },
      refId: i.refId.slice(0, 20),
      transactionRequest,
      hostedPaymentSettings: { setting: settings },
    },
  };
}

/** Normalises an IP for Authorize.Net's customerIP (IPv4 only). */
export function toAnetCustomerIp(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  let v = ip.trim();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(v);
  if (mapped) v = mapped[1];
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v);
  if (!m) return undefined;
  if (m.slice(1).some((o) => Number(o) > 255)) return undefined;
  return v;
}
