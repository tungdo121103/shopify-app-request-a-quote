import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createQuotePdf } from "./quote-pdf.server";
import { defaultQuotePdfSetting } from "~/models/quote-pdf-setting.server";

describe("createQuotePdf", () => {
  it("paginates every quote item instead of truncating the list", async () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      title: `San pham thu ${index + 1}`,
      variantTitle: index === 0 ? "Mau do" : null,
      sku: `SKU-${index + 1}`,
      quantity: index + 1,
      unitPrice: 20 + index,
      quotePrice: 18 + index,
    }));
    const pdfBytes = await createQuotePdf(
      {
        quoteNumber: "RFQ-TEST-30",
        status: "OFFERED_BY_MERCHANT",
        customerName: "Nguyen Van An",
        customerEmail: "an@example.com",
        customerAddress: "215 Trieu Khuc",
        customerRegion: "Ha Noi",
        customerCountry: "Vietnam",
        currency: "USD",
        originalTotal: 1_000,
        quoteTotal: 900,
        createdAt: new Date("2026-07-21T00:00:00Z"),
        expiresAt: new Date("2026-08-21T00:00:00Z"),
        items,
      },
      { ...defaultQuotePdfSetting, showImage: false },
      { storeName: "Shop Plaza" },
    );

    const document = await PDFDocument.load(pdfBytes);
    expect(document.getPageCount()).toBe(3);
    expect(pdfBytes.byteLength).toBeGreaterThan(1_000);
  });

  it("generates successfully with Vietnamese customer and product text", async () => {
    const pdfBytes = await createQuotePdf(
      {
        quoteNumber: "RFQ-VI",
        status: "OFFERED_BY_MERCHANT",
        customerName: "Nguyễn Đình Quân",
        customerAddress: "Thạch Thất, Hà Nội",
        currency: "VND",
        originalTotal: 100_000,
        quoteTotal: 90_000,
        createdAt: new Date("2026-07-21T00:00:00Z"),
        items: [{
          title: "Sản phẩm thử nghiệm",
          quantity: 1,
          unitPrice: 100_000,
          quotePrice: 90_000,
        }],
      },
      { ...defaultQuotePdfSetting, showImage: false },
    );

    expect((await PDFDocument.load(pdfBytes)).getPageCount()).toBe(1);
  });

  it("omits a missing due date instead of printing a dash", async () => {
    const pdfBytes = await createQuotePdf(
      {
        quoteNumber: "RFQ-CONVERTED",
        status: "CONVERTED_TO_ORDER",
        customerName: "Customer",
        currency: "USD",
        originalTotal: 10,
        quoteTotal: 10,
        createdAt: new Date("2026-07-21T00:00:00Z"),
        expiresAt: null,
        items: [{ title: "Gift Card", quantity: 1, unitPrice: 10, quotePrice: 10 }],
      },
      { ...defaultQuotePdfSetting, showImage: false, showDueDate: true },
    );

    expect((await PDFDocument.load(pdfBytes)).getPageCount()).toBe(1);
  });
});
