/**
 * Row Level Security tests against a real PostgreSQL with the production
 * migrations. Proves affiliates (and customers / anonymous users) can only
 * read their own data — enforced by the database, not the UI.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, asUser, type TestDb } from "./db/pg-harness";

let db: TestDb;
const U = {
  affA: "aaaaaaaa-0000-4000-8000-000000000001",
  affB: "bbbbbbbb-0000-4000-8000-000000000002",
  cust: "cccccccc-0000-4000-8000-000000000003",
  cust2: "cccccccc-0000-4000-8000-000000000004",
  admin: "dddddddd-0000-4000-8000-000000000005",
};
const ids: Record<string, string> = {};

beforeAll(async () => {
  db = await startTestDb();
  const q = (s: string, p?: unknown[]) => db.pool.query(s, p as any[]).then((r) => r.rows);

  for (const [k, id] of Object.entries(U)) await q("insert into auth.users (id, email) values ($1, $2)", [id, `${k}@test.local`]);
  await q("update profiles set role = 'affiliate' where id in ($1, $2)", [U.affA, U.affB]);
  await q("update profiles set role = 'admin' where id = $1", [U.admin]);

  ids.affA = (await q("insert into affiliates (user_id, name, email) values ($1, 'Aff A', 'affA@test.local') returning id", [U.affA]))[0].id;
  ids.affB = (await q("insert into affiliates (user_id, name, email) values ($1, 'Aff B', 'affB@test.local') returning id", [U.affB]))[0].id;

  ids.starter = (await q("select id from offers where slug = 'starter'"))[0].id;
  ids.secretA = (await q("insert into offers (slug, name, price_cents, visibility) values ('secret-a', 'Secret A', 9900, 'affiliate_only') returning id"))[0].id;
  ids.secretB = (await q("insert into offers (slug, name, price_cents, visibility) values ('secret-b', 'Secret B', 8800, 'affiliate_only') returning id"))[0].id;
  const course = (await q("select id from courses order by sort_order limit 1"))[0].id;
  ids.course = course;
  ids.course2 = (await q("select id from courses order by sort_order offset 5 limit 1"))[0].id;
  await q("insert into offer_courses (offer_id, course_id) values ($1, $3), ($2, $3)", [ids.secretA, ids.secretB, course]);

  await q("insert into affiliate_offers values ($1, $2), ($1, $3), ($4, $5)", [ids.affA, ids.starter, ids.secretA, ids.affB, ids.secretB]);
  ids.linkA = (await q("insert into payment_links (affiliate_id, offer_id, url) values ($1, $2, 'https://x/pay/a/') returning id", [ids.affA, ids.secretA]))[0].id;
  ids.linkB = (await q("insert into payment_links (affiliate_id, offer_id, url) values ($1, $2, 'https://x/pay/b/') returning id", [ids.affB, ids.secretB]))[0].id;

  const mkOrder = async (inv: string, offer: string, aff: string | null, user: string | null, email: string) =>
    (await q(
      `insert into orders (invoice_number, offer_id, item_name, amount_cents, affiliate_id, user_id, status,
         first_name, last_name, email, phone, address, city, state, zip, country, customer_ip)
       values ($1, $2, 'Item', 9900, $3, $4, 'approved', 'F', 'L', $5, '+15550100', '1 Main', 'Town', 'VA', '23093', 'US', '203.0.113.9') returning id`,
      [inv, offer, aff, user, email],
    ))[0].id;
  ids.orderA = await mkOrder("INV-A", ids.secretA, ids.affA, U.cust, "buyer.a@test.local");
  ids.orderB = await mkOrder("INV-B", ids.secretB, ids.affB, U.cust2, "buyer.b@test.local");
  ids.orderDirect = await mkOrder("INV-D", ids.starter, null, U.cust, "cust@test.local");

  for (const [o, a, inv] of [[ids.orderA, ids.affA, "A"], [ids.orderB, ids.affB, "B"]]) {
    await q("insert into transactions (order_id, trans_id, response_code, avs_result_code, card_last4, bill_to) values ($1, $2, 1, 'Y', '1111', '{}')", [o, `T-${inv}`]);
    await q(
      `insert into affiliate_sales (order_id, affiliate_id, offer_name, amount_cents, status, card_last4, customer_email, customer_phone, created_at)
       values ($1, $2, 'Secret', 9900, 'approved', '1111', $3, '+15550100', now())`,
      [o, a, `buyer.${inv.toLowerCase()}@test.local`],
    );
  }
  await q("insert into course_access (user_id, course_id, order_id) values ($1, $2, $3)", [U.cust, course, ids.orderA]);
  await q("insert into course_access (user_id, course_id, order_id) values ($1, $2, $3)", [U.cust2, ids.course2, ids.orderB]);
  await q("insert into course_files (course_id, storage_path, file_name) values ($1, 'c1/file.pdf', 'file.pdf'), ($2, 'c2/file.pdf', 'other.pdf')", [course, ids.course2]);
  await q("insert into card_blocks (card_last4, email) values ('1111', 'buyer.a@test.local')");
  await q("insert into decline_attempts (card_last4, email, trans_id) values ('1111', 'buyer.a@test.local', 'D1')");
  await q("insert into webhook_events (notification_id, event_type, payload) values ('N1', 'x', '{}')");
}, 90_000);

afterAll(async () => {
  await db?.stop();
});

describe("affiliate isolation", () => {
  it("affiliate A sees only their own sales", async () => {
    const rows = await asUser(db.pool, U.affA, (q) => q("select order_id, affiliate_id from affiliate_sales"));
    expect(rows).toHaveLength(1);
    expect(rows[0].affiliate_id).toBe(ids.affA);
  });

  it("affiliate A cannot read affiliate B's sales even when asking for them explicitly", async () => {
    const rows = await asUser(db.pool, U.affA, (q) => q("select * from affiliate_sales where affiliate_id = $1 or order_id = $2", [ids.affB, ids.orderB]));
    expect(rows).toHaveLength(0);
  });

  it("affiliate B sees only B's sales (symmetry)", async () => {
    const rows = await asUser(db.pool, U.affB, (q) => q("select affiliate_id from affiliate_sales"));
    expect(rows.map((r) => r.affiliate_id)).toEqual([ids.affB]);
  });

  it("affiliate A only sees their own payment links, affiliate record and offer assignments", async () => {
    await asUser(db.pool, U.affA, async (q) => {
      expect((await q("select id from payment_links")).map((r) => r.id)).toEqual([ids.linkA]);
      expect((await q("select id from affiliates")).map((r) => r.id)).toEqual([ids.affA]);
      const ao = await q("select affiliate_id from affiliate_offers");
      expect(ao.length).toBe(2);
      expect(ao.every((r) => r.affiliate_id === ids.affA)).toBe(true);
    });
  });

  it("affiliate A sees their own affiliate-only offer but not B's", async () => {
    const slugs = await asUser(db.pool, U.affA, (q) => q("select slug from offers where visibility = 'affiliate_only'"));
    expect(slugs.map((r) => r.slug)).toEqual(["secret-a"]);
  });

  it("affiliates cannot read orders, transactions, blocks, declines or webhook events at all", async () => {
    await asUser(db.pool, U.affA, async (q) => {
      for (const t of ["orders", "transactions", "card_blocks", "decline_attempts", "webhook_events", "course_access"]) {
        expect(await q(`select * from ${t}`), t).toHaveLength(0);
      }
    });
  });

  it("affiliates cannot modify or create sales / links / attribution", async () => {
    await asUser(db.pool, U.affA, async (q) => {
      expect(await q("update affiliate_sales set amount_cents = 1 where true returning order_id")).toHaveLength(0);
      expect(await q("update payment_links set affiliate_id = $1 where true returning id", [ids.affA])).toHaveLength(0);
      expect(await q("delete from affiliate_sales where true returning order_id")).toHaveLength(0);
    });
    await expect(
      asUser(db.pool, U.affA, (q) =>
        q("insert into payment_links (affiliate_id, offer_id, url) values ($1, $2, 'x')", [ids.affA, ids.secretB]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("affiliates cannot grant themselves admin or re-enable themselves", async () => {
    await asUser(db.pool, U.affA, async (q) => {
      expect(await q("update profiles set role = 'admin' where id = $1 returning id", [U.affA])).toHaveLength(0);
      expect(await q("update affiliates set is_active = true where true returning id")).toHaveLength(0);
    });
  });

  it("affiliates cannot call admin reports", async () => {
    await expect(asUser(db.pool, U.affA, (q) => q("select * from admin_revenue_by_affiliate(now() - interval '1 year', now())"))).rejects.toThrow(/forbidden/);
  });

  it("a disabled affiliate loses access to everything", async () => {
    await db.pool.query("update affiliates set is_active = false where id = $1", [ids.affA]);
    try {
      await asUser(db.pool, U.affA, async (q) => {
        expect(await q("select * from affiliate_sales")).toHaveLength(0);
        expect(await q("select * from payment_links")).toHaveLength(0);
      });
    } finally {
      await db.pool.query("update affiliates set is_active = true where id = $1", [ids.affA]);
    }
  });
});

describe("customer isolation", () => {
  it("customers see only their own orders", async () => {
    const rows = await asUser(db.pool, U.cust, (q) => q("select id from orders order by invoice_number"));
    expect(rows.map((r) => r.id).sort()).toEqual([ids.orderA, ids.orderDirect].sort());
    expect(await asUser(db.pool, U.cust, (q) => q("select id from orders where id = $1", [ids.orderB]))).toHaveLength(0);
  });

  it("customers see only files of courses they own, and lose them on revocation", async () => {
    expect((await asUser(db.pool, U.cust, (q) => q("select file_name from course_files"))).map((r) => r.file_name)).toEqual(["file.pdf"]);
    expect((await asUser(db.pool, U.cust2, (q) => q("select file_name from course_files"))).map((r) => r.file_name)).toEqual(["other.pdf"]);
    await db.pool.query("update course_access set revoked_at = now() where user_id = $1", [U.cust]);
    try {
      expect(await asUser(db.pool, U.cust, (q) => q("select * from course_files"))).toHaveLength(0);
      expect(await asUser(db.pool, U.cust, (q) => q("select * from course_access"))).toHaveLength(0);
    } finally {
      await db.pool.query("update course_access set revoked_at = null where user_id = $1", [U.cust]);
    }
  });

  it("customers cannot grant themselves course access or read transactions/affiliate data", async () => {
    await expect(
      asUser(db.pool, U.cust, (q) => q("insert into course_access (user_id, course_id, order_id) values ($1, $2, $3)", [U.cust, ids.course2, ids.orderA])),
    ).rejects.toThrow(/row-level security/);
    await asUser(db.pool, U.cust, async (q) => {
      expect(await q("select * from transactions")).toHaveLength(0);
      expect(await q("select * from affiliate_sales")).toHaveLength(0);
      expect(await q("select * from payment_links")).toHaveLength(0);
    });
  });
});

describe("anonymous visitors", () => {
  it("can read the public catalogue but not affiliate-only offers", async () => {
    await asUser(db.pool, null, async (q) => {
      expect((await q("select count(*)::int as n from courses"))[0].n).toBe(16);
      const slugs = (await q("select slug from offers")).map((r) => r.slug);
      expect(slugs).toContain("starter");
      expect(slugs).not.toContain("secret-a");
      expect(slugs).not.toContain("secret-b");
    });
  });
  it("cannot read any private table", async () => {
    for (const t of ["orders", "transactions", "affiliate_sales", "payment_links", "affiliates", "profiles", "course_files"]) {
      await expect(asUser(db.pool, null, (q) => q(`select * from ${t}`)), t).rejects.toThrow(/permission denied/);
    }
  });
});

describe("admin", () => {
  it("can read everything and run reports", async () => {
    await asUser(db.pool, U.admin, async (q) => {
      expect((await q("select * from affiliate_sales")).length).toBe(2);
      expect((await q("select * from orders")).length).toBe(3);
      const rep = await q("select * from admin_revenue_by_affiliate(now() - interval '1 day', now() + interval '1 day')");
      expect(rep.length).toBe(3); // A, B, direct
    });
  });
});

describe("schema hygiene", () => {
  it("every public table has RLS enabled", async () => {
    const rows = (await db.pool.query("select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity")).rows;
    expect(rows).toEqual([]);
  });
});
