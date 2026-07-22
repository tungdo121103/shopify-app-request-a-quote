export type QuoteAttachment = {
  createdAt: string | Date;
  fileName: string;
  fileUrl: string;
  id: string;
  messageId?: string | null;
  mimeType?: string | null;
  quoteId: string;
};

export type ConversationMessage = {
  attachments: QuoteAttachment[];
  clientMessageId?: string | null;
  createdAt: string | Date;
  id: string;
  message: string;
  messageType?: string | null;
  quoteId: string;
  sender: string;
  senderName?: string | null;
};

export class InvalidMessageResponseError extends Error {
  sessionExpired: boolean;

  constructor(sessionExpired: boolean) {
    super("The message server returned an invalid response.");
    this.name = "InvalidMessageResponseError";
    this.sessionExpired = sessionExpired;
  }
}

export async function fetchMessageWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (response.status < 500 || attempt === 1) return response;
      lastError = new Error(`Message server returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
      if (attempt === 1) throw error;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError instanceof Error ? lastError : new Error("Message send failed.");
}

export async function readMessageActionResponse(response: Response) {
  const responseText = await response.text();
  const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
  const looksLikeJson =
    contentType.includes("application/json") ||
    responseText.trimStart().startsWith("{");
  if (looksLikeJson) {
    try {
      return JSON.parse(responseText) as {
        ok?: boolean;
        error?: string;
        chatMessage?: ConversationMessage;
      };
    } catch {
      // The caller retries malformed responses with the same idempotency key.
    }
  }
  const responseUrl = response.url.toLowerCase();
  throw new InvalidMessageResponseError(
    response.redirected ||
      response.status === 401 ||
      response.status === 403 ||
      responseUrl.includes("/auth") ||
      responseUrl.includes("/login"),
  );
}

export function isSystemQuoteMessage(message: string, messageType?: string | null) {
  return (
    messageType === "SYSTEM" ||
    message.startsWith("The seller ") ||
    message.startsWith("The customer ") ||
    message === "A new price offer has been sent."
  );
}

export function messageTime(value: string | Date, isLatest = false) {
  const date = new Date(value || Date.now());
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  if (isLatest && isSameDay) return `Today ${time}`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function shouldShowMessageTime(messages: ConversationMessage[], index: number) {
  const current = messages[index];
  const next = messages[index + 1];
  if (!current || !next || current.sender !== next.sender) return true;
  const currentTime = new Date(current.createdAt).getTime();
  const nextTime = new Date(next.createdAt).getTime();
  return (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(nextTime) ||
    nextTime - currentTime > 5 * 60 * 1000
  );
}

export function attachmentMeta(file: QuoteAttachment) {
  const [mimeType = "", ...params] = String(file.mimeType ?? "").split(";");
  const sizeParam = params
    .map((param) => param.trim())
    .find((param) => param.startsWith("size="));
  const extension =
    file.fileName.split(".").pop()?.toUpperCase() ||
    mimeType.split("/").pop()?.toUpperCase() ||
    "FILE";
  const size = sizeParam ? Number(sizeParam.slice("size=".length)) : 0;
  return {
    extension,
    fileSize: formatFileSize(size),
    isImage: mimeType.startsWith("image/") && file.fileUrl.startsWith("data:image/"),
  };
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}
