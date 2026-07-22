  function formatMessageTime(value, isLatest = false) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const now = new Date();
    const isSameDay = (left, right) =>
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate();
    const time = date.toLocaleTimeString(currentLocale(), {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    if (isLatest && isSameDay(date, now)) return `${t("today")} ${time}`;
    return `${date.toLocaleDateString(currentLocale(), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })} ${time}`;
  }

  function shouldShowMessageTime(messages, index) {
    const current = messages[index];
    const next = messages[index + 1];
    if (!current || !next) return true;
    if (current.sender !== next.sender) return true;

    const currentTime = new Date(current.createdAt).getTime();
    const nextTime = new Date(next.createdAt).getTime();
    if (!Number.isFinite(currentTime) || !Number.isFinite(nextTime)) return true;

    return nextTime - currentTime > 5 * 60 * 1000;
  }

  function formatFileSize(bytes = 0) {
    const size = Number(bytes || 0);
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
    if (size >= 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${size} B`;
  }

  const allowedAttachmentExtensions = [".png", ".pdf", ".jpg", ".jpeg", ".doc", ".docx"];
  const maxChatMessageLength = 5000;
  const maxChatAttachments = 5;
  const maxChatFileBytes = 5 * 1024 * 1024;
  const maxChatTotalFileBytes = 15 * 1024 * 1024;

  function isAllowedAttachmentFile(file) {
    const lowerName = file.name.toLowerCase();
    return allowedAttachmentExtensions.some((extension) =>
      lowerName.endsWith(extension),
    );
  }

  function fileToAttachment(file) {
    return new Promise((resolve) => {
      const base = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      };
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const dataUrl = String(reader.result || "");
        resolve({
          ...base,
          dataUrl,
          fileUrl: dataUrl,
          preview: file.type?.startsWith("image/") ? dataUrl : undefined,
        });
      });
      reader.addEventListener("error", () => resolve(base));
      reader.readAsDataURL(file);
    });
  }

  function renderMessageAttachments(attachments = []) {
    if (!attachments.length) return "";
    return `<div class="sp-rfq-message-attachments">
      ${attachments
        .map((file) => {
          const fileName = file.name || file.fileName || "Attachment";
          const rawType = String(file.type || file.mimeType || "").split(";")[0];
          const rawSize = String(file.mimeType || "")
            .split(";")
            .find((part) => part.trim().startsWith("size="));
          const size = Number(file.size || rawSize?.split("=")[1] || 0);
          const extension =
            fileName.split(".").pop()?.toUpperCase() ||
            rawType.split("/").pop()?.toUpperCase() ||
            "FILE";
          const fileUrl = file.dataUrl || file.fileUrl || file.preview || "";
          const isImage =
            (file.preview || fileUrl.startsWith("data:image/")) &&
            rawType.startsWith("image/");
          const content = `<div class="sp-rfq-message-attachment">
            <div class="sp-rfq-message-attachment-thumb">
              ${
                isImage
                  ? `<img src="${escapeHtml(file.preview || fileUrl)}" alt="${escapeHtml(fileName)}">`
                  : `<span>${escapeHtml(extension)}</span>`
              }
            </div>
            <div>
              <strong>${escapeHtml(fileName)}</strong>
              <small>${escapeHtml(extension)} • ${escapeHtml(formatFileSize(size))}</small>
            </div>
          </div>`;
          return fileUrl
            ? `<a class="sp-rfq-message-attachment-link" href="${escapeHtml(fileUrl)}" download="${escapeHtml(fileName)}">${content}</a>`
            : content;
        })
        .join("")}
    </div>`;
  }

  function isSystemQuoteMessage(message = "", messageType = "") {
    if (messageType === "SYSTEM") return true;
    return (
      String(message).startsWith("The seller ") ||
      String(message).startsWith("The customer ") ||
      String(message) === "A new price offer has been sent."
    );
  }

  function buildChatMessagesHtml(messages) {
    if (!messages.length) return "";
    return messages
      .map(
        (message, index) => `<div class="sp-rfq-message-row ${
          message.sender === "CUSTOMER" ? "is-customer" : ""
        } ${(message.attachments || []).length ? "has-attachments" : ""} ${
          message.optimistic ? "is-optimistic" : ""
        } ${isSystemQuoteMessage(message.message, message.messageType) ? "is-system" : ""}">
          ${renderMessageAttachments(message.attachments || [])}
          ${
            message.message
              ? `<div class="sp-rfq-message">${escapeHtml(message.message)}</div>`
              : ""
          }
          ${
            shouldShowMessageTime(messages, index)
              ? `<small class="sp-rfq-message-time">${escapeHtml(
                  formatMessageTime(
                    message.createdAt,
                    index === messages.length - 1,
                  ),
                )}</small>`
              : ""
          }
        </div>`,
      )
      .join("");
  }

  function getDisplayMessagesForQuote(quote, quoteId) {
    const confirmedMessages = [
      ...(quote.messages || []),
      ...readLocalChatAttachments(String(quoteId)),
    ]
      .filter((message) => message.message || (message.attachments || []).length)
      .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
    const optimisticMessages =
      optimisticChatMessages.get(String(quoteId)) || [];

    return [...confirmedMessages, ...optimisticMessages];
  }

  async function refreshQuoteDetailMessages(id) {
    if (quoteDetailMessageRefreshInFlight) return;
    const quoteId = String(id);
    if (activeQuoteDetailId !== quoteId) return;
    const modal = document.querySelector(".sp-rfq-modal");
    const chatMessages = modal?.querySelector(".sp-rfq-chat-messages");
    if (!modal || !chatMessages) return;

    const config = getConfig();
    quoteDetailMessageRefreshInFlight = true;
    try {
      let quote;
      if (String(id).startsWith("local-")) {
        quote = read(historyStorageKey(), []).find((item) => item.id === id);
      } else {
        const params = new URLSearchParams();
        if (config.customerEmail) {
          params.set("customerEmail", config.customerEmail);
        }
        const query = params.toString();
        const response = await fetch(
          `${config.proxyPath}/quotes/${id}${query ? `?${query}` : ""}`,
        );
        if (!response.ok) return;
        quote = (await response.json()).quote;
      }
      if (!quote || activeQuoteDetailId !== quoteId) return;
      activeQuoteDetail = quote;

      const wasNearBottom =
        chatMessages.scrollHeight -
          chatMessages.scrollTop -
          chatMessages.clientHeight <
        48;
      const previousScrollTop = chatMessages.scrollTop;
      const previousScrollHeight = chatMessages.scrollHeight;
      const messages = getDisplayMessagesForQuote(quote, id);

      chatMessages.innerHTML = buildChatMessagesHtml(messages);
      if (wasNearBottom) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } else {
        chatMessages.scrollTop =
          previousScrollTop +
          (chatMessages.scrollHeight - previousScrollHeight);
      }
    } finally {
      quoteDetailMessageRefreshInFlight = false;
    }
  }

  function readLocalChatAttachments(quoteId) {
    return read(chatAttachmentsStorageKey(), {})[quoteId] || [];
  }

  function saveLocalChatAttachmentMessage(quoteId, message) {
    const allAttachments = read(chatAttachmentsStorageKey(), {});
    allAttachments[quoteId] ||= [];
    allAttachments[quoteId].push(message);
    write(chatAttachmentsStorageKey(), allAttachments);
  }

  function renderChatAttachmentPreviews() {
    if (!selectedChatAttachments.length) return "";
    return `<div class="sp-rfq-chat-attachments">
      ${selectedChatAttachments
        .map((file, index) => {
          const isImage = file.type?.startsWith("image/") && file.preview;
          const label = file.name.split(".").pop()?.toUpperCase() || "FILE";
          return `<div class="sp-rfq-chat-attachment-tile" title="${escapeHtml(file.name)}">
            ${
              isImage
                ? `<img src="${escapeHtml(file.preview)}" alt="${escapeHtml(file.name)}">`
                : `<span class="sp-rfq-chat-file-icon">${escapeHtml(label)}</span>`
            }
            <button type="button" data-chat-file-remove="${index}" aria-label="Remove ${escapeHtml(file.name)}">&times;</button>
          </div>`;
        })
        .join("")}
    </div>`;
  }

  function renderCartAttachments() {
    if (!selectedAttachments.length) return "";
    return `<div class="sp-rfq-file-list">
      ${selectedAttachments
        .map(
          (file, index) => `<div class="sp-rfq-file-pill">
            <span>${escapeHtml(file.name)}</span>
            <button class="sp-rfq-file-remove" data-file-remove="${index}" type="button" aria-label="Remove ${escapeHtml(file.name)}">&times;</button>
          </div>`,
        )
        .join("")}
    </div>`;
  }

  function renderDetailProductBadges(item) {
    const badges = [];
    const inventoryStatus = String(item.inventoryStatus || "").toUpperCase();
    const isSoldOut =
      inventoryStatus === "OUT_OF_STOCK" ||
      inventoryStatus === "SOLD_OUT" ||
      item.available === false;
    const isSale =
      item.onSale === true ||
      item.sale === true ||
      Number(item.compareAtPrice || 0) > Number(item.unitPrice || 0);

    if (isSoldOut) badges.push({ label: t("outOfStock"), type: "sold-out" });
    if (isSale) badges.push({ label: t("sale"), type: "sale" });
    if (!badges.length) return "";

    return `<span class="sp-rfq-detail-badges">
      ${badges
        .map(
          (badge) =>
            `<span class="sp-rfq-detail-badge is-${badge.type}">${badge.label}</span>`,
        )
        .join("")}
    </span>`;
  }

  function formatQuoteStatus(status) {
    const key = String(status || "").toLowerCase();
    const statusTranslations = {
      requested_by_customer: t("requestedByCustomer"),
      negotiating: t("underNegotiation"),
      offered_by_merchant: t("sent"),
      sent: t("sent"),
      under_negotiation: t("underNegotiation"),
      accepted: t("accepted"),
      declined: t("declined"),
      expired: t("expired"),
    };
    if (statusTranslations[key]) return statusTranslations[key];
    const label = String(status || "")
      .toLowerCase()
      .replaceAll("_", " ")
      .split(" ")
      .filter(Boolean)
      .join(" ");
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
  }

  function quoteStatusTone(status) {
    const key = normalizeQuoteStatus(status);
    if (key === "ACCEPTED" || key === "CONVERTED_TO_ORDER") return "success";
    if (key === "DECLINED") return "critical";
    if (key === "EXPIRED") return "neutral";
    if (key === "NEGOTIATING" || key === "OFFERED_BY_MERCHANT" || key === "SENT") {
      return "info";
    }
    return "warning";
  }

  function normalizeQuoteStatus(status) {
    return String(status || "")
      .trim()
      .toUpperCase()
      .replaceAll(" ", "_");
  }

  function canBuyerRespondToQuote(status) {
    return normalizeQuoteStatus(status) === "OFFERED_BY_MERCHANT";
  }

  function stopQuoteDetailPolling() {
    if (quoteDetailPollTimer) {
      window.clearInterval(quoteDetailPollTimer);
      quoteDetailPollTimer = null;
    }
  }

  function readChatDraft(id, input) {
    const key = String(id);
    if (input) {
      if (input.value) {
        chatDrafts.set(key, input.value);
      } else {
        chatDrafts.delete(key);
      }
      return input.value;
    }
    return chatDrafts.get(key) || "";
  }

  function clearChatDraft(id) {
    chatDrafts.delete(String(id));
  }

  function addOptimisticChatMessage(quoteId, message) {
    const key = String(quoteId);
    optimisticChatMessages.set(key, [
      ...(optimisticChatMessages.get(key) || []),
      message,
    ]);
  }

  function removeOptimisticChatMessage(quoteId, messageId) {
    const key = String(quoteId);
    const nextMessages = (optimisticChatMessages.get(key) || []).filter(
      (message) => message.id !== messageId,
    );
    if (nextMessages.length) {
      optimisticChatMessages.set(key, nextMessages);
    } else {
      optimisticChatMessages.delete(key);
    }
  }

  function hasPendingChatMessages(quoteId) {
    return (sendingMessageCounts.get(String(quoteId)) || 0) > 0;
  }

  function startSendingChatMessage(quoteId) {
    const key = String(quoteId);
    sendingMessageCounts.set(key, (sendingMessageCounts.get(key) || 0) + 1);
  }

  function finishSendingChatMessage(quoteId) {
    const key = String(quoteId);
    const next = Math.max(0, (sendingMessageCounts.get(key) || 0) - 1);
    if (next) sendingMessageCounts.set(key, next);
    else sendingMessageCounts.delete(key);
  }

  function startQuoteDetailPolling(id) {
    stopQuoteDetailPolling();
    quoteDetailPollTimer = window.setInterval(() => {
      if (!activeQuoteDetailId || activeQuoteDetailId !== String(id)) {
        stopQuoteDetailPolling();
        return;
      }
      const activeElement = document.activeElement;
      const isTyping = activeElement?.matches?.(".sp-rfq-chat-input") ?? false;
      const hasDraft = Boolean(chatDrafts.get(String(id))?.trim());
      if (document.hidden) return;
      if (buyerStatusConfirmOpen || document.querySelector(".sp-rfq-confirm-backdrop")) return;
      if (isTyping || hasDraft) {
        refreshQuoteDetailMessages(id);
        return;
      }
      if (
        selectedChatAttachments.length > 0 ||
        hasPendingChatMessages(id)
      ) {
        return;
      }
      openQuoteDetail(id);
    }, 3000);
  }

  async function updateBuyerQuoteStatus(id, status) {
    const config = getConfig();
    if (String(id).startsWith("local-")) {
      const history = read(historyStorageKey(), []);
      const quote = history.find((item) => item.id === id);
      if (quote) {
        quote.status = status;
        quote.messages ||= [];
        quote.messages.push({
          id: `message-${Date.now()}`,
          sender: "CUSTOMER",
          senderName: config.customerName || "Customer",
          message:
            status === "ACCEPTED"
              ? "The customer accepted this quote."
              : "The customer declined this quote.",
          createdAt: new Date().toISOString(),
        });
        write(historyStorageKey(), history);
      }
      return;
    }

    const response = await fetch(`${config.proxyPath}/quotes/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        customerId: config.customerId || "",
        customerEmail: config.customerEmail || "",
        customerName: config.customerName || "Customer",
        portalToken: portalTokenForQuote(id),
      }),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = errorText;
      try {
        errorMessage = JSON.parse(errorText).error || errorText;
      } catch {
        // Keep raw server response text.
      }
      throw new Error(
        `HTTP ${response.status}${errorMessage ? `: ${errorMessage.slice(0, 180)}` : ""}`,
      );
    }
  }

  async function openQuoteDetail(id, options = {}) {
    const modal = document.querySelector(".sp-rfq-modal");
    const config = getConfig();
    const requestedQuoteId = String(id);
    const requestSeq = ++quoteDetailRequestSeq;
    activeQuoteDetailId = requestedQuoteId;
    activeQuoteDetail = null;
    let quote;
    let quoteLoadError = "";
    let quoteAccessDenied = false;
    const previousChatInput = modal?.querySelector("[data-customer-message]");
    const previousChatMessages = modal?.querySelector(".sp-rfq-chat-messages");
    const shouldPreserveDraft = options.preserveDraft !== false;
    let chatDraft = shouldPreserveDraft
      ? readChatDraft(id, previousChatInput)
      : "";
    let shouldRestoreChatFocus = document.activeElement === previousChatInput;
    const wasNearBottom = previousChatMessages
      ? previousChatMessages.scrollHeight -
          previousChatMessages.scrollTop -
          previousChatMessages.clientHeight <
        48
      : true;
    const previousScrollTop = previousChatMessages?.scrollTop ?? 0;
    const previousScrollHeight = previousChatMessages?.scrollHeight ?? 0;

    if (requestedQuoteId.startsWith("local-")) {
      quote = read(historyStorageKey(), []).find((item) => item.id === id);
    } else {
      try {
        const params = new URLSearchParams();
        if (config.customerEmail) {
          params.set("customerEmail", config.customerEmail);
        }
        const portalToken = portalTokenForQuote(id);
        if (portalToken) {
          params.set("portalToken", portalToken);
        }
        const query = params.toString();
        const response = await fetch(
          `${config.proxyPath}/quotes/${id}${query ? `?${query}` : ""}`,
        );
        if (requestSeq !== quoteDetailRequestSeq || activeQuoteDetailId !== requestedQuoteId) {
          return;
        }
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null);
          quoteAccessDenied = response.status === 403;
          quoteLoadError =
            errorPayload?.error ||
            (response.status === 403
              ? "This quote belongs to a different customer account."
              : "This quote could not be opened.");
          quote = null;
        } else {
          quote = (await response.json()).quote;
        }
      } catch {
        quoteLoadError = "This quote could not be opened. Please try again.";
        quote = null;
      }
    }
    if (requestSeq !== quoteDetailRequestSeq || activeQuoteDetailId !== requestedQuoteId) {
      return;
    }
    if (!modal) return;
    if (!quote) {
      stopQuoteDetailPolling();
      activeQuoteDetailId = null;
      activeQuoteDetail = null;
      modal.removeAttribute("data-quote-id");
      const returnUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const accessAction = quoteAccessDenied
        ? `<p>Please sign out and sign in using the email address that received this quote.</p>
            <a class="sp-rfq-button" href="${escapeHtml(switchAccountUrl(returnUrl))}">Sign in with another account</a>`
        : '<a class="sp-rfq-button" href="/account">View your account</a>';
      modal.innerHTML =
        modalHeader("Quote unavailable") +
        `<div class="sp-rfq-content">
          <div class="sp-rfq-empty sp-rfq-history-empty">
            <strong>Access denied</strong>
            <p>${escapeHtml(quoteLoadError || "This quote is not available for the signed-in account.")}</p>
            ${accessAction}
          </div>
        </div>`;
      bindShellControls(modal);
      return;
    }
    activeQuoteDetail = quote;
    if (historyCache) {
      historyCache = historyCache.map((item) =>
        item.id === id ? { ...item, unreadCount: 0 } : item,
      );
    }
    modal.dataset.quoteId = String(id);
    startQuoteDetailPolling(id);
    const quoteItems = quote.items || [];
    const quoteTotal = Number(
      quote.quoteTotal ??
        quoteItems.reduce(
          (sum, item) => sum + Number(item.quotePrice || 0) * Number(item.quantity || 1),
          0,
        ),
    );

    const canRespondToQuote = canBuyerRespondToQuote(quote.status);
    const detailActionHtml = canRespondToQuote
      ? `<div class="sp-rfq-detail-actions">
          <button class="sp-rfq-detail-download" data-download-pdf type="button">${icons.download || "↓"} ${escapeHtml(t("downloadPdf"))}</button>
          <span></span>
          <button class="sp-rfq-detail-decline" data-buyer-status="DECLINED" type="button">${escapeHtml(t("declineQuote"))}</button>
          <button class="sp-rfq-detail-accept" data-buyer-status="ACCEPTED" type="button">${escapeHtml(t("acceptQuote"))}</button>
        </div>`
      : `<div class="sp-rfq-detail-actions">
          <button class="sp-rfq-detail-download" data-download-pdf type="button">${icons.download || "↓"} ${escapeHtml(t("downloadPdf"))}</button>
          <span class="sp-rfq-detail-status-note">${escapeHtml(
            normalizeQuoteStatus(quote.status) === "REQUESTED_BY_CUSTOMER"
              ? t("waitingForMerchant")
              : normalizeQuoteStatus(quote.status) === "NEGOTIATING"
                ? t("quoteStillNegotiating")
                : normalizeQuoteStatus(quote.status) === "ACCEPTED"
                  ? t("quoteAccepted")
                  : normalizeQuoteStatus(quote.status) === "DECLINED"
                    ? t("quoteDeclined")
                    : normalizeQuoteStatus(quote.status) === "EXPIRED"
                      ? t("expired")
                    : "",
          )}</span>
        </div>`;
    const displayMessages = getDisplayMessagesForQuote(quote, id);
    const showChangeIndicators =
      normalizeQuoteStatus(quote.status) === "NEGOTIATING";

    // The request above can take long enough for the buyer to start typing.
    // Capture the live textarea again immediately before replacing the modal.
    const latestChatInput = modal.querySelector("[data-customer-message]");
    if (latestChatInput) {
      chatDraft = readChatDraft(id, latestChatInput);
      shouldRestoreChatFocus = document.activeElement === latestChatInput;
    }

    modal.innerHTML =
      modalHeader(
        `${t("quoteDetails")} - ${quote.quoteNumber}`,
        "",
        formatQuoteStatus(quote.status),
        quote.status,
      ) +
      `<div class="sp-rfq-content sp-rfq-detail-content">
        <div class="sp-rfq-detail-grid">
          <section class="sp-rfq-detail-card">
            <div class="sp-rfq-detail-table-wrap">
              <table class="sp-rfq-detail-table">
                <colgroup>
                  <col class="sp-rfq-detail-col-product">
                  <col class="sp-rfq-detail-col-qty">
                  <col class="sp-rfq-detail-col-price">
                  <col class="sp-rfq-detail-col-quote">
                  <col class="sp-rfq-detail-col-subtotal">
                </colgroup>
                <thead>
                  <tr><th>${escapeHtml(t("product"))}</th><th>${escapeHtml(t("qty"))}</th><th>${escapeHtml(t("price"))}</th><th>${escapeHtml(t("quotePrice"))}</th><th>${escapeHtml(t("subtotal"))}</th></tr>
                </thead>
                <tbody>
                  ${quoteItems
                    .map(
                      (item) => `<tr>
                        <td>
                          <div class="sp-rfq-detail-product">
                            ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="">` : '<span class="sp-rfq-thumb-placeholder"></span>'}
                            <span class="sp-rfq-detail-product-copy">
                              <span class="sp-rfq-detail-title-line">
                                <strong>${escapeHtml(item.title)}</strong>
                                ${renderDetailProductBadges(item)}
                              </span>
                              <small>${escapeHtml(item.variantTitle || t("defaultTitle"))}</small>
                            </span>
                          </div>
                        </td>
                        <td>
                          ${Number(item.quantity || 1)}
                          ${showChangeIndicators && item.lastOfferedQuantity != null && Number(item.quantity) !== Number(item.lastOfferedQuantity)
                            ? `<small class="sp-rfq-change-indicator ${Number(item.quantity) > Number(item.lastOfferedQuantity) ? "is-increase" : "is-decrease"}">${Number(item.quantity) > Number(item.lastOfferedQuantity) ? "↑" : "↓"} From ${Number(item.lastOfferedQuantity)}</small>`
                            : ""}
                        </td>
                        <td>${money(item.unitPrice, quote.currency)}</td>
                        <td>
                          <strong class="sp-rfq-blue">${money(item.quotePrice, quote.currency)}</strong>
                          ${showChangeIndicators && item.lastOfferedQuotePrice != null && Number(item.quotePrice) !== Number(item.lastOfferedQuotePrice)
                            ? `<small class="sp-rfq-change-indicator ${Number(item.quotePrice) > Number(item.lastOfferedQuotePrice) ? "is-increase" : "is-decrease"}">${Number(item.quotePrice) > Number(item.lastOfferedQuotePrice) ? "↑" : "↓"} From ${money(item.lastOfferedQuotePrice, quote.currency)}</small>`
                            : ""}
                        </td>
                        <td><strong class="sp-rfq-blue">${money(Number(item.quotePrice || 0) * Number(item.quantity || 1), quote.currency)}</strong></td>
                      </tr>`,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
            <div class="sp-rfq-detail-summary">
              <div><span>${escapeHtml(t("subtotal"))}</span><strong class="sp-rfq-blue">${money(quoteTotal, quote.currency)}</strong></div>
              <div><strong>${escapeHtml(t("finalTotal"))}</strong><strong class="sp-rfq-blue">${money(quoteTotal, quote.currency)}</strong></div>
            </div>
          </section>
          <aside class="sp-rfq-conversation sp-rfq-chat-panel">
            <h3>${escapeHtml(t("conversation"))}</h3>
            ${
              normalizeQuoteStatus(quote.status) === "REQUESTED_BY_CUSTOMER"
                ? `<div class="sp-rfq-chat-start">${escapeHtml(t("replyStart"))}</div>`
                : ""
            }
            <div class="sp-rfq-messages sp-rfq-chat-messages">
              ${buildChatMessagesHtml(displayMessages)}
            </div>
            <div class="sp-rfq-composer sp-rfq-chat-composer">
              ${renderChatAttachmentPreviews()}
              <textarea class="sp-rfq-chat-input" data-customer-message maxlength="${maxChatMessageLength}" placeholder="${escapeHtml(t("typeMessage"))}"></textarea>
              <button class="sp-rfq-chat-attach" data-chat-attach type="button" aria-label="${escapeHtml(t("attachFormats"))}">${icons.paperclip}</button>
              <input class="sp-rfq-chat-file-input" type="file" accept=".png,.pdf,.jpg,.jpeg,.doc,.docx" multiple hidden>
              <button class="sp-rfq-chat-send ${
                selectedChatAttachments.length ? "has-message" : ""
              }" data-send-message type="button" aria-label="Send message">↑</button>
            </div>
          </aside>
        </div>
        ${detailActionHtml}
      </div>`;
    bindShellControls(modal);
    bindSearchProductDialog(modal);

    const nextChatInput = modal.querySelector("[data-customer-message]");
    if (nextChatInput && chatDraft) {
      nextChatInput.value = chatDraft;
      modal
        .querySelector("[data-send-message]")
        ?.classList.toggle("has-message", true);
    }
    if (shouldRestoreChatFocus && nextChatInput) {
      nextChatInput.focus();
      nextChatInput.setSelectionRange(nextChatInput.value.length, nextChatInput.value.length);
    }
    const chatMessages = modal.querySelector(".sp-rfq-chat-messages");
    if (chatMessages && (options.forceScrollBottom || wasNearBottom)) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } else if (chatMessages && previousScrollHeight > 0) {
      chatMessages.scrollTop = previousScrollTop;
    }

    modal
      .querySelector("[data-back-history]")
      ?.addEventListener("click", () => {
        activeView = "history";
        activeQuoteDetailId = null;
        stopQuoteDetailPolling();
        renderModal();
      });

    modal
      .querySelector("[data-send-message]")
      ?.addEventListener("click", async () => {
        const quoteId = String(id);
        const textarea = modal.querySelector("[data-customer-message]");
        const message = textarea.value.trim();
        if (!message && selectedChatAttachments.length === 0) return;

        const sendButton = modal.querySelector("[data-send-message]");
        startSendingChatMessage(quoteId);
        if (textarea) {
          textarea.value = "";
        }
        clearChatDraft(quoteId);
        if (sendButton) {
          sendButton.innerHTML = "↑";
          sendButton.classList.toggle(
            "has-message",
            selectedChatAttachments.length > 0,
          );
        }

        const attachmentsToSend = selectedChatAttachments.map((attachment) => ({
          ...attachment,
        }));
        const clientMessageId = `message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const optimisticMessageId = `optimistic-${clientMessageId}`;
        const optimisticMessage = {
          id: optimisticMessageId,
          clientMessageId,
          sender: "CUSTOMER",
          senderName: config.customerName || "Customer",
          message,
          attachments: attachmentsToSend,
          createdAt: new Date().toISOString(),
          optimistic: true,
        };
        addOptimisticChatMessage(quoteId, optimisticMessage);
        selectedChatAttachments = [];
        modal.querySelector(".sp-rfq-chat-attachments")?.remove();
        const liveChatMessages = modal.querySelector(
          ".sp-rfq-chat-messages",
        );
        if (liveChatMessages) {
          liveChatMessages.innerHTML = buildChatMessagesHtml(
            getDisplayMessagesForQuote(activeQuoteDetail || quote, id),
          );
          liveChatMessages.scrollTop = liveChatMessages.scrollHeight;
        }

        try {
          const sendToBackend = async () => {
            if (quoteId.startsWith("local-")) {
              const history = read(historyStorageKey(), []);
              const localQuote = history.find((item) => item.id === id);
              localQuote.messages ||= [];
              const localMessage = {
                id: `message-${Date.now()}`,
                sender: "CUSTOMER",
                senderName: config.customerName || "Customer",
                message,
                attachments: attachmentsToSend,
                createdAt: new Date().toISOString(),
              };
              localQuote.messages.push(localMessage);
              write(historyStorageKey(), history);
              return localMessage;
            }

            const response = await fetchMessageWithRetry(
              `${config.proxyPath}/quotes/${id}/messages`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  customerName: config.customerName || "Customer",
                  clientMessageId,
                  message,
                  attachments: attachmentsToSend,
                }),
              },
            );
            if (!response.ok) {
              const errorText = await response.text().catch(() => "");
              throw new Error(
                `HTTP ${response.status}${errorText ? `: ${errorText.slice(0, 180)}` : ""}`,
              );
            }
            return (await response.json()).message;
          };
          const queuedSend = (chatSendQueues.get(quoteId) || Promise.resolve())
            .catch(() => undefined)
            .then(sendToBackend);
          chatSendQueues.set(quoteId, queuedSend);
          const confirmedMessage = await queuedSend;
          if (chatSendQueues.get(quoteId) === queuedSend) {
            chatSendQueues.delete(quoteId);
          }
          const currentQuote = activeQuoteDetail || quote;
          currentQuote.messages ||= [];
          if (
            confirmedMessage &&
            !currentQuote.messages.some(
              (message) =>
                message.id === confirmedMessage.id ||
                (confirmedMessage.clientMessageId &&
                  message.clientMessageId === confirmedMessage.clientMessageId),
            )
          ) {
            currentQuote.messages.push(confirmedMessage);
          }
          removeOptimisticChatMessage(quoteId, optimisticMessageId);
          finishSendingChatMessage(quoteId);
          if (liveChatMessages?.isConnected) {
            liveChatMessages.innerHTML = buildChatMessagesHtml(
              getDisplayMessagesForQuote(currentQuote, id),
            );
            liveChatMessages.scrollTop = liveChatMessages.scrollHeight;
          }
        } catch (error) {
          console.error("[SP RFQ] Could not send message.", error);
          removeOptimisticChatMessage(quoteId, optimisticMessageId);
          selectedChatAttachments = [
            ...attachmentsToSend,
            ...selectedChatAttachments,
          ];
          const currentDraft = chatDrafts.get(quoteId) || "";
          chatDrafts.set(
            quoteId,
            currentDraft ? `${message}\n${currentDraft}` : message,
          );
          finishSendingChatMessage(quoteId);
          if (liveChatMessages?.isConnected) {
            liveChatMessages.innerHTML = buildChatMessagesHtml(
              getDisplayMessagesForQuote(activeQuoteDetail || quote, id),
            );
          }
          const currentInput = modal.querySelector("[data-customer-message]");
          if (currentInput) {
            currentInput.value = currentInput.value
              ? `${message}\n${currentInput.value}`
              : message;
          }
          showWidgetToast(t("messageSendFailed"), "error");
        } finally {
          if (sendButton?.isConnected) {
            sendButton.innerHTML = "↑";
            sendButton.classList.toggle(
              "has-message",
              selectedChatAttachments.length > 0 ||
                Boolean(textarea?.value?.trim()),
            );
          }
        }
      });

    bindChatAttachmentPicker(modal);

    modal.querySelector("[data-download-pdf]")?.addEventListener("click", () => {
      if (String(quote.id || "").startsWith("local-")) {
        window.print();
        return;
      }
      const config = getConfig();
      const params = new URLSearchParams();
      if (config.customerEmail) {
        params.set("customerEmail", config.customerEmail);
      }
      const portalToken = portalTokenForQuote(quote.id);
      if (portalToken) {
        params.set("portalToken", portalToken);
      }
      const query = params.toString();
      const link = document.createElement("a");
      link.href = `${config.proxyPath}/quotes/${encodeURIComponent(quote.id)}/pdf${query ? `?${query}` : ""}`;
      link.download = `${quote.quoteNumber || "quote"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    });

    modal.querySelectorAll("[data-buyer-status]").forEach((button) => {
      button.addEventListener("click", async () => {
        const nextStatus = button.dataset.buyerStatus;
        if (!nextStatus) return;
        const confirmed = await confirmBuyerQuoteStatus(nextStatus);
        if (!confirmed) return;

        modal
          .querySelectorAll("[data-buyer-status]")
          .forEach((action) => action.setAttribute("disabled", "disabled"));
        button.classList.add("is-loading");
        try {
          await updateBuyerQuoteStatus(id, nextStatus);
          clearChatDraft(String(id));
          await openQuoteDetail(id, {
            forceScrollBottom: true,
            preserveDraft: false,
          });
          showWidgetToast(
            nextStatus === "ACCEPTED" ? t("quoteAccepted") : t("quoteDeclined"),
            "success",
          );
        } catch (error) {
          console.error("[SP RFQ] Could not update quote status.", error);
          showWidgetToast(t("quoteStatusUpdateFailed"), "error");
          modal
            .querySelectorAll("[data-buyer-status]")
            .forEach((action) => action.removeAttribute("disabled"));
          button.classList.remove("is-loading");
        }
      });
    });

    const messageInput = modal.querySelector("[data-customer-message]");
    const sendMessageButton = modal.querySelector("[data-send-message]");
    messageInput?.addEventListener("input", () => {
      chatDrafts.set(String(id), messageInput.value);
      sendMessageButton?.classList.toggle(
        "has-message",
        messageInput.value.trim().length > 0 || selectedChatAttachments.length > 0,
      );
    });
    messageInput?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      sendMessageButton?.click();
    });
  }

  function bindLanguageOptions(rootElement) {
    rootElement.querySelectorAll("[data-language-code]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        const code = button.dataset.languageCode;
        const nextLanguage = LANGUAGE_OPTIONS.find((option) => option.code === code);
        if (!nextLanguage) return;
        selectedLanguage = nextLanguage;
        localStorage.setItem(LANGUAGE_KEY, selectedLanguage.code);
        isLanguageOpen = false;
        await ensureTranslations().catch((error) => {
          console.warn("[SP RFQ] Could not load selected translation.", error);
        });
        if (activeQuoteDetailId) {
          openQuoteDetail(activeQuoteDetailId);
        } else {
          renderModal();
        }
      });
    });
  }

  function bindChatAttachmentPicker(modal) {
    const input = modal.querySelector(".sp-rfq-chat-file-input");
    const attachButton = modal.querySelector("[data-chat-attach]");

    attachButton?.addEventListener("click", () => input?.click());

    input?.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      const invalidFile = files.find((file) => !isAllowedAttachmentFile(file));

      if (invalidFile) {
        input.value = "";
        showWidgetToast(t("chooseValidFiles"), "error");
        return;
      }
      const combinedFiles = [
        ...selectedChatAttachments,
        ...files,
      ];
      if (
        combinedFiles.length > maxChatAttachments ||
        files.some((file) => file.size <= 0 || file.size > maxChatFileBytes) ||
        combinedFiles.reduce(
          (total, file) => total + Number(file.size || 0),
          0,
        ) > maxChatTotalFileBytes
      ) {
        input.value = "";
        showWidgetToast(
          "Attach up to 5 files, 5 MB each and 15 MB total.",
          "error",
        );
        return;
      }

      const nextAttachments = await Promise.all(files.map(fileToAttachment));
      selectedChatAttachments = [
        ...selectedChatAttachments,
        ...nextAttachments,
      ];
      input.value = "";
      openQuoteDetail(modal.dataset.quoteId);
    });

    modal.querySelectorAll("[data-chat-file-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedChatAttachments.splice(Number(button.dataset.chatFileRemove), 1);
        openQuoteDetail(modal.dataset.quoteId);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  async function init() {
    root = document.querySelector("#sp-rfq-root");
    refreshStorageIdentity();
    loadCart();
    await ensureTranslations().catch((error) => {
      console.warn("[SP RFQ] Could not load default translation.", error);
    });
    await loadWidgetSettings();
    createShell();
    const emailParams = new URLSearchParams(window.location.search);
    const emailQuoteId = emailParams.get("sp_quote");
    emailPortalToken = emailParams.get("sp_token") || "";
    emailPortalQuoteId = emailPortalToken ? String(emailQuoteId || "") : "";
    if (emailQuoteId && emailPortalToken) {
      const config = getConfig();
      if (!config.customerId) {
        const returnUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.replace(guestLoginUrl("", returnUrl));
        return;
      }
      // Create the modal shell before loading a quote from an email deep link.
      // Email links use GET only to avoid mail security scanners changing quote status.
      openModal("cart");
      await openQuoteDetail(emailQuoteId);
      const requestedAction = emailParams.get("sp_action");
      const actionSelector =
        requestedAction === "ACCEPTED"
          ? '[data-buyer-status="ACCEPTED"]'
          : requestedAction === "DECLINED"
            ? '[data-buyer-status="DECLINED"]'
            : "";
      const actionButton = actionSelector
        ? document.querySelector(`.sp-rfq-modal ${actionSelector}`)
        : null;
      if (actionButton) {
        actionButton.classList.add("sp-rfq-email-action-target");
        actionButton.scrollIntoView({ block: "nearest", behavior: "smooth" });
        actionButton.focus({ preventScroll: true });
        window.setTimeout(
          () => actionButton.classList.remove("sp-rfq-email-action-target"),
          3000,
        );
      }
    }
    bindAddButtons();
    new MutationObserver(bindAddButtons).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(), { once: true });
  } else {
    init();
  }
})();
