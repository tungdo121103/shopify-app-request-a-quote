import { requestActorHash, requestIpHash } from "~/lib/request-identity.server";
import { readMessageAttachments } from "~/features/quotes/conversation/quote-message-upload.server";
import { addMessage } from "~/models/quote.server";
import type { QuoteDetailActionContext } from "~/features/quotes/quote-detail-action.types";

export async function handleQuoteMessageAction(context: QuoteDetailActionContext) {
  const message = String(context.formData.get("message") ?? "").trim();
  const attachments = await readMessageAttachments(context.formData);
  if (!message && attachments.length === 0) {
    return { ok: false, error: "Message or attachment is required." };
  }

  const chatMessage = await addMessage({
    quoteId: context.quoteId,
    shop: context.shop,
    sender: "MANAGER",
    senderName: "Manager",
    message,
    clientMessageId: String(context.formData.get("clientMessageId") ?? ""),
    sourceIpHash: requestIpHash(context.request),
    sourceActorHash: requestActorHash(
      `${context.shop}:manager:${context.sessionId}`,
    ),
    attachments,
  });
  return { ok: true, message: "Message sent.", chatMessage };
}
