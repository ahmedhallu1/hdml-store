import "server-only";
import { supabaseService } from "@/lib/supabase/server";
import {
  decryptSecret,
  signApiRequest,
  timingSafeEqual,
  sha256Hex,
} from "@/lib/crypto";
import type { ApiScope } from "@/lib/db-types";
import { privilegesFor, type Tier } from "@/lib/tiers";

/**
 * Merchant API authentication.
 *
 * Every request carries:
 *   X-EIG-Key-Id      public key identifier
 *   X-EIG-Timestamp   unix seconds, must be within MAX_SKEW_SECONDS
 *   X-EIG-Nonce       unique per request, replay-protected via eig.api_nonces
 *   X-EIG-Signature   hex HMAC-SHA256 over
 *                     `${timestamp}\n${METHOD}\n${path}\n${nonce}\n${body}`
 *                     keyed on the merchant's own secret
 *
 * The timestamp bounds replay to a short window; the nonce closes that window
 * entirely. Both are required — a timestamp alone lets an attacker replay a
 * captured request for five minutes.
 */

const MAX_SKEW_SECONDS = 300;

export interface ApiCaller {
  accountId: string;
  keyId: string;
  tier: Tier;
  scopes: ApiScope[];
}

export type AuthFailure =
  | "missing_headers"
  | "unknown_key"
  | "key_revoked"
  | "stale_timestamp"
  | "replayed_nonce"
  | "bad_signature"
  | "account_suspended"
  | "tier_forbidden";

export type AuthResult =
  | { ok: true; caller: ApiCaller }
  | { ok: false; reason: AuthFailure };

export async function authenticate(request: Request, rawBody: string): Promise<AuthResult> {
  const keyId = request.headers.get("x-eig-key-id");
  const timestamp = request.headers.get("x-eig-timestamp");
  const nonce = request.headers.get("x-eig-nonce");
  const signature = request.headers.get("x-eig-signature");

  if (!keyId || !timestamp || !nonce || !signature) return { ok: false, reason: "missing_headers" };

  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(skew) || skew > MAX_SKEW_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const service = supabaseService();
  const { data: key } = await service
    .from("api_keys")
    .select("id, account_id, secret_encrypted, secret_hash, scopes, active, revoked_at")
    .eq("key_id", keyId)
    .maybeSingle();

  if (!key) return { ok: false, reason: "unknown_key" };
  if (!key.active || key.revoked_at) return { ok: false, reason: "key_revoked" };

  const merchantSecret = await decryptSecret(key.secret_encrypted as string);
  if (!merchantSecret) return { ok: false, reason: "unknown_key" };

  // Defence in depth: the decrypted value must still match the stored hash.
  if (!timingSafeEqual(await sha256Hex(merchantSecret), key.secret_hash as string)) {
    return { ok: false, reason: "unknown_key" };
  }

  const url = new URL(request.url);
  const expected = await signApiRequest(
    {
      timestamp,
      method: request.method,
      path: url.pathname,
      nonce,
      body: rawBody,
    },
    merchantSecret,
  );
  if (!timingSafeEqual(expected, signature.toLowerCase())) {
    return { ok: false, reason: "bad_signature" };
  }

  // Nonce insert doubles as the replay check: the primary key rejects a repeat.
  const { error: nonceError } = await service
    .from("api_nonces")
    .insert({ nonce: `${keyId}:${nonce}`, key_id: keyId });
  if (nonceError) return { ok: false, reason: "replayed_nonce" };

  const { data: account } = await service
    .from("accounts")
    .select("user_id, tier, tier_status, suspended")
    .eq("user_id", key.account_id as string)
    .maybeSingle();

  if (!account || account.suspended) return { ok: false, reason: "account_suspended" };

  const tier = account.tier as Tier;
  if (privilegesFor(tier).apiAccess === "none" || account.tier_status !== "active") {
    return { ok: false, reason: "tier_forbidden" };
  }

  // Fire-and-forget: a failed bookkeeping update must not fail the request.
  void service
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id as string)
    .then(undefined, () => {});

  return {
    ok: true,
    caller: {
      accountId: account.user_id as string,
      keyId,
      tier,
      scopes: (key.scopes as ApiScope[]) ?? [],
    },
  };
}

export function hasScope(caller: ApiCaller, scope: ApiScope): boolean {
  // An empty scope list means the key was issued before scoping; treat it as
  // read-only rather than as unrestricted.
  if (caller.scopes.length === 0) return scope.endsWith(":read");
  return caller.scopes.includes(scope);
}

/** Write scopes additionally require the tier to allow full API access. */
export function canWrite(caller: ApiCaller): boolean {
  return privilegesFor(caller.tier).apiAccess === "full";
}

const STATUS: Record<AuthFailure, number> = {
  missing_headers: 401,
  unknown_key: 401,
  key_revoked: 401,
  stale_timestamp: 401,
  replayed_nonce: 409,
  bad_signature: 401,
  account_suspended: 403,
  tier_forbidden: 403,
};

const MESSAGE: Record<AuthFailure, string> = {
  missing_headers:
    "Missing one of X-EIG-Key-Id, X-EIG-Timestamp, X-EIG-Nonce, X-EIG-Signature",
  unknown_key: "Unknown or invalid API key",
  key_revoked: "This API key has been revoked",
  stale_timestamp: `Timestamp outside the ${MAX_SKEW_SECONDS}s window`,
  replayed_nonce: "This nonce has already been used",
  bad_signature: "Signature verification failed",
  account_suspended: "This account is suspended",
  tier_forbidden: "This membership tier does not include API access",
};

export function authErrorResponse(reason: AuthFailure): Response {
  return Response.json(
    { error: { code: reason, message: MESSAGE[reason] } },
    { status: STATUS[reason] },
  );
}

export function apiError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}
