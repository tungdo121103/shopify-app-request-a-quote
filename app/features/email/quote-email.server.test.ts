import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDelivery: vi.fn(),
}));

vi.mock("~/db.server", () => ({
  default: {
    quoteEmailDelivery: { create: mocks.createDelivery },
  },
}));

import { queueQuoteNotification } from "./quote-email.server";

const input = {
  shop: "test.myshopify.com",
  quote: {
    id: "quote-1",
    quoteNumber: "RFQ-00001",
    customerName: "Buyer",
    customerEmail: " Buyer@Example.com ",
    quoteTotal: 90,
    originalTotal: 100,
    currency: "USD",
    status: "ACCEPTED",
    note: null,
    expiresAt: null,
    items: [],
  },
  templateKey: "quote_accepted" as const,
  idempotencyKey: "test.myshopify.com:quote-1:quote_accepted:v2",
};

describe("quote email outbox idempotency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes the recipient and stores the idempotency key", async () => {
    mocks.createDelivery.mockResolvedValue({ id: "delivery-1" });

    await expect(queueQuoteNotification(input)).resolves.toBe(true);

    expect(mocks.createDelivery).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipientEmail: "buyer@example.com",
        idempotencyKey: input.idempotencyKey,
      }),
    });
  });

  it("treats a duplicate idempotency key as already queued", async () => {
    mocks.createDelivery
      .mockResolvedValueOnce({ id: "delivery-1" })
      .mockRejectedValueOnce({ code: "P2002" });

    await expect(queueQuoteNotification(input)).resolves.toBe(true);
    await expect(queueQuoteNotification(input)).resolves.toBe(true);
  });

  it("does not queue an email without a valid recipient", async () => {
    await expect(
      queueQuoteNotification({
        ...input,
        quote: { ...input.quote, customerEmail: "not-an-email" },
      }),
    ).resolves.toBe(false);
    expect(mocks.createDelivery).not.toHaveBeenCalled();
  });
});
