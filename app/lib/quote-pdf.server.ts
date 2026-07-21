import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { QuotePdfSetting } from "~/models/quote-pdf-setting.server";
import { shouldShowQuoteDueDate } from "~/lib/quote-status";

type PdfQuote = {
  quoteNumber: string;
  status?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerRegion?: string | null;
  customerCountry?: string | null;
  currency: string;
  originalTotal: number;
  quoteTotal: number;
  expiresAt?: string | Date | null;
  createdAt: string | Date;
  items: Array<{
    title: string;
    variantTitle?: string | null;
    sku?: string | null;
    imageUrl?: string | null;
    quantity: number;
    unitPrice: number;
    quotePrice: number;
  }>;
};

type PdfBranding = {
  logoUrl?: string | null;
  storeName?: string | null;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const FIRST_PAGE_ITEMS = 7;
const CONTINUATION_ITEMS = 13;

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(Number(value || 0));
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency || "USD"}`;
  }
}

function formatDate(
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

function color(hex: string, fallback: string) {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback;
  return rgb(
    Number.parseInt(value.slice(1, 3), 16) / 255,
    Number.parseInt(value.slice(3, 5), 16) / 255,
    Number.parseInt(value.slice(5, 7), 16) / 255,
  );
}

function uniqueAddress(...values: Array<string | null | undefined>) {
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

function pdfSafeText(text: string) {
  return String(text ?? "")
    .replace(/[đĐ]/g, (character) => (character === "đ" ? "d" : "D"))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  text = pdfSafeText(text);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}...`;
}

function drawRightText(
  page: PDFPage,
  text: string,
  right: number,
  y: number,
  font: PDFFont,
  size: number,
  textColor: ReturnType<typeof rgb>,
) {
  text = pdfSafeText(text);
  page.drawText(text, {
    x: right - font.widthOfTextAtSize(text, size),
    y,
    size,
    font,
    color: textColor,
  });
}

async function fetchImageBytes(url?: string | null) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  let fetchUrl = url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "cdn.shopify.com") {
      parsed.searchParams.set("width", "480");
      fetchUrl = parsed.toString();
    }
  } catch {
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(fetchUrl, { signal: controller.signal });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("png") && !contentType.includes("jpeg") && !contentType.includes("jpg")) {
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength <= 5_000_000 ? { bytes, contentType } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function embedRemoteImage(pdf: PDFDocument, url?: string | null) {
  const result = await fetchImageBytes(url);
  if (!result) return null;
  try {
    return result.contentType.includes("png")
      ? await pdf.embedPng(result.bytes)
      : await pdf.embedJpg(result.bytes);
  } catch {
    return null;
  }
}

function drawImageContained(
  page: PDFPage,
  image: PDFImage,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, { x, y: y + (maxHeight - height) / 2, width, height });
}

function drawRoundedRectangle(
  page: PDFPage,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    color: ReturnType<typeof rgb>;
  },
) {
  const { x, y, width, height, color } = options;
  const radius = Math.min(options.radius, width / 2, height / 2);
  page.drawRectangle({
    x: x + radius,
    y,
    width: width - radius * 2,
    height,
    color,
  });
  page.drawRectangle({
    x,
    y: y + radius,
    width,
    height: height - radius * 2,
    color,
  });
  for (const [centerX, centerY] of [
    [x + radius, y + radius],
    [x + width - radius, y + radius],
    [x + radius, y + height - radius],
    [x + width - radius, y + height - radius],
  ]) {
    page.drawCircle({ x: centerX, y: centerY, size: radius, color });
  }
}

