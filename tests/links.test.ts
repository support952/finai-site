import { describe, expect, it } from "vitest";
import { signLink, verifyLink } from "@/lib/links";

const SECRET = "not-a-real-secret-placeholder-for-unit-tests-only";
const ids = { a: "11111111-1111-4111-8111-111111111111", o: "22222222-2222-4222-8222-222222222222", l: "33333333-3333-4333-8333-333333333333" };

function tamper(token: string, mutate: (p: any) => void) {
  const [body, sig] = token.split(".");
  const p = JSON.parse(Buffer.from(body, "base64url").toString());
  mutate(p);
  return `${Buffer.from(JSON.stringify(p)).toString("base64url")}.${sig}`;
}

describe("affiliate link signing", () => {
  it("round-trips a valid token", () => {
    const t = signLink(ids, SECRET);
    expect(verifyLink(t, SECRET)).toMatchObject({ v: 1, ...ids });
  });

  it("rejects a token signed with another secret", () => {
    const t = signLink(ids, SECRET);
    expect(verifyLink(t, SECRET.replace("a", "b"))).toBeNull();
  });

  it("rejects a changed affiliate id (attribution tamper)", () => {
    const t = tamper(signLink(ids, SECRET), (p) => (p.a = "44444444-4444-4444-8444-444444444444"));
    expect(verifyLink(t, SECRET)).toBeNull();
  });

  it("rejects a changed offer id (price tamper — price comes from the offer)", () => {
    const t = tamper(signLink(ids, SECRET), (p) => (p.o = "55555555-5555-4555-8555-555555555555"));
    expect(verifyLink(t, SECRET)).toBeNull();
  });

  it("rejects an injected price field", () => {
    const t = tamper(signLink(ids, SECRET), (p) => (p.price = 1));
    expect(verifyLink(t, SECRET)).toBeNull();
  });

  it("never contains a price", () => {
    const t = signLink(ids, SECRET);
    const p = JSON.parse(Buffer.from(t.split(".")[0], "base64url").toString());
    expect(Object.keys(p).sort()).toEqual(["a", "iat", "l", "o", "v"]);
  });

  it("rejects malformed tokens", () => {
    for (const t of ["", "abc", "a.b.c", "x".repeat(2000), `${Buffer.from("{}").toString("base64url")}.AAAA`]) {
      expect(verifyLink(t, SECRET)).toBeNull();
    }
  });

  it("rejects a truncated signature", () => {
    const t = signLink(ids, SECRET);
    expect(verifyLink(t.slice(0, -2), SECRET)).toBeNull();
  });

  it("refuses to sign with a short secret", () => {
    expect(() => signLink(ids, "short")).toThrow();
  });
});
