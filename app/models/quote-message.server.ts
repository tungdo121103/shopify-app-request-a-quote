import { Prisma, type MessageSender } from "@prisma/client";
import prisma from "~/db.server";
import {
  normalizeClientMessageId,
  QUOTE_MESSAGE_BURST_LIMIT,
  QUOTE_MESSAGE_MINUTE_LIMIT,
  QUOTE_MESSAGE_SHOP_MINUTE_LIMIT,
  validateQuoteMessage,
} from "~/lib/quote-message-policy";
import { quoteToEmailContext } from "~/features/email/rendering/quote-email-context";
import { queueQuoteNotification } from "~/features/email/quote-email.server";
import { getQuote } from "~/models/quote-query.server";

export async function addMessage(input: {
  quoteId: string;
  shop: string;
  sender: MessageSender;
  senderName?: string;
  message: string;
  messageType?: "USER" | "SYSTEM";
  eventType?: string;
  clientMessageId?: string | null;
  sourceIpHash?: string | null;
  sourceActorHash?: string | null;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    mimeType?: string;
  }>;
}) {
  const clientMessageId = normalizeClientMessageId(input.clientMessageId);
  const normalizedMessage = input.message.trim();
  const validationError = validateQuoteMessage({
    message: normalizedMessage,
    attachments: input.attachments,
  });
  if (validationError) throw new Response(validationError, { status: 400 });

  const quote = await prisma.quote.findFirst({
    where: { id: input.quoteId, shop: input.shop },
    select: { id: true, status: true },
  });
  if (!quote) throw new Response("Quote not found", { status: 404 });
  if (clientMessageId) {
    const existingMessage = await prisma.conversationMessage.findFirst({
      where: { quoteId: quote.id, sender: input.sender, clientMessageId },
      include: { attachments: true },
    });
    if (existingMessage) return existingMessage;
  }
  if (
    (input.messageType ?? "USER") === "USER" &&
    quote.status === "CONVERTED_TO_ORDER"
  ) {
    throw new Response("This quote is closed and can no longer receive messages.", {
      status: 409,
    });
  }

  if ((input.messageType ?? "USER") === "USER") {
    const now = Date.now();
    const minuteAgo = new Date(now - 60_000);
    const burstAgo = new Date(now - 10_000);
    const [burstCount, minuteCount, shopCount, ipCount, actorCount] =
      await Promise.all([
      prisma.conversationMessage.count({
        where: {
          quoteId: quote.id,
          sender: input.sender,
          messageType: "USER",
          createdAt: { gte: burstAgo },
        },
      }),
      prisma.conversationMessage.count({
        where: {
          quoteId: quote.id,
          sender: input.sender,
          messageType: "USER",
          createdAt: { gte: minuteAgo },
        },
      }),
      prisma.conversationMessage.count({
        where: {
          quote: { shop: input.shop },
          messageType: "USER",
          createdAt: { gte: minuteAgo },
        },
      }),
      input.sourceIpHash
        ? prisma.conversationMessage.count({
            where: {
              sourceIpHash: input.sourceIpHash,
              messageType: "USER",
              createdAt: { gte: minuteAgo },
            },
          })
        : Promise.resolve(0),
      input.sourceActorHash
        ? prisma.conversationMessage.count({
            where: {
              sourceActorHash: input.sourceActorHash,
              messageType: "USER",
              createdAt: { gte: minuteAgo },
            },
          })
        : Promise.resolve(0),
    ]);
    if (
      burstCount >= QUOTE_MESSAGE_BURST_LIMIT ||
      minuteCount >= QUOTE_MESSAGE_MINUTE_LIMIT ||
      ipCount >= QUOTE_MESSAGE_MINUTE_LIMIT ||
      actorCount >= QUOTE_MESSAGE_MINUTE_LIMIT ||
      shopCount >= QUOTE_MESSAGE_SHOP_MINUTE_LIMIT
    ) {
      throw new Response("Too many messages. Please wait and try again.", {
        status: 429,
        headers: { "Retry-After": "10" },
      });
    }
  }

  const createMessage = () => prisma.$transaction(async (tx) => {
    if (clientMessageId) {
      const duplicate = await tx.conversationMessage.findFirst({
        where: { quoteId: quote.id, sender: input.sender, clientMessageId },
        include: { attachments: true },
      });
      if (duplicate) return { message: duplicate, negotiationStarted: false };
    }
    const message = await tx.conversationMessage.create({
      data: {
        quoteId: quote.id,
        clientMessageId,
        sourceIpHash: input.sourceIpHash,
        sourceActorHash: input.sourceActorHash,
        sender: input.sender,
        senderName: input.senderName,
        message: normalizedMessage,
        messageType: input.messageType ?? "USER",
        eventType: input.eventType,
      },
    });

    if (input.attachments?.length) {
      await tx.quoteAttachment.createMany({
        data: input.attachments.map((attachment) => ({
          ...attachment,
          quoteId: quote.id,
          messageId: message.id,
        })),
      });
    }

    const negotiationStarted = input.sender === "MANAGER"
      ? (await tx.quote.updateMany({
          where: { id: quote.id, status: "REQUESTED_BY_CUSTOMER" },
          data: { status: "NEGOTIATING", expiresAt: null },
        })).count === 1
      : false;

    const storedMessage = await tx.conversationMessage.findUniqueOrThrow({
      where: { id: message.id },
      include: { attachments: true },
    });
    return { message: storedMessage, negotiationStarted };
  });

  let result;
  try {
    result = await createMessage();
  } catch (error) {
    if (clientMessageId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const duplicate = await prisma.conversationMessage.findFirst({
        where: { quoteId: quote.id, sender: input.sender, clientMessageId },
        include: { attachments: true },
      });
      if (duplicate) return duplicate;
    }
    throw error;
  }

  if (result.negotiationStarted) {
    const fullQuote = await getQuote(input.shop, input.quoteId);
    if (fullQuote) {
      await queueQuoteNotification({
        shop: input.shop,
        quote: quoteToEmailContext(fullQuote),
        templateKey: "negotiation_started",
        idempotencyKey: `${input.shop}:${input.quoteId}:negotiation_started`,
      });
    }
  }

  return result.message;
}
