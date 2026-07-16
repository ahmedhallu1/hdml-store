import "server-only";

/**
 * Cloudflare Turnstile server-side verification.
 * In development (or until real keys exist) the official test keys are used:
 *   site  1x00000000000000000000AA  — always passes
 *   secret 1x0000000000000000000000000000000AA — always passes
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

export async function verifyTurnstile(token: string, remoteIp?: string): Promise<boolean> {
  let secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // The always-pass test secret must be an explicit opt-in: silently falling
    // back to it in production would disable bot protection on every endpoint.
    if (process.env.TURNSTILE_ALLOW_TEST_KEYS === "1") {
      secret = TURNSTILE_TEST_SECRET;
    } else {
      console.error(
        "TURNSTILE_SECRET_KEY is not set and TURNSTILE_ALLOW_TEST_KEYS!=1 — failing verification closed.",
      );
      return false;
    }
  }
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("Turnstile verification error:", err);
    return false;
  }
}
