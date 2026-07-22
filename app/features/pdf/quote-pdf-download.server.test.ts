import { describe, expect, it } from "vitest";
import { getQuotePdfFileName } from "~/features/pdf/quote-pdf-download.server";

describe("getQuotePdfFileName", () => {
  it("creates a safe file name from the quote number", () => {
    expect(getQuotePdfFileName(" RFQ / 00072 ")).toBe("RFQ-00072.pdf");
  });

  it("uses a stable fallback when the quote number has no safe characters", () => {
    expect(getQuotePdfFileName("***")).toBe("quote.pdf");
  });
});
