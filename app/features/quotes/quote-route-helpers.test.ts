import { describe, expect, it } from "vitest";
import {
  formatQuoteMoney,
  getQuoteCurrencyLabel,
} from "~/features/quotes/quote-detail";
import {
  buildQuotesDataUrl,
  DEFAULT_QUOTE_LIST_SORT,
} from "~/features/quotes/quote-list-data";

describe("quote route helpers", () => {
  it("builds the default quote-list data URL without redundant filters", () => {
    expect(
      buildQuotesDataUrl({
        search: "",
        status: "ALL",
        sort: DEFAULT_QUOTE_LIST_SORT,
        page: 1,
        pageSize: 20,
      }),
    ).toBe("/app/quotes/data?page=1&pageSize=20");
  });

  it("encodes active quote-list filters", () => {
    expect(
      buildQuotesDataUrl({
        search: "RFQ 72",
        status: "ACCEPTED",
        sort: "VALUE_DESC",
        page: 2,
        pageSize: 50,
      }),
    ).toBe(
      "/app/quotes/data?search=RFQ+72&status=ACCEPTED&sort=VALUE_DESC&page=2&pageSize=50",
    );
  });

  it("formats quote currency values and labels consistently", () => {
    expect(formatQuoteMoney(12.5, "USD")).toBe("$12.50");
    expect(getQuoteCurrencyLabel("VND")).toBe("Vietnamese Dong (VND)");
  });
});
