import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default configuration: no R2/KV incremental cache is required because all
// data pages are rendered dynamically against Supabase.
export default defineCloudflareConfig();
