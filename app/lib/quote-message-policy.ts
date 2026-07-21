export const QUOTE_MESSAGE_MAX_LENGTH = 5_000;
export const QUOTE_MESSAGE_MAX_ATTACHMENTS = 5;
export const QUOTE_MESSAGE_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const QUOTE_MESSAGE_MAX_TOTAL_FILE_BYTES = 15 * 1024 * 1024;
export const QUOTE_MESSAGE_BURST_LIMIT = 8;
export const QUOTE_MESSAGE_MINUTE_LIMIT = 30;
export const QUOTE_MESSAGE_SHOP_MINUTE_LIMIT = 300;

const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const allowedExtensions = new Set(["png", "jpg", "jpeg", "pdf", "doc", "docx"]);

type MessageAttachment = {
  fileName: string;
  fileUrl: string;
  mimeType?: string;
};

function attachmentSize(attachment: MessageAttachment) {
  const declaredSize = attachment.mimeType
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("size="))
    ?.slice(5);
  const parsedSize = Number(declaredSize || 0);
  if (Number.isFinite(parsedSize) && parsedSize > 0) return parsedSize;

  const base64 = attachment.fileUrl.match(/^data:[^;,]+;base64,(.+)$/)?.[1];
  if (!base64) return 0;
  return Math.floor((base64.length * 3) / 4) -
    (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
}

export function validateQuoteAttachmentMetadata(
  fileName: string,
  mimeType: string,
  size: number,
) {
  const hasControlCharacter = Array.from(fileName).some(
    (character) => character.charCodeAt(0) < 32,
  );
  if (
    !fileName ||
    fileName.length > 180 ||
    /[/\\]/.test(fileName) ||
    hasControlCharacter ||
    fileName === "." ||
    fileName === ".."
  ) {
    return "File name is invalid.";
  }
  const normalizedMime = mimeType.split(";")[0].trim().toLowerCase();
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (
    !allowedMimeTypes.has(normalizedMime) ||
    !allowedExtensions.has(extension)
  ) {
    return `File type is not allowed: ${fileName}`;
  }
  if (!Number.isFinite(size) || size <= 0) {
    return `File size is invalid: ${fileName}`;
  }
  if (size > QUOTE_MESSAGE_MAX_FILE_BYTES) {
    return `Each file must be 5 MB or smaller: ${fileName}`;
  }
  return null;
}

function startsWithBytes(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function validateQuoteFileSignature(
  fileName: string,
  bytes: Uint8Array,
) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const valid =
    extension === "png"
      ? startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      : extension === "jpg" || extension === "jpeg"
        ? startsWithBytes(bytes, [0xff, 0xd8, 0xff])
        : extension === "pdf"
          ? startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46])
          : extension === "doc"
            ? startsWithBytes(bytes, [
                0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
              ])
            : extension === "docx"
              ? startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
                startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
                startsWithBytes(bytes, [0x50, 0x4b, 0x07, 0x08])
              : false;
  return valid ? null : `File content does not match its type: ${fileName}`;
}

function dataUrlPrefix(fileUrl: string) {
  const base64 = fileUrl.match(/^data:[^;,]+;base64,([a-zA-Z0-9+/=]+)/)?.[1];
  if (!base64) return null;
  try {
    const decoded = atob(base64.slice(0, 24));
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export function validateQuoteMessage(input: {
  message: string;
  attachments?: MessageAttachment[];
}) {
  const message = input.message.trim();
  const attachments = input.attachments ?? [];
  if (!message && attachments.length === 0) {
    return "Message or attachment is required.";
  }
  if (message.length > QUOTE_MESSAGE_MAX_LENGTH) {
    return `Message must be ${QUOTE_MESSAGE_MAX_LENGTH.toLocaleString()} characters or fewer.`;
  }
  if (attachments.length > QUOTE_MESSAGE_MAX_ATTACHMENTS) {
    return `A message can include at most ${QUOTE_MESSAGE_MAX_ATTACHMENTS} files.`;
  }

  let totalSize = 0;
  for (const attachment of attachments) {
    const size = attachmentSize(attachment);
    const metadataError = validateQuoteAttachmentMetadata(
      attachment.fileName,
      attachment.mimeType || "",
      size,
    );
    if (metadataError) return metadataError;
    const prefix = dataUrlPrefix(attachment.fileUrl);
    if (!prefix) return `File content is invalid: ${attachment.fileName}`;
    const signatureError = validateQuoteFileSignature(
      attachment.fileName,
      prefix,
    );
    if (signatureError) return signatureError;
    totalSize += size;
  }
  if (totalSize > QUOTE_MESSAGE_MAX_TOTAL_FILE_BYTES) {
    return "Total attachment size must be 15 MB or smaller.";
  }
  return null;
}

export function normalizeClientMessageId(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (!/^[a-zA-Z0-9:_-]{8,120}$/.test(normalized)) {
    throw new Response("Invalid client message ID.", { status: 400 });
  }
  return normalized;
}