export async function createQuotePdf(
  quote: PdfQuote,
  settings: QuotePdfSetting,
  branding: PdfBranding = {},
) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Quote ${quote.quoteNumber}`);
  pdf.setAuthor(branding.storeName || "Request for Quote");
  pdf.setCreator("Request for Quote app");

  const regularFontName = settings.font === "Georgia"
    ? StandardFonts.TimesRoman
    : StandardFonts.Helvetica;
  const boldFontName = settings.font === "Georgia"
    ? StandardFonts.TimesRomanBold
    : StandardFonts.HelveticaBold;
  const [font, bold] = await Promise.all([
    pdf.embedFont(regularFontName),
    pdf.embedFont(boldFontName),
  ]);
  const primary = color(settings.primaryColor, "#0B3F8A");
  const textColor = color(settings.textColor, "#111827");
  const headerText = color(settings.productHeaderColor, "#FFFFFF");
  const muted = rgb(0.38, 0.42, 0.48);
  const border = rgb(0.88, 0.9, 0.92);
  const baseSize = Math.max(8, Math.min(12, settings.fontSize * 0.72));

  const logo = await embedRemoteImage(pdf, branding.logoUrl);
  const imageUrls = settings.showImage
    ? [...new Set(quote.items.map((item) => item.imageUrl).filter(Boolean))].slice(0, 60)
    : [];
  const embeddedImages = new Map<string, PDFImage>();
  await Promise.all(imageUrls.map(async (url) => {
    const image = await embedRemoteImage(pdf, url);
    if (image && url) embeddedImages.set(url, image);
  }));

  const pageGroups: typeof quote.items[] = [];
  pageGroups.push(quote.items.slice(0, FIRST_PAGE_ITEMS));
  for (let index = FIRST_PAGE_ITEMS; index < quote.items.length; index += CONTINUATION_ITEMS) {
    pageGroups.push(quote.items.slice(index, index + CONTINUATION_ITEMS));
  }
  if (!pageGroups.length) pageGroups.push([]);

  const drawHeader = (page: PDFPage, compact: boolean) => {
    const logoWidth = 58 + settings.logoSize * 1.25;
    if (logo) {
      drawImageContained(page, logo, MARGIN, PAGE_HEIGHT - 92, logoWidth, 48);
    } else {
      page.drawText(pdfSafeText(branding.storeName || "YOUR STORE"), {
        x: MARGIN,
        y: PAGE_HEIGHT - 67,
        size: compact ? 11 : 14,
        font: bold,
        color: primary,
      });
    }
    drawRightText(page, compact ? `QUOTE ${quote.quoteNumber}` : "QUOTE", PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 67, bold, compact ? 12 : 20, primary);
  };

  const drawTable = (page: PDFPage, items: typeof quote.items, startY: number) => {
    const tableWidth = PAGE_WIDTH - MARGIN * 2;
    const numericColumns = [
      { key: "qty", label: "Qty", width: 38, visible: true },
      { key: "original", label: "Price", width: 72, visible: settings.showOriginalPrice },
      { key: "quote", label: "Quote price", width: 78, visible: settings.showUnitPrice },
      { key: "total", label: "Total", width: 76, visible: settings.showTotal },
    ].filter((column) => column.visible);
    const productWidth = tableWidth - numericColumns.reduce((sum, column) => sum + column.width, 0);
    drawRoundedRectangle(page, {
      x: MARGIN,
      y: startY - 22,
      width: tableWidth,
      height: 22,
      radius: 4,
      color: primary,
    });
    page.drawText("Product", { x: MARGIN + 7, y: startY - 15, size: baseSize - 1, font: bold, color: headerText });
    let cursor = MARGIN + productWidth;
    for (const column of numericColumns) {
      drawRightText(page, column.label, cursor + column.width - 7, startY - 15, bold, baseSize - 1, headerText);
      cursor += column.width;
    }

    let y = startY - 22;
    for (const item of items) {
      const rowHeight = settings.showImage ? 42 : 31;
      y -= rowHeight;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.6, color: border });
      let textX = MARGIN + 7;
      if (settings.showImage) {
        const productImage = item.imageUrl ? embeddedImages.get(item.imageUrl) : null;
        if (productImage) {
          drawImageContained(page, productImage, textX, y + 5, 27, rowHeight - 10);
        } else {
          page.drawRectangle({ x: textX, y: y + 7, width: 24, height: rowHeight - 14, color: rgb(0.94, 0.95, 0.96), borderColor: border, borderWidth: 0.5 });
        }
        textX += 34;
      }
      const titleY = y + rowHeight - 15;
      page.drawText(fitText(item.title, bold, baseSize, productWidth - (textX - MARGIN) - 6), { x: textX, y: titleY, size: baseSize, font: bold, color: textColor });
      const detail = item.variantTitle || item.sku || "";
      if (detail) page.drawText(fitText(detail, font, baseSize - 1.4, productWidth - (textX - MARGIN) - 6), { x: textX, y: titleY - 13, size: baseSize - 1.4, font, color: muted });

      cursor = MARGIN + productWidth;
      const values: Record<string, string> = {
        qty: String(item.quantity),
        original: money(item.unitPrice, quote.currency),
        quote: money(item.quotePrice, quote.currency),
        total: money(item.quotePrice * item.quantity, quote.currency),
      };
      for (const column of numericColumns) {
        drawRightText(page, values[column.key], cursor + column.width - 7, y + rowHeight / 2 - 3, font, baseSize - 0.7, textColor);
        cursor += column.width;
      }
    }
    return y;
  };

  pageGroups.forEach((items, pageIndex) => {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const isFirst = pageIndex === 0;
    const isLast = pageIndex === pageGroups.length - 1;
    drawHeader(page, !isFirst);
    let tableY: number;

    if (isFirst) {
      page.drawText("Request For Quote", { x: MARGIN, y: PAGE_HEIGHT - 126, size: baseSize + 2, font: bold, color: textColor });
      page.drawText(pdfSafeText(branding.storeName || ""), { x: MARGIN, y: PAGE_HEIGHT - 143, size: baseSize, font, color: muted });
      const metaX = PAGE_WIDTH - 210;
      const meta = [
        ["Quote #", quote.quoteNumber],
        ...(settings.showQuoteDate ? [["Quote date", formatDate(quote.createdAt, settings.dateFormat)]] : []),
        ...(settings.showDueDate && shouldShowQuoteDueDate(quote.status, quote.expiresAt)
          ? [["Due date", formatDate(quote.expiresAt, settings.dateFormat)]]
          : []),
      ];
      meta.forEach(([label, value], index) => {
        const y = PAGE_HEIGHT - 126 - index * 17;
        page.drawText(label, { x: metaX, y, size: baseSize - 1, font: bold, color: muted });
        drawRightText(page, value, PAGE_WIDTH - MARGIN, y, font, baseSize - 1, textColor);
      });

      const customerTop = PAGE_HEIGHT - 190;
      page.drawRectangle({ x: MARGIN, y: customerTop - 86, width: PAGE_WIDTH - MARGIN * 2, height: 86, borderColor: border, borderWidth: 0.8 });
      page.drawText("TO", { x: MARGIN + 10, y: customerTop - 17, size: baseSize - 1, font: bold, color: primary });
      page.drawText(pdfSafeText(quote.customerName || "Customer"), { x: MARGIN + 10, y: customerTop - 37, size: baseSize, font: bold, color: textColor });
      if (quote.customerEmail) page.drawText(fitText(quote.customerEmail, font, baseSize - 1, 300), { x: MARGIN + 10, y: customerTop - 53, size: baseSize - 1, font, color: textColor });
      const address = uniqueAddress(quote.customerAddress, quote.customerRegion, quote.customerCountry);
      if (address) page.drawText(fitText(address, font, baseSize - 1, PAGE_WIDTH - MARGIN * 2 - 20), { x: MARGIN + 10, y: customerTop - 69, size: baseSize - 1, font, color: textColor });
      tableY = customerTop - 108;
    } else {
      tableY = PAGE_HEIGHT - 118;
    }

    const bottomY = drawTable(page, items, tableY);
    if (isLast && settings.showTotal) {
      const totalY = Math.max(78, bottomY - 38);
      page.drawText("TOTAL", { x: PAGE_WIDTH - 190, y: totalY, size: baseSize, font: bold, color: muted });
      drawRightText(page, money(quote.quoteTotal, quote.currency), PAGE_WIDTH - MARGIN, totalY - 1, bold, baseSize + 3, primary);
    }
    const pageNumber = `Page ${pageIndex + 1} of ${pageGroups.length}`;
    const footerSize = 8;
    if (isLast) {
      const thankYou = "THANK YOU FOR YOUR BUSINESS!";
      page.drawText(thankYou, {
        x: (PAGE_WIDTH - bold.widthOfTextAtSize(thankYou, footerSize)) / 2,
        y: pageGroups.length > 1 ? 38 : 30,
        size: footerSize,
        font: bold,
        color: muted,
      });
      if (pageGroups.length > 1) {
        page.drawText(pageNumber, {
          x: (PAGE_WIDTH - font.widthOfTextAtSize(pageNumber, footerSize)) / 2,
          y: 25,
          size: footerSize,
          font,
          color: muted,
        });
      }
    } else {
      page.drawText(pageNumber, {
        x: (PAGE_WIDTH - font.widthOfTextAtSize(pageNumber, footerSize)) / 2,
        y: 30,
        size: footerSize,
        font,
        color: muted,
      });
    }
  });

  return Buffer.from(await pdf.save());
}
