import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No R2/KV incremental cache: every data page renders dynamically against
// Supabase, matching the HDML store's deployment shape.
export default defineCloudflareConfig();
