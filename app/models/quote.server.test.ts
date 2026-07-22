import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    quote: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    conversationMessage: { createMany: vi.fn() },
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    $transaction: vi.fn(),
  },
  getQuoteSettings: vi.fn(),
  queueQuoteNotification: vi.fn(),
}));

vi.mock("~/db.server", () => ({ default: mocks.prisma }));
vi.mock("~/models/quote-setting.server", () => ({
  getQuoteSettings: mocks.getQuoteSettings,
}));
vi.mock("~/features/email/quote-email.server", () => ({
  queueQuoteNotification: mocks.queueQuoteNotification,
}));

import {
  runQuoteExpirationJobs,
  updateQuoteStatus,
} from "./quote.server";

const fullQuote = {
  id: "quote-1",
  quoteNumber: "RFQ-00001",
  shop: "test.myshopify.com",
  customerName: "Buyer",
  customerEmail: "buyer@example.com",
  quoteTotal: { toNumber: () => 90 },
  originalTotal: { toNumber: () => 100 },
  currency: "USD",
  status: "EXPIRED",
  note: null,
  expiresAt: new Date("2026-07-14T00:00:00.000Z"),
  orderInvoiceUrl: null,
  orderName: null,
  offerVersion: 2,
  items: [],
};

describe("quote model status transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.quote.findUniqueOrThrow.mockResolvedValue({
      id: "quote-1",
      status: "ACCEPTED",
    });
  });

  it("atomically accepts only the currently sent offer", async () => {
    mocks.prisma.quote.findFirst.mockResolvedValue({
      id: "quote-1",
      status: "OFFERED_BY_MERCHANT",
    });
    mocks.prisma.quote.updateMany.mockResolvedValue({ count: 1 });

    await updateQuoteStatus("test.myshopify.com", "quote-1", "ACCEPTED");

    expect(mocks.prisma.quote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "quote-1", status: "OFFERED_BY_MERCHANT" },
        data: expect.objectContaining({
          status: "ACCEPTED",
          expiresAt: null,
          reminderSentAt: null,
        }),
      }),
    );
  });

  it("does not write again when the requested status is unchanged", async () => {
    mocks.prisma.quote.findFirst.mockResolvedValue({
      id: "quote-1",
      status: "ACCEPTED",
    });

    await updateQuoteStatus("test.myshopify.com", "quote-1", "ACCEPTED");

    expect(mocks.prisma.quote.updateMany).not.toHaveBeenCalled();
  });

  it("queues email 9 when a declined quote is reopened", async () => {
    mocks.prisma.quote.findFirst
      .mockResolvedValueOnce({ id: "quote-1", status: "DECLINED" })
      .mockResolvedValueOnce({ ...fullQuote, status: "NEGOTIATING" });
    mocks.prisma.quote.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.quote.findUniqueOrThrow.mockResolvedValue({
      id: "quote-1",
      status: "NEGOTIATING",
    });

    await updateQuoteStatus("test.myshopify.com", "quote-1", "NEGOTIATING");

    expect(mocks.queueQuoteNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "quote_reopened",
        idempotencyKey:
          "test.myshopify.com:quote-1:quote_reopened:v2",
      }),
    );
  });

  it("returns conflict when another request wins the status race", async () => {
    mocks.prisma.quote.findFirst.mockResolvedValue({
      id: "quote-1",
      status: "OFFERED_BY_MERCHANT",
    });
    mocks.prisma.quote.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateQuoteStatus("test.myshopify.com", "quote-1", "DECLINED"),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects invalid transitions before touching the database", async () => {
    mocks.prisma.quote.findFirst.mockResolvedValue({
      id: "quote-1",
      status: "EXPIRED",
    });

    await expect(
      updateQuoteStatus("test.myshopify.com", "quote-1", "ACCEPTED"),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.prisma.quote.updateMany).not.toHaveBeenCalled();
  });
});

describe("quote expiration job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$queryRawUnsafe.mockResolvedValue([]);
    mocks.getQuoteSettings.mockResolvedValue({
      reminderBeforeExpireDays: 0,
    });
    mocks.prisma.quote.findFirst.mockResolvedValue(fullQuote);
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mocks.prisma) => unknown) =>
        callback(mocks.prisma),
    );
  });

  it("queries and expires only sent merchant offers", async () => {
    mocks.prisma.quote.findMany.mockResolvedValue([]);

    await runQuoteExpirationJobs({
      shop: "test.myshopify.com",
      includeReminders: false,
    });

    expect(mocks.prisma.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "OFFERED_BY_MERCHANT" }),
      }),
    );
  });

  it("creates one message and one email only for a successfully claimed quote", async () => {
    mocks.prisma.quote.findMany.mockResolvedValue([fullQuote]);
    mocks.prisma.quote.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const first = await runQuoteExpirationJobs({
      shop: "test.myshopify.com",
      includeReminders: false,
    });
    const second = await runQuoteExpirationJobs({
      shop: "test.myshopify.com",
      includeReminders: false,
    });

    expect(first.expiredCount).toBe(1);
    expect(second.expiredCount).toBe(0);
    expect(mocks.prisma.conversationMessage.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.queueQuoteNotification).toHaveBeenCalledTimes(1);
    expect(mocks.queueQuoteNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "quote_expired",
        idempotencyKey:
          "test.myshopify.com:quote-1:quote_expired:v2",
      }),
    );
  });

  it("queues one reminder for an offer inside the configured reminder window", async () => {
    mocks.getQuoteSettings.mockResolvedValue({
      reminderBeforeExpireDays: 3,
    });
    mocks.prisma.quote.findMany.mockResolvedValue([]);
    mocks.prisma.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: "quote-1",
          quoteNumber: "RFQ-00001",
          shop: "test.myshopify.com",
          customerEmail: "buyer@example.com",
          expiresAt: new Date("2026-07-20T00:00:00.000Z"),
          offerVersion: 2,
        },
      ]);

    const result = await runQuoteExpirationJobs({
      shop: "test.myshopify.com",
      includeReminders: true,
    });

    expect(result.reminderCount).toBe(1);
    expect(mocks.queueQuoteNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "quote_reminder",
        idempotencyKey:
          "test.myshopify.com:quote-1:quote_reminder:v2",
      }),
    );
  });
});
