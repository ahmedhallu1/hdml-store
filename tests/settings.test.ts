/**
 * telegramUrl(): the red "contact us before paying" warning links straight to
 * Telegram, and the handle is admin-editable — so every shape the owner might
 * type has to resolve, and anything unusable must degrade to no link at all
 * rather than a broken href.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseService: () => ({}) }));

import { telegramUrl } from "@/lib/settings";

describe("telegramUrl", () => {
  it("accepts a bare handle", () => {
    expect(telegramUrl("ahmedhallul")).toBe("https://t.me/ahmedhallul");
  });

  it("accepts an @handle", () => {
    expect(telegramUrl("@ahmedhallul")).toBe("https://t.me/ahmedhallul");
  });

  it("accepts a t.me path", () => {
    expect(telegramUrl("t.me/ahmedhallul")).toBe("https://t.me/ahmedhallul");
  });

  it("passes a full URL through untouched", () => {
    expect(telegramUrl("https://t.me/joinchat/AbCdEf")).toBe("https://t.me/joinchat/AbCdEf");
  });

  it("trims surrounding whitespace", () => {
    expect(telegramUrl("  @ahmedhallul  ")).toBe("https://t.me/ahmedhallul");
  });

  it("returns null when nothing is configured", () => {
    expect(telegramUrl("")).toBeNull();
    expect(telegramUrl(null)).toBeNull();
    expect(telegramUrl(undefined)).toBeNull();
    expect(telegramUrl("   ")).toBeNull();
  });

  it("returns null for handles Telegram would reject", () => {
    expect(telegramUrl("ab")).toBeNull(); // too short
    expect(telegramUrl("has spaces")).toBeNull();
    expect(telegramUrl("bad/chars!")).toBeNull();
  });
});
