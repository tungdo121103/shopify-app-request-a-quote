  async function loadHistory() {
    const config = getConfig();
    if (!config.customerId && !config.customerEmail) {
      historyCache = [];
      return historyCache;
    }

    try {
      const params = new URLSearchParams({
        customerId: config.customerId,
      });
      if (config.customerEmail) {
        params.set("customerEmail", config.customerEmail);
      }
      const response = await fetch(
        `${config.proxyPath}/quotes?${params.toString()}`,
      );
      if (!response.ok) throw new Error("History request failed");
      historyCache = (await response.json()).quotes;
      return historyCache;
    } catch {
      if (!config.customerId && !config.customerEmail) {
        historyCache = [];
        return historyCache;
      }
      historyCache = read(historyStorageKey(), []);
      return historyCache;
    }
  }

  async function renderHistory(modal, focusHistorySearch = false) {
    const config = getConfig();
    if (!config.customerId && !config.customerEmail) {
      historyCache = [];
      modal.innerHTML =
        modalHeader(t("quoteHistory")) +
        `<div class="sp-rfq-content sp-rfq-history-content sp-rfq-history-guest">
          <div class="sp-rfq-empty sp-rfq-history-empty">${escapeHtml(t("loginToViewQuoteHistory"))}</div>
        </div>`;
      bindShellControls(modal);
      bindSearchProductDialog(modal);
      return;
    }

    const renderHistoryView = (quotes) => {
    const filteredQuotes = quotes.filter((quote) => {
      const matchesQuery = String(quote.quoteNumber || "")
        .toLowerCase()
        .includes(historyQuery.toLowerCase());
      const matchesStatus =
        historyStatus === "all" ||
        String(quote.status || "").toLowerCase() === historyStatus;
      return matchesQuery && matchesStatus;
    });
    const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / historyPageSize));
    historyPage = Math.min(Math.max(1, historyPage), totalPages);
    const startIndex = filteredQuotes.length ? (historyPage - 1) * historyPageSize : 0;
    const endIndex = Math.min(startIndex + historyPageSize, filteredQuotes.length);
    const pageQuotes = filteredQuotes.slice(startIndex, endIndex);

    modal.innerHTML =
      modalHeader(t("quoteHistory")) +
      `<div class="sp-rfq-content sp-rfq-history-content">
        <div class="sp-rfq-history-tools">
          <div class="sp-rfq-product-search sp-rfq-history-search">
            <span>${icons.search}</span>
            <input placeholder="${escapeHtml(t("searchByQuoteId"))}" data-history-search type="search" autocomplete="off" value="${escapeHtml(historyQuery)}">
          </div>
          <select class="sp-rfq-history-filter" data-history-status aria-label="Filter quotes by status">
            <option value="all" ${historyStatus === "all" ? "selected" : ""}>${escapeHtml(t("allStatuses"))}</option>
            <option value="requested_by_customer" ${historyStatus === "requested_by_customer" ? "selected" : ""}>${escapeHtml(t("requestedByCustomer"))}</option>
            <option value="sent" ${historyStatus === "sent" ? "selected" : ""}>${escapeHtml(t("sent"))}</option>
            <option value="under_negotiation" ${historyStatus === "under_negotiation" ? "selected" : ""}>${escapeHtml(t("underNegotiation"))}</option>
            <option value="accepted" ${historyStatus === "accepted" ? "selected" : ""}>${escapeHtml(t("accepted"))}</option>
            <option value="declined" ${historyStatus === "declined" ? "selected" : ""}>${escapeHtml(t("declined"))}</option>
            <option value="expired" ${historyStatus === "expired" ? "selected" : ""}>${escapeHtml(t("expired"))}</option>
          </select>
        </div>
        <div class="sp-rfq-history-table-wrap">
          <table class="sp-rfq-history-table">
            <colgroup>
              <col class="sp-rfq-history-col-id">
              <col class="sp-rfq-history-col-created">
              <col class="sp-rfq-history-col-expired">
              <col class="sp-rfq-history-col-status">
              <col class="sp-rfq-history-col-value">
              <col class="sp-rfq-history-col-actions">
            </colgroup>
            <thead><tr><th>${escapeHtml(t("quoteId"))}</th><th>${escapeHtml(t("createdTime"))}</th><th>${escapeHtml(t("expiredTime"))}</th><th>${escapeHtml(t("status"))}</th><th>${escapeHtml(t("quoteValue"))}</th><th>${escapeHtml(t("actions"))}</th></tr></thead>
            <tbody>${
              filteredQuotes.length === 0
                ? `<tr class="sp-rfq-history-no-quotes"><td colspan="6">${escapeHtml(t("noQuotesFound"))}</td></tr>`
                : pageQuotes.map(historyRow).join("")
            }</tbody>
          </table>
        </div>
        <div class="sp-rfq-history-footer">
          <span class="sp-rfq-history-count">${filteredQuotes.length ? escapeHtml(t("showingQuotes", { from: startIndex + 1, to: endIndex, total: filteredQuotes.length })) : escapeHtml(t("noQuotes"))}</span>
          <div class="sp-rfq-history-pagination">
            <button type="button" data-history-prev ${historyPage <= 1 ? "disabled" : ""}>${escapeHtml(t("previous"))}</button>
            <span>${escapeHtml(t("pageOf", { page: historyPage, total: totalPages }))}</span>
            <button type="button" data-history-next ${historyPage >= totalPages ? "disabled" : ""}>${escapeHtml(t("next"))}</button>
            <div class="sp-rfq-history-show">
              <span>${escapeHtml(t("show"))}</span>
              <select data-history-page-size aria-label="Quotes per page">
                ${[10, 20, 30, 50]
                  .map(
                    (size) =>
                      `<option value="${size}" ${historyPageSize === size ? "selected" : ""}>${size}</option>`,
                  )
                  .join("")}
              </select>
            </div>
          </div>
        </div>
      </div>`;
    bindShellControls(modal);
    bindSearchProductDialog(modal);

    if (focusHistorySearch) {
      const searchInput = modal.querySelector("[data-history-search]");
      searchInput?.focus();
      searchInput?.setSelectionRange?.(searchInput.value.length, searchInput.value.length);
    }

    modal
      .querySelector("[data-history-search]")
      ?.addEventListener("input", (event) => {
        historyQuery = event.target.value;
        historyPage = 1;
        renderHistory(modal, true);
      });

    modal
      .querySelector("[data-history-status]")
      ?.addEventListener("change", (event) => {
        historyStatus = event.target.value;
        historyPage = 1;
        renderHistory(modal);
      });

    modal.querySelector("[data-history-prev]")?.addEventListener("click", () => {
      historyPage = Math.max(1, historyPage - 1);
      renderHistory(modal);
    });

    modal.querySelector("[data-history-next]")?.addEventListener("click", () => {
      historyPage += 1;
      renderHistory(modal);
    });

    modal
      .querySelector("[data-history-page-size]")
      ?.addEventListener("change", (event) => {
        historyPageSize = Number(event.target.value) || 10;
        historyPage = 1;
        renderHistory(modal);
      });

    modal.querySelectorAll("[data-open-quote]").forEach((button) => {
      button.addEventListener("click", () =>
        openQuoteDetail(button.dataset.openQuote),
      );
    });
    };

    const refreshHistoryFromServer = async () => {
      const now = Date.now();
      if (historyRefreshInFlight || now - historyLastRemoteRefresh < 1200) {
        return;
      }
      historyRefreshInFlight = true;
      historyLastRemoteRefresh = now;
      const quotes = await loadHistory();
      historyRefreshInFlight = false;
      if (!document.body.contains(modal) || activeView !== "history") return;
      renderHistoryView(quotes);
    };

    if (historyCache) {
      renderHistoryView(historyCache);
      if (!focusHistorySearch) {
        void refreshHistoryFromServer();
      }
      return;
    }

    modal.innerHTML =
      modalHeader(t("quoteHistory")) +
      `<div class="sp-rfq-content"><div class="sp-rfq-empty">${escapeHtml(t("loading"))}</div></div>`;
    bindShellControls(modal);
    bindSearchProductDialog(modal);
    const quotes = await loadHistory();
    if (!document.body.contains(modal) || activeView !== "history") return;
    renderHistoryView(quotes);
  }

  function historyRow(quote) {
    const config = getConfig();
    const unreadCount = Number(quote.unreadCount || 0);
    return `<tr class="${unreadCount > 0 ? "sp-rfq-history-unread" : ""}" data-quote-row="${escapeHtml(quote.quoteNumber)}">
      <td><span class="sp-rfq-history-id-wrap">${
        unreadCount > 0
          ? `<span class="sp-rfq-unread-dot" aria-label="${escapeHtml(`${unreadCount} unread updates`)}"></span>`
          : ""
      }${escapeHtml(quote.quoteNumber)}</span></td>
      <td>${formatHistoryDate(quote.createdAt)}</td>
      <td>${quote.expiresAt ? formatHistoryDate(quote.expiresAt) : "-"}</td>
      <td><span class="sp-rfq-badge sp-rfq-badge-${quoteStatusTone(quote.status)}">${escapeHtml(formatQuoteStatus(quote.status))}</span></td>
      <td><strong class="sp-rfq-blue">${money(quote.quoteTotal, quote.currency || config.currency)}</strong></td>
      <td><button class="sp-rfq-tab sp-rfq-eye" data-open-quote="${escapeHtml(quote.id)}" type="button" aria-label="${escapeHtml(t("viewDetail"))}">${icons.eye}</button></td>
    </tr>`;
  }

  function formatHistoryDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat(currentLocale(), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

