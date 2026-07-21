import { describe, expect, it } from "vitest";
import {
  assertQuoteStatusTransition,
  canTransitionQuoteStatus,
  shouldShowQuoteDueDate,
  type QuoteStatusValue,
} from "./quote-status";

const statuses = [
  "REQUESTED_BY_CUSTOMER",
  "NEGOTIATING",
  "OFFERED_BY_MERCHANT",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CONVERTED_TO_ORDER",
] as const satisfies readonly QuoteStatusValue[];

const allowedTransitions = new Set<string>([
  "REQUESTED_BY_CUSTOMER->NEGOTIATING",
  "NEGOTIATING->OFFERED_BY_MERCHANT",
  "OFFERED_BY_MERCHANT->NEGOTIATING",
  "OFFERED_BY_MERCHANT->ACCEPTED",
  "OFFERED_BY_MERCHANT->DECLINED",
  "OFFERED_BY_MERCHANT->EXPIRED",
  "ACCEPTED->CONVERTED_TO_ORDER",
  "DECLINED->NEGOTIATING",
  "EXPIRED->NEGOTIATING",
]);

describe("quote status state machine", () => {
  it.each([...allowedTransitions])("allows %s", (transition) => {
    const [current, next] = transition.split("->") as [
      QuoteStatusValue,
      QuoteStatusValue,
    ];

    expect(canTransitionQuoteStatus(current, next)).toBe(true);
    expect(() => assertQuoteStatusTransition(current, next)).not.toThrow();
  });

  it.each(statuses)("treats repeated %s requests as idempotent", (status) => {
    expect(canTransitionQuoteStatus(status, status)).toBe(true);
    expect(() => assertQuoteStatusTransition(status, status)).not.toThrow();
  });

  it("rejects every transition that is not explicitly allowed", async () => {
    for (const current of statuses) {
      for (const next of statuses) {
        const key = `${current}->${next}`;
        if (current === next || allowedTransitions.has(key)) continue;

        expect(canTransitionQuoteStatus(current, next), key).toBe(false);

        try {
          assertQuoteStatusTransition(current, next);
          throw new Error(`Expected ${key} to be rejected`);
        } catch (error) {
          expect(error, key).toBeInstanceOf(Response);
          expect((error as Response).status, key).toBe(409);
          expect(await (error as Response).text(), key).toContain(
            "Quote status cannot change",
          );
        }
      }
    }
  });

  it("keeps converted quotes terminal", () => {
    for (const next of statuses) {
      expect(canTransitionQuoteStatus("CONVERTED_TO_ORDER", next)).toBe(
        next === "CONVERTED_TO_ORDER",
      );
    }
  });
});

describe("quote due date visibility", () => {
  it.each(["OFFERED_BY_MERCHANT", "EXPIRED"])(
    "shows the due date for %s",
    (status) => {
      expect(shouldShowQuoteDueDate(status, new Date())).toBe(true);
    },
  );

  it.each([
    "REQUESTED_BY_CUSTOMER",
    "NEGOTIATING",
    "ACCEPTED",
    "DECLINED",
    "CONVERTED_TO_ORDER",
  ])("hides the due date for %s", (status) => {
    expect(shouldShowQuoteDueDate(status, new Date())).toBe(false);
  });

  it("hides the due date when no expiration exists", () => {
    expect(shouldShowQuoteDueDate("OFFERED_BY_MERCHANT", null)).toBe(false);
  });
});
