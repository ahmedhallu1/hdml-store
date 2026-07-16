import { expect, test } from "@playwright/test";

/**
 * Full order lifecycle: register → cart → checkout → payment instructions →
 * proof upload → (admin approval is exercised via the admin UI when
 * E2E_ADMIN_EMAIL/PASSWORD are provided).
 *
 * DESTRUCTIVE-ish (creates a user + order) — only runs with E2E_FULL=1 against
 * a development database.
 */
test.skip(process.env.E2E_FULL !== "1", "Set E2E_FULL=1 to run the full order flow");

const uniq = Date.now();
const EMAIL = `e2e-buyer-${uniq}@example.com`;
const PASSWORD = "e2e-password-123";

test("register → order → upload proof", async ({ page }) => {
  // Register
  await page.goto("/register");
  await page.getByLabel(/full name/i).fill("E2E Buyer");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/phone/i).fill("01012345678");
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /create|register|sign up/i }).click();
  await page.waitForURL(/\/(account|$)/, { timeout: 20000 });

  // Add enough value to pass the EGP 1,000 minimum
  await page.goto("/catalog?sort=price_desc");
  await page.getByRole("main").getByRole("link", { name: /.+/ }).first().click();
  await page.getByRole("button", { name: /add to cart/i }).click();

  // Checkout
  await page.goto("/checkout");
  await page.getByLabel(/address/i).fill("12 Test Street, Testville");
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: /place order/i }).click();
  await page.waitForURL(/\/order\//, { timeout: 30000 });

  // Payment instructions visible
  await expect(page.getByRole("main")).toContainText(/instapay|wallet/i);
  await expect(page.getByRole("main")).toContainText(/I\d{14}/);

  // Upload a proof (1x1 PNG)
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.setInputFiles('input[type="file"]', {
    name: "proof.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByRole("button", { name: /upload/i }).click();
  await expect(page.getByRole("main")).toContainText(/verification/i, { timeout: 30000 });
});
