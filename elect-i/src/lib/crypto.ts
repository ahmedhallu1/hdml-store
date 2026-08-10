import "server-only";

/**
 * HMAC helpers built on WebCrypto so they run unchanged on the Cloudflare
 * Workers runtime (no Node `crypto` module).
 *
 * Two independent secrets:
 *   EIG_SIGNING_SECRET — merchant API request signatures
 *   EIG_CLAIM_SECRET   — claim tokens and order item digests
 * They are separate so leaking one never compromises the other.
 */

function secret(name: "EIG_SIGNING_SECRET" | "EIG_CLAIM_SECRET"): string {
  const v = process.env[name];
  if (!v || v.length < 32) {
    throw new Error(`${name} is missing or too short (need >= 32 chars)`);
  }
  return v;
}

const encoder = new TextEncoder();

async function hmacKey(key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacHex(message: string, key: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(key), encoder.encode(message));
  return toHex(signature);
}

export async function sha256Hex(message: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(message)));
}

/**
 * Constant-time string comparison. Plain `===` on a signature leaks its
 * prefix through timing; every signature check must use this.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface ApiSignatureParts {
  timestamp: string;
  method: string;
  path: string;
  body: string;
  nonce: string;
}

/** The exact string both sides HMAC. Documented verbatim on /developers. */
export function canonicalRequest(parts: ApiSignatureParts): string {
  return [
    parts.timestamp,
    parts.method.toUpperCase(),
    parts.path,
    parts.nonce,
    parts.body,
  ].join("\n");
}

/**
 * Sign a merchant API request with THAT MERCHANT'S secret — not a global one,
 * so one merchant's key can never be used to forge another's requests.
 */
export async function signApiRequest(
  parts: ApiSignatureParts,
  merchantSecret: string,
): Promise<string> {
  return hmacHex(canonicalRequest(parts), merchantSecret);
}

/** Sign an outbound webhook body with the endpoint's own secret. */
export async function signWebhook(body: string, endpointSecret: string): Promise<string> {
  return hmacHex(body, endpointSecret);
}

export interface DigestItem {
  sku: string | null;
  name: string;
  qty: number;
  /** Integer cents, in `currency`. */
  unitPriceCents: number;
  /**
   * Currency of `unitPriceCents`. Sealed into the digest because the claim
   * page renders the amount with it — an unsealed currency could be swapped to
   * change what the buyer reads while the digest still matched.
   */
  currency?: string | null;
}

/**
 * Canonical digest over an order's line items.
 *
 * The claim page renders a "matches your original order" panel; that claim is
 * only meaningful if BOTH systems digest the SAME data. That data is the
 * upstream snapshot (name, qty, unit price as the upstream system sent them) —
 * never ELECT-I's repriced catalog lines, which carry the merchant's tier
 * price and would therefore differ from the buyer's price on every catalog
 * order. Normalisation is sorted, lower-cased and whitespace-collapsed so
 * incidental formatting cannot break the comparison.
 */
export async function itemsDigest(items: DigestItem[], externalRef: string): Promise<string> {
  const normalised = items
    .map((i) => {
      const sku = (i.sku ?? "").trim().toUpperCase();
      const name = i.name.trim().toLowerCase().replace(/\s+/g, " ");
      // USD is the platform currency, so an omitted currency and an explicit
      // "USD" must digest identically.
      const currency = (i.currency ?? "USD").trim().toUpperCase();
      return `${sku}|${name}|${i.qty}|${i.unitPriceCents}|${currency}`;
    })
    .sort()
    .join("\n");
  return hmacHex(`${externalRef.trim().toUpperCase()}\n${normalised}`, secret("EIG_CLAIM_SECRET"));
}

/**
 * Claim tokens are 32 random bytes rendered base64url. The token IS the
 * secret for the claim page (the recipient has no account), so it is
 * generated with the CSPRNG and never derived from order data.
 */
export function generateClaimToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * AES-GCM encryption for API key secrets at rest.
 *
 * Request signatures are HMACs keyed on the merchant's own secret, so the
 * server must be able to recover it — a one-way hash alone cannot verify a
 * signature. The key-encryption key is derived from EIG_SIGNING_SECRET, which
 * lives only in Worker secrets, never in the database.
 */
async function encryptionKey(): Promise<CryptoKey> {
  const material = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`kek:${secret("EIG_SIGNING_SECRET")}`),
  );
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Backed by an explicit ArrayBuffer: WebCrypto's BufferSource rejects the
 * SharedArrayBuffer-compatible view type that Uint8Array.from infers.
 */
function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Returns "<iv>.<ciphertext>", both base64. */
export async function encryptSecret(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    encoder.encode(plaintext),
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(payload: string): Promise<string | null> {
  const [ivPart, dataPart] = payload.split(".");
  if (!ivPart || !dataPart) return null;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(ivPart) },
      await encryptionKey(),
      fromBase64(dataPart),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    // Wrong key or tampered ciphertext — indistinguishable, and both are fatal.
    return null;
  }
}

/** Random API key id / secret pair for a merchant. */
export function generateApiCredentials(): { keyId: string; secret: string } {
  const rand = (n: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(n)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  return { keyId: `eig_live_${rand(8)}`, secret: `sk_${rand(24)}` };
}
