import { redirect, type ActionFunctionArgs } from "react-router";
import {
  addMessage,
  deleteQuote,
  getQuote,
  updateQuoteStatus,
} from "~/models/quote.server";
import { authenticate } from "~/shopify.server";

export async function handleQuoteListAction({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const quoteId = String(formData.get("quoteId") ?? "");
  const quoteIds = formData.getAll("quoteIds").map(String).filter(Boolean);

  if (intent === "delete" && quoteId) {
    await deleteQuote(session.shop, quoteId);
    return { ok: true };
  }

  if (intent === "reopen" && quoteId) {
    const quote = await getQuote(session.shop, quoteId);
    if (quote && (quote.status === "DECLINED" || String(quote.status) === "EXPIRED")) {
      await updateQuoteStatus(session.shop, quoteId, "NEGOTIATING");
      await addMessage({
        quoteId,
        shop: session.shop,
        sender: "MANAGER",
        senderName: "Manager",
        message: "The quote was reopened.",
        messageType: "SYSTEM",
        eventType: "QUOTE_REOPENED",
      });
      return { ok: true, quoteId, status: "NEGOTIATING" };
    }
    return { ok: false, error: "This quote cannot be reopened." };
  }

  if (intent === "revise" && quoteId) {
    const quote = await getQuote(session.shop, quoteId);
    if (quote?.status === "OFFERED_BY_MERCHANT") {
      await updateQuoteStatus(session.shop, quoteId, "NEGOTIATING");
      await addMessage({
        quoteId,
        shop: session.shop,
        sender: "MANAGER",
        senderName: "Manager",
        message: "The offer is being revised.",
        messageType: "SYSTEM",
        eventType: "OFFER_REVISION_STARTED",
      });
      return { ok: true, quoteId, status: "NEGOTIATING" };
    }
    return { ok: false, error: "This quote cannot be revised." };
  }

  if (intent === "bulk-delete" && quoteIds.length) {
    await Promise.all(quoteIds.map((id) => deleteQuote(session.shop, id)));
    return { ok: true };
  }

  return redirect("/app/quotes");
}
