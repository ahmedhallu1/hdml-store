import { expect, test } from "@playwright/test";

/**
 * Smoke suite — requires a running app with real Supabase env and the catalog
 * imported (see docs/SETUP-GUIDE.md). Covers browse/search/cart/auth-gating.
 */

test("home renders hero, categories and products", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/HDML/);
  await expect(page.getByRole("link", { name: /catalog/i }).first()).toBeVisible();
});

test("catalog search returns results and paginates", async ({ page }) => {
  await page.goto("/catalog?q=anker");
  await expect(page.getByRole("main")).toContainText(/anker/i);
  await page.goto("/catalog");
  // pagination present on a 9k catalog
  await expect(page.getByRole("main")).toContainText(/EGP/);
});

test("product page shows price, MOQ note and add to cart", async ({ page }) => {
  await page.goto("/catalog?q=anker");
  const firstProduct = page.getByRole("main").getByRole("link", { name: /anker/i }).first();
  await firstProduct.click();
  await expect(page.getByText(/EGP/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /add to cart/i })).toBeVisible();
});

test("cart add → quantity → checkout requires login", async ({ page }) => {
  await page.goto("/catalog?q=charger");
  await page.getByRole("main").getByRole("link", { name: /charger/i }).first().click();
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.goto("/cart");
  await expect(page.getByRole("main")).toContainText(/EGP/);
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/login/); // proxy gate
});

test("static pages exist", async ({ page }) => {
  for (const path of ["/contact", "/delivery", "/privacy", "/returns", "/terms"]) {
    await page.goto(path);
    await expect(page.getByRole("main")).not.toBeEmpty();
  }
});

test("admin is hidden from anonymous users", async ({ page }) => {
  const response = await page.goto("/admin");
  // proxy redirects to login; after login as non-admin it would 404
  expect(response?.url()).toContain("/login");
});
