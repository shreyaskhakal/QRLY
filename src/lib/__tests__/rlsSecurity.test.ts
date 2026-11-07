import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { createClient } from "../supabase/client";
import { createAdminClient } from "../supabase/admin";

describe("RLS & Security Invariants", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("0001_init.sql explicitly revokes all direct operations from the 'anon' role on every table", () => {
    const migrationPath = path.resolve(__dirname, "../../../supabase/migrations/0001_init.sql");
    const migrationSql = readFileSync(migrationPath, "utf-8");

    const requiredTables = [
      "shops",
      "printers",
      "shop_counters",
      "orders",
      "order_files",
      "print_jobs",
      "payment_events",
    ];

    for (const table of requiredTables) {
      // Must enable RLS on table
      expect(migrationSql).toContain(`alter table ${table} enable row level security;`);
      // Must revoke all on table from anon
      expect(migrationSql).toContain(`revoke all on ${table} from anon;`);
    }
  });

  it("createAdminClient requires SUPABASE_SERVICE_ROLE_KEY and prevents empty execution", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";

    expect(() => createAdminClient()).toThrowError(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server environment"
    );
  });

  it("createClient requires NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";

    expect(() => createClient()).toThrowError(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment"
    );
  });
});

