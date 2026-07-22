import { describe, expect, it } from "vitest";
import {
  createPreviewExpiry,
  formatQuoteEmailExpiry,
} from "~/features/email/rendering/quote-email-expiry";

describe("quote email expiry", () => {
  const now = new Date("2026-07-22T12:00:00.000Z");

  it("formats a compact date and remaining days", () => {
    expect(formatQuoteEmailExpiry("2026-07-29T14:45:00.000Z", now)).toEqual({
      dateText: "29 Jul 2026, 14:45",
      statusText: "8 days remaining",
    });
  });

  it("handles tomorrow and missing expiry", () => {
    expect(formatQuoteEmailExpiry("2026-07-23T08:00:00.000Z", now)?.statusText)
      .toBe("Expires tomorrow");
    expect(formatQuoteEmailExpiry(null, now)).toBeNull();
  });

  it("builds a seven-day preview expiry", () => {
    expect(createPreviewExpiry(now).toISOString()).toBe("2026-07-29T12:00:00.000Z");
  });
});
