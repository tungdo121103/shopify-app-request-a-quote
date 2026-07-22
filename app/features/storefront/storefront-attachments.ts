import type { QuoteAttachmentInput } from "~/features/storefront/storefront.types";

export function normalizeStorefrontAttachments(value: unknown): QuoteAttachmentInput[] {
  const files = Array.isArray(value) ? value : value ? [value] : [];

  return files
    .filter((attachment): attachment is Record<string, unknown> =>
      Boolean(attachment) && typeof attachment === "object",
    )
    .reduce<QuoteAttachmentInput[]>((normalized, file) => {
      const fileName = String(file.name ?? file.fileName ?? "").trim();
      if (!fileName) return normalized;
      normalized.push({
        fileName,
        fileUrl: String(
          file.fileUrl ?? file.dataUrl ?? file.preview ??
            `local://${encodeURIComponent(fileName)}`,
        ),
        mimeType: [
          String(file.type ?? file.mimeType ?? "").split(";")[0],
          Number(file.size) > 0 ? `size=${Number(file.size)}` : "",
        ].filter(Boolean).join(";"),
      });
      return normalized;
    }, []);
}
