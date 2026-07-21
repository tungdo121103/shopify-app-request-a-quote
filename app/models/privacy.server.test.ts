import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  quote: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  quoteReadState: { deleteMany: vi.fn() },
  quoteSetting: { deleteMany: vi.fn() },
  quotePdfSetting: { deleteMany: vi.fn() },
  quoteEmailBranding: { deleteMany: vi.fn() },
  shopCounter: { deleteMany: vi.fn() },
  privacyRequest: { upsert: vi.fn(), deleteMany: vi.fn() },
  session: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("~/db.server", () => ({ default: db }));

import {
  createCustomerDataExport,
  deleteShopData,
  redactCustomerData,
} from "./privacy.server";

describe("privacy data handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const model of Object.values(db)) {
      if (typeof model !== "object") continue;
      for (const fn of Object.values(model)) {
        if (typeof fn === "function") fn.mockResolvedValue({ count: 0 });
      }
    }
    db.$transaction.mockResolvedValue([]);
  });

  it("creates a merchant-downloadable customer data export", async () => {
    db.quote.findMany.mockResolvedValue([{ id: "quote-1", items: [] }]);
    db.privacyRequest.upsert.mockResolvedValue({ id: "request-1" });

    await createCustomerDataExport({
      shop: "test.myshopify.com",
      requestId: "request-1",
      customer: { id: 123, email: "Buyer@Example.com" },
    });

    expect(db.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shop: "test.myshopify.com" }),
      }),
    );
    expect(db.privacyRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          topic: "customers/data_request",
          customerId: "123",
        }),
      }),
    );
  });

  it("deletes all quote-owned customer data on customer redact", async () => {
    db.quote.findMany.mockResolvedValue([{ id: "quote-1" }, { id: "quote-2" }]);

    const result = await redactCustomerData({
      shop: "test.myshopify.com",
      customer: { id: "123" },
    });

    expect(result.deletedQuotes).toBe(2);
    expect(db.quoteReadState.deleteMany).toHaveBeenCalled();
    expect(db.quote.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["quote-1", "quote-2"] } },
    });
    expect(db.$transaction).toHaveBeenCalled();
  });

  it("deletes every shop-owned record on uninstall or shop redact", async () => {
    db.quote.findMany.mockResolvedValue([{ id: "quote-1" }]);

    await deleteShopData("test.myshopify.com");

    expect(db.quote.deleteMany).toHaveBeenCalledWith({
      where: { shop: "test.myshopify.com" },
    });
    expect(db.quoteSetting.deleteMany).toHaveBeenCalled();
    expect(db.quotePdfSetting.deleteMany).toHaveBeenCalled();
    expect(db.quoteEmailBranding.deleteMany).toHaveBeenCalled();
    expect(db.session.deleteMany).toHaveBeenCalled();
  });
});
