import "server-only";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends an email via the Mailgun HTTP API. Returns false (and logs) on failure. */
export async function sendMail(m: Mail): Promise<boolean> {
  const form = new FormData();
  form.set("from", env.mailFrom());
  form.set("to", m.to);
  form.set("subject", m.subject);
  form.set("text", m.text);
  form.set("html", m.html);
  try {
    const res = await fetch(`${env.mailgunApiBase()}/v3/${encodeURIComponent(env.mailgunDomain())}/messages`, {
      method: "POST",
      headers: { authorization: "Basic " + Buffer.from(`api:${env.mailgunApiKey()}`).toString("base64") },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      log.error("mailgun send failed", { status: res.status, subject: m.subject });
      return false;
    }
    return true;
  } catch (e) {
    log.error("mailgun send error", { error: (e as Error).message, subject: m.subject });
    return false;
  }
}
