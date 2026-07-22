import { describe, expect, it } from "vitest";
import { getQuoteEditError } from "~/features/quotes/quote-edit-policy";

describe("getQuoteEditError", () => {
  it("allows requested and negotiating quotes without an order", () => {
    expect(getQuoteEditError({ status: "REQUESTED_BY_CUSTOMER" }, "reopen")).toBeNull();
    expect(getQuoteEditError({ status: "NEGOTIATING" }, "reopen")).toBeNull();
  });

  it("returns the action-specific message for a sent offer", () => {
    expect(
      getQuoteEditError({ status: "OFFERED_BY_MERCHANT" }, "Reopen first."),
    ).toBe("Reopen first.");
  });

  it.each(["ACCEPTED", "DECLINED", "EXPIRED", "CONVERTED_TO_ORDER"])(
    "locks status %s",
    (status) => {
      expect(getQuoteEditError({ status }, "reopen")).toBe(
        "This quote can no longer be edited.",
      );
    },
  );

  it("locks a quote that already has an order", () => {
    expect(
      getQuoteEditError({ status: "NEGOTIATING", orderId: "gid://Order/1" }, "reopen"),
    ).toBe("This quote can no longer be edited.");
  });
});
