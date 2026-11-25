/**
 * Starts a throwaway PostgreSQL cluster for RLS tests (or uses TEST_DATABASE_URL),
 * applies the Supabase stub + real migrations + seed, and returns a pg Pool.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, existsSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { Pool } from "pg";

const ROOT = path.resolve(__dirname, "../..");

function findPgBin(): string {
  const base = "/usr/lib/postgresql";
  if (process.env.PG_BIN) return process.env.PG_BIN;
  if (existsSync(base)) {
    const versions = readdirSync(base).sort((a, b) => Number(b) - Number(a));
    for (const v of versions) if (existsSync(path.join(base, v, "bin", "initdb"))) return path.join(base, v, "bin");
  }
  try {
    return execFileSync("pg_config", ["--bindir"]).toString().trim();
  } catch {
    throw new Error("PostgreSQL server binaries not found. Install PostgreSQL or set TEST_DATABASE_URL.");
  }
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

export interface TestDb {
  pool: Pool;
  stop: () => Promise<void>;
}

export async function startTestDb(): Promise<TestDb> {
  let url = process.env.TEST_DATABASE_URL;
  let proc: ChildProcess | undefined;
  let dataDir: string | undefined;

  if (!url) {
    const bin = findPgBin();
    dataDir = mkdtempSync(path.join(tmpdir(), "finai-pg-"));
    chmodSync(dataDir, 0o777);
    const isRoot = process.getuid?.() === 0;
    const asUser = (cmd: string, args: string[]) =>
      isRoot ? { cmd: "runuser", args: ["-u", "nobody", "--", cmd, ...args] } : { cmd, args };
    const pgdata = path.join(dataDir, "data");
    const init = asUser(path.join(bin, "initdb"), ["-D", pgdata, "-A", "trust", "-U", "postgres", "--no-sync"]);
    execFileSync(init.cmd, init.args, { stdio: "ignore" });
    const port = await freePort();
    const run = asUser(path.join(bin, "postgres"), ["-D", pgdata, "-p", String(port), "-k", dataDir, "-c", "listen_addresses=127.0.0.1", "-c", "fsync=off"]);
    proc = spawn(run.cmd, run.args, { stdio: "ignore" });
    url = `postgres://postgres@127.0.0.1:${port}/postgres`;
    // wait for readiness
    const deadline = Date.now() + 20_000;
    for (;;) {
      try {
        const p = new Pool({ connectionString: url, max: 1 });
        await p.query("select 1");
        await p.end();
        break;
      } catch {
        if (Date.now() > deadline) throw new Error("Test Postgres did not start");
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }

  const pool = new Pool({ connectionString: url, max: 4 });
  await pool.query(readFileSync(path.join(ROOT, "tests/db/supabase-stub.sql"), "utf8"));
  const migDir = path.join(ROOT, "supabase/migrations");
  for (const f of readdirSync(migDir).sort()) {
    if (f.includes("storage")) continue; // storage schema is Supabase-only
    await pool.query(readFileSync(path.join(migDir, f), "utf8"));
  }
  await pool.query(readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8"));
  await pool.query("grant all on all tables in schema public to service_role");

  return {
    pool,
    stop: async () => {
      await pool.end();
      if (proc) {
        proc.kill("SIGINT");
        await new Promise((r) => setTimeout(r, 300));
      }
      if (dataDir) rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/** Run `fn` inside a transaction as the given Supabase role / user (RLS applies). */
export async function asUser<T>(
  pool: Pool,
  userId: string | null,
  fn: (q: (sql: string, params?: unknown[]) => Promise<any[]>) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${userId ? "authenticated" : "anon"}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      userId ? JSON.stringify({ sub: userId, role: "authenticated" }) : "",
    ]);
    const res = await fn(async (sql, params) => (await client.query(sql, params as any[])).rows);
    await client.query("rollback");
    return res;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
