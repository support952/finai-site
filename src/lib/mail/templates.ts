import { site, companyAddressOneLine } from "@/config/site";
import { usd } from "@/lib/money";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;padding:24px">
<h2 style="margin:0 0 16px">${esc(title)}</h2>${bodyHtml}
<hr style="margin:32px 0;border:none;border-top:1px solid #ddd">
<p style="font-size:12px;color:#666">${esc(site.legalName)} · ${esc(companyAddressOneLine)} · ${esc(site.supportEmail)}<br>
Charges appear on your statement as <strong>${esc(site.cardDescriptor)}</strong>.</p></body></html>`;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  itemName: string;
  courses: string[];
  amountCents: number;
  cardLast4?: string | null;
  transId: string;
  billTo: { firstName: string; lastName: string; address: string; city: string; state: string; zip: string; country: string };
  email: string;
}

export function invoiceEmail(d: InvoiceData) {
  const addr = `${d.billTo.firstName} ${d.billTo.lastName}\n${d.billTo.address}\n${d.billTo.city}, ${d.billTo.state} ${d.billTo.zip}\n${d.billTo.country}`;
  const text = `Invoice ${d.invoiceNumber}
Date: ${d.date.toISOString().slice(0, 10)}
Seller: ${site.legalName}, ${companyAddressOneLine}

Bill to:
${addr}

Item: ${d.itemName} — ${usd(d.amountCents)}
Includes: ${d.courses.join(", ")}

Total paid: ${usd(d.amountCents)} USD${d.cardLast4 ? ` (card ending ${d.cardLast4})` : ""}
Transaction ID: ${d.transId}
Statement descriptor: ${site.cardDescriptor}

Refund policy: ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/refund-policy/
Questions: ${site.supportEmail}`;
  const html = layout(
    `Invoice ${d.invoiceNumber}`,
    `<p>Date: ${d.date.toISOString().slice(0, 10)}<br>Seller: ${esc(site.legalName)}, ${esc(companyAddressOneLine)}</p>
<p><strong>Bill to</strong><br>${esc(addr).replace(/\n/g, "<br>")}</p>
<table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(d.itemName)}<br>
<span style="font-size:12px;color:#555">Includes: ${esc(d.courses.join(", "))}</span></td>
<td style="text-align:right;border-bottom:1px solid #eee">${usd(d.amountCents)}</td></tr>
<tr><td style="padding:8px 0"><strong>Total paid (USD)</strong></td><td style="text-align:right"><strong>${usd(d.amountCents)}</strong></td></tr></table>
<p>${d.cardLast4 ? `Card ending ${esc(d.cardLast4)} · ` : ""}Transaction ID ${esc(d.transId)}</p>`,
  );
  return { to: d.email, subject: `Your ${site.name} invoice ${d.invoiceNumber}`, text, html };
}

export function welcomeEmail(email: string, firstName: string, loginUrl: string, courses: string[]) {
  const text = `Hi ${firstName},

Thank you for your purchase. Your courses are ready:
${courses.map((c) => `- ${c}`).join("\n")}

Sign in (link valid for a limited time): ${loginUrl}

You can always request a new sign-in link at ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/my-account/login/

${site.legalName} · ${site.supportEmail}`;
  const html = layout(
    `Welcome, ${firstName}`,
    `<p>Thank you for your purchase. Your courses are ready:</p><ul>${courses.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
<p><a href="${esc(loginUrl)}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Open my courses</a></p>
<p style="font-size:13px;color:#555">This sign-in link expires. You can request a new one any time from the My Account page.</p>`,
  );
  return { to: email, subject: `Your ${site.name} courses are ready`, text, html };
}

export function loginLinkEmail(email: string, url: string) {
  return {
    to: email,
    subject: `Your ${site.name} sign-in link`,
    text: `Use this link to sign in: ${url}\n\nIf you didn't request it, ignore this email.`,
    html: layout("Sign in", `<p><a href="${esc(url)}">Click here to sign in</a>.</p><p style="font-size:13px;color:#555">If you didn't request this, you can ignore this email.</p>`),
  };
}

export function affiliateInviteEmail(email: string, name: string, url: string) {
  return {
    to: email,
    subject: `Your ${site.name} partner account`,
    text: `Hi ${name},\n\nA partner account has been created for you. Set your password here: ${url}\n\nThen sign in at ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/partners/login/`,
    html: layout("Partner account", `<p>Hi ${esc(name)},</p><p>A partner account has been created for you.</p><p><a href="${esc(url)}">Set your password</a></p>`),
  };
}
