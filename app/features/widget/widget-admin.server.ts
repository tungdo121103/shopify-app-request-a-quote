import { Buffer } from "node:buffer";
import {
  getQuoteSettings,
  normalizeWidgetSettingsForm,
  updateWidgetSettings,
} from "~/models/quote-setting.server";

export async function loadWidgetAdmin(shop: string) {
  return { settings: await getQuoteSettings(shop) };
}

export async function saveWidgetAdmin(shop: string, formData: FormData) {
  const input = normalizeWidgetSettingsForm(formData);
  input.widgetIconDataUrl = await resolveWidgetIconDataUrl(
    formData,
    input.widgetIconDataUrl,
  );
  await updateWidgetSettings(shop, input);

  return { ok: true as const, message: "Widget settings saved." };
}

async function resolveWidgetIconDataUrl(formData: FormData, fallback: string) {
  if (formData.get("removeWidgetIcon") === "on") return "";

  const file = formData.get("widgetIconFile");
  if (!(file instanceof File) || file.size === 0) return fallback;

  const allowedTypes = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ]);
  if (!allowedTypes.has(file.type) || file.size > 1_000_000) return fallback;

  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}
