import { z } from "zod";
import { COUNTRY_CODES, isValidPostcode, regionsFor } from "./geo";

const text = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, `${label} is required`).max(max, `${label} is too long`))
    .refine((s) => !/[<>]/.test(s), `${label} contains invalid characters`);

export const customerSchema = z
  .object({
    firstName: text("First name", 50),
    lastName: text("Last name", 50),
    email: z
      .string({ error: "Email is required" })
      .trim()
      .toLowerCase()
      .pipe(z.email("Enter a valid email address").max(255)),
    phone: text("Phone", 25).refine(
      (s) => /^\+?[0-9 ().-]{7,25}$/.test(s) && s.replace(/\D/g, "").length >= 7,
      "Enter a valid phone number",
    ),
    address: text("Address", 60),
    city: text("City", 40),
    state: text("State / region", 40),
    zip: text("ZIP / postal code", 20),
    country: z
      .string({ error: "Country is required" })
      .trim()
      .toUpperCase()
      .refine((c) => COUNTRY_CODES.includes(c), "Select a country"),
  })
  .superRefine((v, ctx) => {
    const regions = regionsFor(v.country);
    if (regions && !(v.state.toUpperCase() in regions)) {
      ctx.addIssue({ code: "custom", path: ["state"], message: "Select a valid state / province" });
    }
    if (!isValidPostcode(v.country, v.zip)) {
      ctx.addIssue({ code: "custom", path: ["zip"], message: "Enter a valid ZIP / postal code" });
    }
  })
  .transform((v) => ({ ...v, state: regionsFor(v.country) ? v.state.toUpperCase() : v.state }));

export type CustomerData = z.infer<typeof customerSchema>;

export const checkoutRequestSchema = z.object({
  item: z.discriminatedUnion("type", [
    z.object({ type: z.literal("offer"), slug: z.string().max(100) }),
    z.object({ type: z.literal("course"), slug: z.string().max(100) }),
    z.object({ type: z.literal("link"), token: z.string().max(1024) }),
  ]),
  customer: customerSchema,
  acceptTerms: z.literal(true, { error: "You must accept the Terms & Conditions and Refund Policy" }),
});

export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const key = i.path.filter((p) => p !== "customer").join(".") || "form";
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
