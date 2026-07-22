import { describe, expect, it } from "vitest";
import {
  defaultWidgetSettings,
  normalizeWidgetSettings,
  toStorefrontWidgetSettings,
} from "./widget-settings";

describe("widget settings", () => {
  it("normalizes invalid stored and submitted values from one canonical schema", () => {
    expect(
      normalizeWidgetSettings({
        widgetStyle: "invalid",
        widgetButtonText: "  Ask   for a quote  ",
        widgetBackgroundColor: "#ABCDEF",
        widgetSpecificPages: "/products/a, /products/a\n/collections/b",
      }),
    ).toEqual({
      ...defaultWidgetSettings,
      widgetButtonText: "Ask for a quote",
      widgetBackgroundColor: "#abcdef",
      widgetSpecificPages: "/products/a\n/collections/b",
    });
  });

  it("projects exactly the normalized widget contract to storefront", () => {
    const settings = normalizeWidgetSettings({ widgetStyle: "icon" });
    expect(toStorefrontWidgetSettings(settings)).toEqual(settings);
    expect(toStorefrontWidgetSettings(settings)).not.toBe(settings);
  });
});
