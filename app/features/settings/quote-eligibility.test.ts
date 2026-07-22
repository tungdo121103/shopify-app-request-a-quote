import { describe, expect, it } from "vitest";
import {
  matchesEmailPatterns,
  parseSelectedCustomers,
  parseSelectedProductResources,
} from "./quote-eligibility";

describe("shared quote eligibility parsing", () => {
  it("uses the same customer/resource parsing contract for admin and storefront", () => {
    expect(parseSelectedCustomers('[{"id":"1","email":"a@example.com"}]')).toEqual([
      { id: "1", name: "Customer", email: "a@example.com", phone: "" },
    ]);
    expect(parseSelectedProductResources('[{"id":"2","type":"product"}]')).toEqual([
      { id: "2", type: "PRODUCT", title: "Resource", imageUrl: "" },
    ]);
  });

  it("matches exact, domain and wildcard email rules", () => {
    expect(matchesEmailPatterns("buyer@company.com", "@company.com")).toBe(true);
    expect(matchesEmailPatterns("buyer@wholesale.com", "*@wholesale.com")).toBe(true);
    expect(matchesEmailPatterns("other@example.com", "buyer@example.com")).toBe(false);
  });
});
