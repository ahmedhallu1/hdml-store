/**
 * One-time Meta connection: exchange a short-lived user token for a long-lived
 * Page token and discover the Page ID + Instagram Business account ID.
 *
 * Run from a script when the owner provides META_APP_ID / META_APP_SECRET /
 * META_USER_TOKEN. The resulting Page token becomes the META_ACCESS_TOKEN
 * Worker secret; the IDs are saved into the social config.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export interface MetaConnection {
  pageId: string;
  pageName: string;
  pageToken: string;
  igUserId: string;
  igUsername: string;
}

async function get(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = `${GRAPH}/${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url);
  const data = (await res.json()) as Record<string, unknown>;
  const err = data.error as { message?: string } | undefined;
  if (!res.ok || err) throw new Error(err?.message ?? `Graph ${res.status}`);
  return data;
}

export async function exchangeAndDiscover(
  appId: string,
  appSecret: string,
  userToken: string,
  pageNameHint?: string,
): Promise<MetaConnection> {
  // 1. Short-lived → long-lived user token.
  const longLived = await get("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: userToken,
  });
  const longUserToken = longLived.access_token as string;

  // 2. Pages this user manages (page tokens here are long-lived).
  const accounts = await get("me/accounts", {
    access_token: longUserToken,
    fields: "id,name,access_token",
  });
  const pages = (accounts.data ?? []) as Array<{ id: string; name: string; access_token: string }>;
  if (pages.length === 0) throw new Error("No Facebook Pages found for this user/token.");
  const page =
    (pageNameHint && pages.find((p) => p.name.toLowerCase().includes(pageNameHint.toLowerCase()))) ||
    pages[0];

  // 3. Linked Instagram Business account.
  let igUserId = "";
  let igUsername = "";
  try {
    const igLink = await get(page.id, {
      access_token: page.access_token,
      fields: "instagram_business_account",
    });
    const iga = igLink.instagram_business_account as { id?: string } | undefined;
    if (iga?.id) {
      igUserId = iga.id;
      const igInfo = await get(iga.id, { access_token: page.access_token, fields: "username" });
      igUsername = (igInfo.username as string) ?? "";
    }
  } catch {
    // IG not linked / not a business account — Facebook still works.
  }

  return {
    pageId: page.id,
    pageName: page.name,
    pageToken: page.access_token,
    igUserId,
    igUsername,
  };
}
