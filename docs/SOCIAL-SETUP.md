# HDML Social Auto-Poster — Meta Setup (your one-time part)

This is the **only** manual part — everything else (the posting tool, queue,
review emails, scheduling) I build and run. Meta requires the account owner to
create the app and generate the access token; I can't log in as you. It takes
~15 minutes, once.

**Prerequisites (you confirmed you have these):**
- A **Facebook Page** for HDML (not a personal profile).
- An **Instagram Business/Creator** account, **linked to that Page**
  (Instagram app → Settings → *Account type and tools* → switch to Business →
  then link your Facebook Page).

---

## Step 1 — Create a Meta app  ⏱️ 3 min
1. Go to **https://developers.facebook.com/apps** → **Create app**.
2. Use case: choose **Other** → app type **Business** → next.
3. Name it `HDML Social` → create (it may ask for your password).
4. In the app dashboard, note the **App ID** and — under **App settings →
   Basic** — the **App secret** (click Show).

## Step 2 — Add Instagram + permissions  ⏱️ 3 min
1. In the app, **Add product** → **Instagram** → *Set up*.
2. That's enough — we generate the token in the next step.

## Step 3 — Generate an access token  ⏱️ 5 min
1. Open the **Graph API Explorer**:
   **https://developers.facebook.com/tools/explorer**
2. Top-right **Meta App** dropdown → select **HDML Social**.
3. Click **Add a Permission / Permissions** and tick all of these:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `business_management`
   - `instagram_basic`
   - `instagram_content_publish`
4. Click **Generate Access Token** → approve the popup (choose your HDML Page
   and Instagram when asked, and **Allow** everything).
5. Copy the long token string that appears in the **Access Token** box.

> This token is short-lived (about an hour), so do Step 4 soon after — I'll
> immediately swap it for a long-lived one that keeps working.

## Step 4 — Send me three things
Put these into `.env.local` (or just send them to me and I'll place them —
they're not as sensitive as the store's master keys, but treat the token with
care):

```
META_APP_ID=<your App ID from Step 1>
META_APP_SECRET=<your App secret from Step 1>
META_USER_TOKEN=<the token you copied in Step 3>
```

Then tell me **"meta ready"**. I will:
- Exchange your token for a **long-lived Page token** (doesn't expire the way
  the short one does),
- Auto-detect your **Facebook Page ID** and **Instagram account ID**,
- Store the token as a Worker secret and switch the auto-poster **on**,
- Post a **test** to your Page + Instagram and confirm it worked.

---

### Why no "App Review"?
Meta only requires its lengthy App Review when an app posts to *other people's*
accounts. Because we only ever post to **your own** Page and Instagram (you're
the app admin), the app can stay in development mode and works immediately — no
review, no wait.

### If a token ever stops working
Repeat Step 3 (generate a fresh token) and send me the new `META_USER_TOKEN` —
I'll re-exchange it. (Long-lived Page tokens normally keep working unless you
change your Facebook password or remove the app.)
