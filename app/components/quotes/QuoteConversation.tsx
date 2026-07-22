import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Form, useLocation, useNavigation, useRevalidator } from "react-router";
import { QUOTE_MESSAGE_MAX_LENGTH } from "~/lib/quote-message-policy";
import {
  InvalidMessageResponseError,
  attachmentMeta,
  fetchMessageWithRetry,
  isSystemQuoteMessage,
  messageTime,
  readMessageActionResponse,
  shouldShowMessageTime,
  type ConversationMessage,
} from "~/features/quotes/quote-conversation";
import pageStyles from "~/styles/quote-detail.module.css";
import sharedStyles from "~/styles/shared.module.css";

const styles = { ...sharedStyles, ...pageStyles };

type QuoteConversationProps = {
  focusOnMount: boolean;
  messages: ConversationMessage[];
  quoteId: string;
  quoteStatus: string;
};

export function QuoteConversation({ focusOnMount, messages, quoteId, quoteStatus }: QuoteConversationProps) {
  const location = useLocation();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const sendQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Array<{ file: File; preview?: string }>>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<ConversationMessage[]>([]);
  const [sendError, setSendError] = useState("");
  const isSubmitting = navigation.state === "submitting";
  const hasContent = draft.trim().length > 0 || attachments.length > 0;
  const displayedMessages = useMemo(() => {
    const serverIds = new Set(messages.map((message) => message.id));
    return [...messages, ...optimisticMessages.filter((message) => !serverIds.has(message.id))];
  }, [messages, optimisticMessages]);

  const updateAttachments = (files: File[]) => {
    setAttachments(files.map((file) => ({ file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined })));
    if (!fileInputRef.current) return;
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    fileInputRef.current.files = transfer.files;
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || revalidator.state !== "idle" || navigation.state !== "idle" || attachments.length > 0) return;
      revalidator.revalidate();
    }, 1500);
    const revalidateOnFocus = () => {
      if (revalidator.state === "idle" && navigation.state === "idle" && attachments.length === 0) revalidator.revalidate();
    };
    window.addEventListener("focus", revalidateOnFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", revalidateOnFocus);
    };
  }, [attachments.length, navigation.state, revalidator]);

  useEffect(() => {
    if (!focusOnMount) return;
    panelRef.current?.scrollIntoView({ block: "nearest" });
    inputRef.current?.focus();
  }, [focusOnMount]);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [displayedMessages.length]);

  return (
    <section className={styles.merchantConversation} ref={panelRef}>
      <h2>Conversation</h2>
      {quoteStatus === "REQUESTED_BY_CUSTOMER" ? <div className={styles.quoteDetailConversationBanner}>Reply here to start negotiation</div> : null}
      <div className={styles.quoteDetailMessages} ref={messagesRef}>
        {displayedMessages.length === 0 ? <div className={styles.quoteDetailEmptyMessage}>No messages yet.</div> : (
          <>
            <div className={styles.quoteDetailDatePill}>Today</div>
            {displayedMessages.map((message, index) => {
              const isSystem = isSystemQuoteMessage(message.message, message.messageType);
              return (
                <article className={`${styles.quoteDetailMessage} ${isSystem ? styles.quoteDetailMessageSystem : message.sender === "MANAGER" ? styles.quoteDetailMessageManager : styles.quoteDetailMessageCustomer}`} key={message.id}>
                  {message.attachments.length > 0 ? (
                    <div className={styles.quoteDetailMessageAttachments}>
                      {message.attachments.map((file) => {
                        const meta = attachmentMeta(file);
                        return (
                          <a className={styles.quoteDetailMessageAttachment} download={file.fileName} href={file.fileUrl} key={file.id}>
                            <div className={styles.quoteDetailMessageAttachmentThumb}>{meta.isImage ? <img alt={file.fileName} src={file.fileUrl} /> : <span>{meta.extension}</span>}</div>
                            <div><strong>{file.fileName}</strong><small>{[meta.extension, meta.fileSize].filter(Boolean).join(" • ")}</small></div>
                          </a>
                        );
                      })}
                    </div>
                  ) : null}
                  {message.message ? <div className={styles.quoteDetailMessageBubble}>{message.message}</div> : null}
                  {shouldShowMessageTime(displayedMessages, index) ? <span>{messageTime(message.createdAt, index === displayedMessages.length - 1)}</span> : null}
                </article>
              );
            })}
          </>
        )}
      </div>
      {sendError ? <div className={`${styles.notice} ${styles.noticeError}`} role="alert">{sendError}</div> : null}
      <Form
        className={`${styles.quoteDetailComposer} ${hasContent ? styles.quoteDetailComposerActive : ""}`}
        encType="multipart/form-data"
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          const message = draft.trim();
          if (!message && attachments.length === 0) return;
          setSendError("");
          const formData = new FormData(event.currentTarget);
          const attachmentsToSend = [...attachments];
          const now = new Date();
          const clientMessageId = `message-${now.getTime()}-${Math.random().toString(36).slice(2)}`;
          const optimisticMessageId = `optimistic-${clientMessageId}`;
          formData.set("clientMessageId", clientMessageId);
          const optimisticMessage: ConversationMessage = {
            id: optimisticMessageId,
            clientMessageId,
            quoteId,
            sender: "MANAGER",
            senderName: "Manager",
            message,
            createdAt: now,
            attachments: attachmentsToSend.map((attachment, index) => ({
              id: `optimistic-file-${now.getTime()}-${index}`,
              quoteId,
              messageId: `optimistic-${now.getTime()}`,
              fileName: attachment.file.name,
              fileUrl: attachment.preview ?? "",
              mimeType: `${attachment.file.type || "application/octet-stream"};size=${attachment.file.size}`,
              createdAt: now,
            })),
          };
          flushSync(() => setOptimisticMessages((current) => [...current, optimisticMessage]));
          setDraft("");
          setAttachments([]);
          queueMicrotask(() => {
            if (fileInputRef.current) fileInputRef.current.value = "";
            inputRef.current?.focus();
          });

          const sendMessage = async () => {
            let result: { ok?: boolean; error?: string; chatMessage?: ConversationMessage } | null = null;
            for (let attempt = 0; attempt < 2; attempt += 1) {
              const response = await fetchMessageWithRetry(`${location.pathname.replace(/\/$/, "")}/messages${location.search}`, {
                method: "POST",
                body: formData,
                credentials: "same-origin",
                headers: { Accept: "application/json" },
              });
              try {
                result = await readMessageActionResponse(response);
                break;
              } catch (error) {
                if (!(error instanceof InvalidMessageResponseError) || error.sessionExpired || attempt === 1) throw error;
                await new Promise((resolve) => window.setTimeout(resolve, 500));
              }
            }
            if (!result?.ok || !result.chatMessage) throw new Error(result?.error || "Message couldn’t be sent. Please try again.");
            setOptimisticMessages((current) => current.map((item) => item.id === optimisticMessageId ? result.chatMessage! : item));
          };

          const queuedSend = sendQueueRef.current.catch(() => undefined).then(sendMessage);
          sendQueueRef.current = queuedSend.then(() => undefined, () => undefined);
          void queuedSend.catch((error) => {
            setOptimisticMessages((current) => current.filter((item) => item.id !== optimisticMessageId));
            setDraft((current) => current ? `${message}\n${current}` : message);
            setAttachments((current) => {
              const next = [...attachmentsToSend, ...current];
              queueMicrotask(() => {
                if (!fileInputRef.current) return;
                const transfer = new DataTransfer();
                next.forEach((attachment) => transfer.items.add(attachment.file));
                fileInputRef.current.files = transfer.files;
              });
              return next;
            });
            setSendError(error instanceof InvalidMessageResponseError ? error.sessionExpired ? "Your session has expired. Refresh the app to continue." : "Message couldn’t be sent. Please try again." : error instanceof Error ? error.message : "Message couldn’t be sent. Please try again.");
          });
        }}
      >
        <input name="intent" type="hidden" value="message" />
        <input accept=".png,.pdf,.jpg,.jpeg,.doc,.docx" hidden multiple name="attachments" onChange={(event) => updateAttachments(Array.from(event.currentTarget.files ?? []))} ref={fileInputRef} type="file" />
        {attachments.length > 0 ? (
          <div className={styles.quoteDetailComposerFiles}>
            {attachments.map((attachment, index) => (
              <div className={styles.quoteDetailComposerFileTile} key={`${attachment.file.name}-${attachment.file.size}-${index}`} title={attachment.file.name}>
                {attachment.preview ? <img alt={attachment.file.name} src={attachment.preview} /> : <span>{attachment.file.name.split(".").pop()?.toUpperCase() || "FILE"}</span>}
                <button aria-label={`Remove ${attachment.file.name}`} onClick={() => updateAttachments(attachments.filter((_, fileIndex) => fileIndex !== index).map((item) => item.file))} type="button">×</button>
              </div>
            ))}
          </div>
        ) : null}
        <textarea maxLength={QUOTE_MESSAGE_MAX_LENGTH} name="message" onChange={(event) => setDraft(event.currentTarget.value)} onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }} placeholder="Type a message..." ref={inputRef} value={draft} />
        <div className={styles.quoteDetailComposerActions}>
          <button aria-label="Attach file" onClick={() => fileInputRef.current?.click()} title="Attach file" type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m21.4 11.6-8.8 8.8a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.8-8.8" /></svg>
            📎
          </button>
          <button disabled={isSubmitting} title="Send" type="submit">↑</button>
        </div>
      </Form>
    </section>
  );
}
