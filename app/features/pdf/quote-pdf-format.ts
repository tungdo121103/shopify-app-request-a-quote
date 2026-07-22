import { rgb } from "pdf-lib";
import type { QuotePdfSetting } from "~/models/quote-pdf-setting.server";

export function formatPdfMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(Number(value || 0));
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency || "USD"}`;
  }
}

export function formatPdfDate(
  value: string | Date | null | undefined,
  format: QuotePdfSetting["dateFormat"],
) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  const year = String(parsed.getUTCFullYear());
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  if (format === "MM/DD/YYYY") return `${month}/${day}/${year}`;
  if (format === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  return `${day}/${month}/${year}`;
}

export function pdfColor(hex: string, fallback: string) {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback;
  return rgb(
    Number.parseInt(value.slice(1, 3), 16) / 255,
    Number.parseInt(value.slice(3, 5), 16) / 255,
    Number.parseInt(value.slice(5, 7), 16) / 255,
  );
}

export function uniquePdfAddress(...values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return values
    .flatMap((value) => String(value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
}
