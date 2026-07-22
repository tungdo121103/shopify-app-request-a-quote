import {
  QUOTE_MESSAGE_MAX_ATTACHMENTS,
  QUOTE_MESSAGE_MAX_TOTAL_FILE_BYTES,
  validateQuoteAttachmentMetadata,
  validateQuoteFileSignature,
} from "~/lib/quote-message-policy";

export async function readMessageAttachments(formData: FormData) {
  const rawFiles = formData.getAll("attachments");
  if (rawFiles.length > QUOTE_MESSAGE_MAX_ATTACHMENTS) {
    throw new Response(
      `A message can include at most ${QUOTE_MESSAGE_MAX_ATTACHMENTS} files.`,
      { status: 400 },
    );
  }

  let totalSize = 0;
  const files = rawFiles.map(async (value) => {
    if (
      !value ||
      typeof value !== "object" ||
      !("name" in value) ||
      !("size" in value)
    ) {
      return null;
    }

    const file = value as File;
    if (!file.name || file.size <= 0) return null;
    const type = file.type || "application/octet-stream";
    const validationError = validateQuoteAttachmentMetadata(
      file.name,
      type,
      file.size,
    );
    if (validationError) throw new Response(validationError, { status: 400 });

    totalSize += file.size;
    if (totalSize > QUOTE_MESSAGE_MAX_TOTAL_FILE_BYTES) {
      throw new Response("Total attachment size must be 15 MB or smaller.", {
        status: 400,
      });
    }

    const fileBuffer = await file.arrayBuffer();
    const signatureError = validateQuoteFileSignature(
      file.name,
      new Uint8Array(fileBuffer, 0, Math.min(fileBuffer.byteLength, 16)),
    );
    if (signatureError) {
      throw new Response(signatureError, { status: 400 });
    }

    return {
      fileName: file.name,
      fileUrl: `data:${type};base64,${Buffer.from(fileBuffer).toString("base64")}`,
      mimeType: `${type};size=${file.size}`,
    };
  });

  const attachments = await Promise.all(files);
  return attachments.filter((file): file is NonNullable<typeof file> =>
    Boolean(file),
  );
}
