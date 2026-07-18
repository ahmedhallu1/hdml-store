import { describe, expect, it } from "vitest";
import { facebookCaption, instagramCaption } from "@/lib/social/tailor";
import { nextSlotAfter, formatSlot } from "@/lib/social/slot";

describe("caption tailoring", () => {
  const base = { coreCaption: "New chargers in stock!", hashtags: "#HDML #wholesale", link: "https://hdmlstore.com/catalog" };

  it("facebook keeps the link inline", () => {
    const fb = facebookCaption(base);
    expect(fb).toContain("New chargers in stock!");
    expect(fb).toContain("https://hdmlstore.com/catalog");
    expect(fb).toContain("#HDML #wholesale");
  });

  it("instagram replaces the link with 'link in bio' and keeps hashtags", () => {
    const ig = instagramCaption(base);
    expect(ig).toContain("New chargers in stock!");
    expect(ig).not.toContain("https://hdmlstore.com/catalog");
    expect(ig).toContain("🔗 Link in bio");
    expect(ig).toContain("#HDML #wholesale");
  });

  it("omits empty link / hashtags cleanly", () => {
    const fb = facebookCaption({ coreCaption: "Hi", hashtags: "", link: "" });
    expect(fb).toBe("Hi");
    const ig = instagramCaption({ coreCaption: "Hi", hashtags: "", link: "" });
    expect(ig).toBe("Hi");
  });

  it("caps instagram captions at 2200 chars", () => {
    const ig = instagramCaption({ coreCaption: "x".repeat(3000), hashtags: "", link: "" });
    expect(ig.length).toBeLessThanOrEqual(2200);
  });
});

describe("weekly slot maths (Cairo)", () => {
  const tz = "Africa/Cairo";
  const sundayEvening = { dayOfWeek: 0, hour: 19, minute: 0 }; // Sunday 19:00

  it("finds the next Sunday 19:00 after a mid-week instant", () => {
    // 2026-07-15 is a Wednesday (UTC). Next Sunday is 2026-07-19.
    const after = new Date("2026-07-15T10:00:00Z");
    const slot = nextSlotAfter(after, sundayEvening, tz);
    // 19:00 Cairo in July (DST, UTC+3) = 16:00 UTC.
    expect(slot.toISOString()).toBe("2026-07-19T16:00:00.000Z");
    // And it's a Sunday in Cairo.
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(slot);
    expect(wd).toBe("Sun");
  });

  it("rolls to the following week when already past this week's slot", () => {
    // 2026-07-19 is Sunday; 20:00 UTC is after 19:00 Cairo (16:00 UTC).
    const after = new Date("2026-07-19T20:00:00Z");
    const slot = nextSlotAfter(after, sundayEvening, tz);
    expect(slot.toISOString()).toBe("2026-07-26T16:00:00.000Z");
  });

  it("stacks successive posts a week apart", () => {
    const tz2 = "Africa/Cairo";
    const first = nextSlotAfter(new Date("2026-07-15T10:00:00Z"), sundayEvening, tz2);
    const second = nextSlotAfter(first, sundayEvening, tz2);
    const weekMs = 7 * 86400000;
    expect(second.getTime() - first.getTime()).toBe(weekMs);
  });

  it("formatSlot renders a readable Cairo label", () => {
    const label = formatSlot("2026-07-19T16:00:00.000Z", tz);
    expect(label).toContain("Sun");
    expect(label).toContain("19:00");
    expect(label).toContain("Jul");
  });
});
