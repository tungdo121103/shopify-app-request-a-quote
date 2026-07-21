import type { ActionFunctionArgs } from "react-router";
import {
  requestActorHash,
  requestIpHash,
} from "~/lib/request-identity.server";
import { readMessageAttachments } from "~/lib/quote-message-upload.server";
import { addMessage } from "~/models/quote.server";
import { authenticate } from "~/shopify.server";

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const quoteId = params.quoteId ?? "";

  try {
    const formData = await request.formData();
    const message = String(formData.get("message") ?? "").trim();
    const attachments = await readMessageAttachments(formData);
    if (!message && attachments.length === 0) {
      return Response.json(
        { ok: false, error: "Message or attachment is required." },
        { status: 400 },
      );
    }

    const chatMessage = await addMessage({
      quoteId,
      shop: session.shop,
      sender: "MANAGER",
      senderName: "Manager",
      message,
      clientMessageId: String(formData.get("clientMessageId") ?? ""),
      sourceIpHash: requestIpHash(request),
      sourceActorHash: requestActorHash(
        `${session.shop}:manager:${session.id}`,
      ),
      attachments,
    });

    return Response.json({ ok: true, chatMessage });
  } catch (error) {
    if (error instanceof Response) {
      const retryAfter = error.headers.get("Retry-After");
      return Response.json(
        { ok: false, error: await error.text() },
        {
          status: error.status,
          headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
        },
      );
    }

    console.error("[RFQ] Could not send merchant message.", error);
    return Response.json(
      {
        ok: false,
        error: "Message couldn’t be sent. Please try again.",
      },
      { status: 500 },
    );
  }
};
