import { createClient } from "@supabase/supabase-js";

/**
 * Creates an administrative Supabase client using the privileged service role key.
 *
 * CRITICAL SECURITY RULE:
 * This client bypasses Row Level Security (RLS).
 * It MUST NEVER be imported into client components or leaked to the browser.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server environment"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

