export const widgetStyles = ["icon", "text"] as const;
export const widgetSizes = ["small", "medium", "large"] as const;
export const widgetOrientations = ["horizontal", "vertical"] as const;
export const widgetPositions = [
  "top_left",
  "top_center",
  "top_right",
  "middle_left",
  "middle_center",
  "middle_right",
  "bottom_left",
  "bottom_center",
  "bottom_right",
] as const;
export const widgetDisplayModes = ["all", "specific"] as const;
export const widgetAnimations = ["none", "pulse", "bounce"] as const;

export type WidgetStyle = (typeof widgetStyles)[number];
export type WidgetSize = (typeof widgetSizes)[number];
export type WidgetOrientation = (typeof widgetOrientations)[number];
export type WidgetPosition = (typeof widgetPositions)[number];
export type WidgetDisplayMode = (typeof widgetDisplayModes)[number];
export type WidgetAnimation = (typeof widgetAnimations)[number];

export type WidgetSettings = {
  widgetStyle: WidgetStyle;
  widgetButtonText: string;
  widgetSize: WidgetSize;
  widgetOrientation: WidgetOrientation;
  widgetDesktopPosition: WidgetPosition;
  widgetMobilePosition: WidgetPosition;
  widgetDisplayMode: WidgetDisplayMode;
  widgetSpecificPages: string;
  widgetBackgroundColor: string;
  widgetTextColor: string;
  widgetAnimation: WidgetAnimation;
  widgetIconDataUrl: string;
};

export const defaultWidgetSettings: WidgetSettings = {
  widgetStyle: "text",
  widgetButtonText: "Get Quote",
  widgetSize: "medium",
  widgetOrientation: "horizontal",
  widgetDesktopPosition: "middle_left",
  widgetMobilePosition: "bottom_right",
  widgetDisplayMode: "all",
  widgetSpecificPages: "",
  widgetBackgroundColor: "#120670",
  widgetTextColor: "#ffffff",
  widgetAnimation: "pulse",
  widgetIconDataUrl: "",
};

export function normalizeWidgetSettings(
  input: Partial<Record<keyof WidgetSettings, unknown>>,
): WidgetSettings {
  return {
    widgetStyle: enumValue(input.widgetStyle, widgetStyles, defaultWidgetSettings.widgetStyle),
    widgetButtonText: singleLine(input.widgetButtonText, defaultWidgetSettings.widgetButtonText, 20),
    widgetSize: enumValue(input.widgetSize, widgetSizes, defaultWidgetSettings.widgetSize),
    widgetOrientation: enumValue(input.widgetOrientation, widgetOrientations, defaultWidgetSettings.widgetOrientation),
    widgetDesktopPosition: enumValue(input.widgetDesktopPosition, widgetPositions, defaultWidgetSettings.widgetDesktopPosition),
    widgetMobilePosition: enumValue(input.widgetMobilePosition, widgetPositions, defaultWidgetSettings.widgetMobilePosition),
    widgetDisplayMode: enumValue(input.widgetDisplayMode, widgetDisplayModes, defaultWidgetSettings.widgetDisplayMode),
    widgetSpecificPages: pageList(input.widgetSpecificPages),
    widgetBackgroundColor: hexColor(input.widgetBackgroundColor, defaultWidgetSettings.widgetBackgroundColor),
    widgetTextColor: hexColor(input.widgetTextColor, defaultWidgetSettings.widgetTextColor),
    widgetAnimation: enumValue(input.widgetAnimation, widgetAnimations, defaultWidgetSettings.widgetAnimation),
    widgetIconDataUrl: iconDataUrl(input.widgetIconDataUrl),
  };
}

export function widgetSettingsFromForm(formData: FormData): WidgetSettings {
  return normalizeWidgetSettings(
    Object.fromEntries(
      (Object.keys(defaultWidgetSettings) as Array<keyof WidgetSettings>).map(
        (key) => [key, formData.get(key)],
      ),
    ),
  );
}

export function toStorefrontWidgetSettings(settings: WidgetSettings) {
  return { ...settings };
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const candidate = String(value ?? "") as T;
  return allowed.includes(candidate) ? candidate : fallback;
}

function hexColor(value: unknown, fallback: string) {
  const color = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

function iconDataUrl(value: unknown) {
  const clean = String(value ?? "").trim();
  if (!clean || clean.length > 1_400_000) return "";
  return /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(clean)
    ? clean
    : "";
}

function singleLine(value: unknown, fallback: string, maxLength: number) {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  return (clean || fallback).slice(0, maxLength);
}

function pageList(value: unknown) {
  const seen = new Set<string>();
  return String(value ?? "")
    .split(/[\n,]+/)
    .map((page) => page.trim())
    .filter((page) => {
      if (!page || seen.has(page)) return false;
      seen.add(page);
      return true;
    })
    .slice(0, 50)
    .join("\n");
}
