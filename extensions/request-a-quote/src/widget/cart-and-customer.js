  function createShell() {
    if (!root || document.querySelector(".sp-rfq-floating")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sp-rfq-floating";
    button.setAttribute("aria-label", getConfig().buttonLabel);
    button.addEventListener("click", () => openModal());
    document.body.appendChild(button);
    updateFloatingButton();
  }

  function openModal(view) {
    const shouldRestoreDetail = view === undefined && activeQuoteDetailId;
    if (view !== undefined) {
      activeQuoteDetailId = null;
      stopQuoteDetailPolling();
    }
    activeView = view || activeView || "cart";
    let overlay = document.querySelector(".sp-rfq-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "sp-rfq-overlay";
      overlay.innerHTML = '<section class="sp-rfq-modal"></section>';
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeModal();
      });
      document.body.appendChild(overlay);
      document.documentElement.classList.add("sp-rfq-lock");
    }
    if (shouldRestoreDetail) {
      openQuoteDetail(activeQuoteDetailId);
      return;
    }
    renderModal();
  }

  function closeModal() {
    document.querySelector(".sp-rfq-confirm-backdrop")?.remove();
    buyerStatusConfirmOpen = false;
    document.querySelector(".sp-rfq-overlay")?.remove();
    document.documentElement.classList.remove("sp-rfq-lock");
    isSearchPopupOpen = false;
    isLanguageOpen = false;
    selectedSearchProducts = [];
    selectedCartSearchProducts = [];
    window.clearTimeout(guestSuccessRedirectTimer);
    window.clearInterval(guestSuccessCountdownTimer);
    guestSuccessRedirectTimer = null;
    guestSuccessCountdownTimer = null;
    window.clearTimeout(popupSearchTimer);
    popupSearchRequestId += 1;
  }

  function languageLabel(option = selectedLanguage) {
    return `${option.code}&nbsp; ${escapeHtml(option.label)}`;
  }

  function currentLocale() {
    return selectedLanguage?.locale || LANGUAGE_OPTIONS[0].locale;
  }

  function currentTranslationKey() {
    return selectedLanguage?.translation || DEFAULT_TRANSLATION;
  }

  function currentScriptAssetUrl(fileName) {
    const script =
      document.currentScript ||
      Array.from(document.scripts).find((item) =>
        item.src.includes("quote-widget.js"),
      );

    if (!script?.src) return fileName;

    const url = new URL(script.src, window.location.href);
    url.pathname = url.pathname.replace(/\/[^/]*$/, `/${fileName}`);
    return url.toString();
  }

  async function loadTranslation(translationKey) {
    if (translations[translationKey]) return translations[translationKey];

    const response = await fetch(
      currentScriptAssetUrl(`quote-locale-${translationKey}.json`),
      { cache: "force-cache" },
    );

    if (!response.ok) {
      throw new Error(`Could not load translation: ${translationKey}`);
    }

    const dictionary = await response.json();
    translations[translationKey] = dictionary;
    return dictionary;
  }

  async function ensureTranslations(translationKey = currentTranslationKey()) {
    await loadTranslation(DEFAULT_TRANSLATION);

    if (translationKey !== DEFAULT_TRANSLATION) {
      try {
        await loadTranslation(translationKey);
      } catch {
        // Missing locale files should never break the storefront widget.
        // The UI falls back to English until that translation file is added.
      }
    }
  }

  function t(key, params = {}) {
    const dictionary = translations[currentTranslationKey()] || {};
    const fallbackDictionary = translations[DEFAULT_TRANSLATION] || {};
    const template = dictionary[key] || fallbackDictionary[key] || key;
    return Object.entries(params).reduce(
      (text, [param, value]) => text.replaceAll(`{${param}}`, String(value)),
      template,
    );
  }

  let widgetToastTimer;

  function showWidgetToast(message, tone = "success") {
    document.querySelector(".sp-rfq-toast")?.remove();
    window.clearTimeout(widgetToastTimer);

    const toast = document.createElement("div");
    toast.className = `sp-rfq-toast sp-rfq-toast-${tone}`;
    toast.setAttribute("role", tone === "error" ? "alert" : "status");
    toast.textContent = message;
    document.body.appendChild(toast);

    widgetToastTimer = window.setTimeout(() => {
      toast.remove();
    }, 3600);
  }

  function confirmBuyerQuoteStatus(status) {
    const isAccept = status === "ACCEPTED";
    document.querySelector(".sp-rfq-confirm-backdrop")?.remove();
    buyerStatusConfirmOpen = true;
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "sp-rfq-confirm-backdrop";
      overlay.innerHTML = `
        <section class="sp-rfq-confirm-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(
          isAccept ? t("confirmAcceptQuoteTitle") : t("confirmDeclineQuoteTitle"),
        )}">
          <h3>${escapeHtml(isAccept ? t("confirmAcceptQuoteTitle") : t("confirmDeclineQuoteTitle"))}</h3>
          <p>${escapeHtml(isAccept ? t("confirmAcceptQuoteMessage") : t("confirmDeclineQuoteMessage"))}</p>
          <div class="sp-rfq-confirm-actions">
            <button class="sp-rfq-confirm-cancel" type="button" data-confirm-cancel>${escapeHtml(t("cancel"))}</button>
            <button class="sp-rfq-confirm-primary ${
              isAccept ? "is-accept" : "is-decline"
            }" type="button" data-confirm-ok>${escapeHtml(
              isAccept ? t("acceptQuote") : t("declineQuote"),
            )}</button>
          </div>
        </section>`;

      let isResolved = false;
      const cleanup = (answer) => {
        if (isResolved) return;
        isResolved = true;
        buyerStatusConfirmOpen = false;
        overlay.remove();
        resolve(answer);
      };

      overlay.querySelector("[data-confirm-cancel]")?.addEventListener("click", () => cleanup(false));
      overlay.querySelector("[data-confirm-ok]")?.addEventListener("click", () => cleanup(true));
      document.body.appendChild(overlay);
      overlay.querySelector("[data-confirm-ok]")?.focus();
    });
  }

  function languageMenu() {
    return `<div class="sp-rfq-language-menu">
      ${LANGUAGE_OPTIONS.map(
        (option) =>
          `<button type="button" data-language-code="${escapeHtml(option.code)}" class="${
            option.code === selectedLanguage.code ? "is-selected" : ""
          }">${escapeHtml(option.code)} ${escapeHtml(option.label)}</button>`,
      ).join("")}
    </div>`;
  }

  function modalHeader(title, subtitle = "", badge = "", badgeTone = "") {
    const badgeToneClass = badgeTone
      ? ` sp-rfq-badge-${quoteStatusTone(badgeTone)}`
      : "";
    return `
      <header class="sp-rfq-header sp-rfq-header-${activeView}">
        <div class="sp-rfq-heading">
          <div class="sp-rfq-title-row">
            <h2>${escapeHtml(title)}</h2>
            ${badge ? `<span class="sp-rfq-badge sp-rfq-header-badge${badgeToneClass}">${escapeHtml(badge)}</span>` : ""}
          </div>
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
        </div>
        <nav class="sp-rfq-tabs" aria-label="Quote views">
          ${
            cart.length > 0 && activeView !== "history"
              ? `<button class="sp-rfq-header-search" data-header-search type="button" aria-label="${escapeHtml(t("searchProductsTooltip"))}">${icons.search}</button>`
              : ""
          }
          <div class="sp-rfq-language-wrap">
            <button class="sp-rfq-language ${isLanguageOpen ? "is-open" : ""}" data-language-toggle type="button" aria-label="${escapeHtml(t("language"))}" aria-expanded="${isLanguageOpen}">
              ${languageLabel()} ${icons.chevronDown}
            </button>
            ${isLanguageOpen ? languageMenu() : ""}
          </div>
          <button class="sp-rfq-tab ${activeView === "cart" ? "is-active" : ""}" data-view="cart" type="button" aria-label="${escapeHtml(t("quoteCartTooltip"))}">${icons.cart}</button>
          <button class="sp-rfq-tab ${activeView === "history" ? "is-active" : ""}" data-view="history" type="button" aria-label="${escapeHtml(t("manageQuotesTooltip"))}">${icons.history}</button>
          <button class="sp-rfq-close" type="button" aria-label="${escapeHtml(t("close"))}">${icons.close}</button>
        </nav>
      </header>
      ${searchProductDialog()}`;
  }

  function searchProductDialog() {
    if (!isSearchPopupOpen) return "";

    return `
      <div class="sp-rfq-search-dialog-backdrop">
        <section class="sp-rfq-search-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(t("searchProduct"))}">
          <header class="sp-rfq-search-dialog-header">
            <h3>${escapeHtml(t("searchProduct"))}</h3>
            <button class="sp-rfq-close" data-search-cancel type="button" aria-label="${escapeHtml(t("close"))}">${icons.close}</button>
          </header>
          <div class="sp-rfq-search-dialog-body">
            <div class="sp-rfq-product-search" data-popup-search-box>
              <span>${icons.search}</span>
              <input data-popup-product-search placeholder="${escapeHtml(t("search"))}" type="search" autocomplete="off">
            </div>
            <div class="sp-rfq-popup-product-results" data-popup-product-results></div>
          </div>
          <footer class="sp-rfq-search-dialog-footer">
            <button class="sp-rfq-dialog-cancel" data-search-cancel type="button">${escapeHtml(t("cancel"))}</button>
            <button class="sp-rfq-dialog-confirm" data-search-confirm type="button" disabled>${escapeHtml(t("confirm"))}</button>
          </footer>
        </section>
      </div>`;
  }

  function bindShellControls(modal) {
    modal.querySelector(".sp-rfq-close")?.addEventListener("click", (event) => {
      suppressHeaderTooltip(event.currentTarget);
      closeModal();
    });
    modal
      .querySelector("[data-header-search]")
      ?.addEventListener("click", (event) => {
        suppressHeaderTooltip(event.currentTarget);
        isSearchPopupOpen = true;
        selectedSearchProducts = [];
        renderModal();
        document.querySelector("[data-popup-product-search]")?.focus();
      });
    modal
      .querySelector("[data-language-toggle]")
      ?.addEventListener("click", (event) => {
        event.stopPropagation();
        const button = event.currentTarget;
        if (!(button instanceof HTMLElement)) return;
        const wrap = button.closest(".sp-rfq-language-wrap");
        if (!wrap) return;

        isLanguageOpen = !isLanguageOpen;
        button.classList.toggle("is-open", isLanguageOpen);
        button.setAttribute("aria-expanded", String(isLanguageOpen));

        wrap.querySelector(".sp-rfq-language-menu")?.remove();
        if (isLanguageOpen) {
          wrap.insertAdjacentHTML("beforeend", languageMenu());
          bindLanguageOptions(wrap);
          setTimeout(() => {
            document.addEventListener(
              "mousedown",
              (outsideEvent) => {
                const target = outsideEvent.target;
                if (!(target instanceof Node)) return;
                if (wrap.contains(target)) return;
                isLanguageOpen = false;
                wrap.querySelector(".sp-rfq-language-menu")?.remove();
                button.classList.remove("is-open");
                button.setAttribute("aria-expanded", "false");
              },
              { once: true },
            );
          });
        }
      });
    bindLanguageOptions(modal);
    if (isLanguageOpen) {
      document.addEventListener(
        "mousedown",
        (event) => {
          const target = event.target;
          if (!(target instanceof Node)) return;
          if (document.querySelector(".sp-rfq-language-wrap")?.contains(target))
            return;
          isLanguageOpen = false;
          document.querySelector(".sp-rfq-language-menu")?.remove();
          const button = document.querySelector("[data-language-toggle]");
          button?.classList.remove("is-open");
          button?.setAttribute("aria-expanded", "false");
        },
        { once: true },
      );
    }
    modal.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", (event) => {
        if (activeView === button.dataset.view && !modal.dataset.quoteId) return;
        suppressHeaderTooltip(event.currentTarget);
        activeView = button.dataset.view;
        modal.dataset.quoteId = "";
        activeQuoteDetailId = null;
        stopQuoteDetailPolling();
        renderModal();
      });
    });
  }

  function suppressHeaderTooltip(target) {
    if (!(target instanceof HTMLElement)) return;
    target.classList.add("is-clicking");
    window.setTimeout(() => target.classList.remove("is-clicking"), 180);
    suppressHeaderTooltips();
  }

  function suppressHeaderTooltips() {
    document.documentElement.classList.add("sp-rfq-suppress-tooltips");
    window.setTimeout(
      () =>
        document.documentElement.classList.remove("sp-rfq-suppress-tooltips"),
      260,
    );
  }

  // ---------------------------------------------------------------------------
  // Product search popup/dropdown logic
  // ---------------------------------------------------------------------------

  function bindSearchProductDialog(modal) {
    if (!isSearchPopupOpen) return;

    const input = modal.querySelector("[data-popup-product-search]");
    const results = modal.querySelector("[data-popup-product-results]");
    const confirm = modal.querySelector("[data-search-confirm]");
    if (!input || !results || !confirm) return;

    const closeSearch = () => {
      isSearchPopupOpen = false;
      selectedSearchProducts = [];
      window.clearTimeout(popupSearchTimer);
      popupSearchRequestId += 1;
      renderModal();
    };

    modal.querySelectorAll("[data-search-cancel]").forEach((button) => {
      button.addEventListener("click", closeSearch);
    });

    confirm.disabled = selectedSearchProducts.length === 0;
    confirm.addEventListener("click", () => {
      selectedSearchProducts.forEach(addProduct);
      isSearchPopupOpen = false;
      selectedSearchProducts = [];
      activeView = "cart";
      renderModal();
    });

    const runSearch = () => {
      const query = input.value.trim();
      window.clearTimeout(popupSearchTimer);
      popupSearchTimer = window.setTimeout(() => {
        searchPopupProducts(query, results, modal);
      }, 800);
    };

    input.addEventListener("input", runSearch);
    searchPopupProducts("", results, modal);
  }

  // ---------------------------------------------------------------------------
  // Quote cart rendering
  // ---------------------------------------------------------------------------

  function renderModal() {
    const modal = document.querySelector(".sp-rfq-modal");
    if (!modal) return;
    modal.classList.remove("is-success");
    if (activeView === "history") {
      renderHistory(modal);
    } else {
      renderCart(modal);
    }
  }

  function renderCart(modal) {
    const config = getConfig();
    const selectedItems = cart.filter((item) => item.included !== false);
    const hasSelectedItems = selectedItems.length > 0;
    const isGuest = !config.customerId && !config.customerEmail;
    const shouldCollectCustomerInfo = isGuest && showGuestCustomerForm;
    modal.innerHTML =
      modalHeader(
        t("quoteCart"),
        t("quoteCartSubtitle"),
      ) +
      `<div class="sp-rfq-content">${
        cart.length === 0
          ? `<div class="sp-rfq-empty sp-rfq-empty-cart">
              <div class="sp-rfq-empty-inner">
                <h3>${escapeHtml(t("buildQuoteTitle"))}</h3>
                <p>${t("buildQuoteText")}</p>
                <div class="sp-rfq-product-search" data-product-search-box>
                  <span>${icons.search}</span>
                  <input data-product-search placeholder="${escapeHtml(t("search"))}" type="search" autocomplete="off">
                </div>
                <div class="sp-rfq-product-results" data-product-results></div>
                <footer class="sp-rfq-search-dialog-footer sp-rfq-inline-search-footer" data-cart-search-footer hidden>
                  <button class="sp-rfq-dialog-cancel" data-cart-search-cancel type="button">${escapeHtml(t("cancel"))}</button>
                  <button class="sp-rfq-dialog-confirm" data-cart-search-confirm type="button" disabled>${escapeHtml(t("confirm"))}</button>
                </footer>
              </div>
            </div>`
          : `
            <div class="sp-rfq-table-wrap ${shouldCollectCustomerInfo ? "has-customer-form" : ""}">
              <table class="sp-rfq-table">
                <thead><tr><th></th><th>${escapeHtml(t("product"))}</th><th>${escapeHtml(t("qty"))}</th><th>${escapeHtml(t("price"))}</th><th>${escapeHtml(t("quotePrice"))}</th><th>${escapeHtml(t("subtotal"))}</th><th></th></tr></thead>
                <tbody>
                  ${cart
                    .map(
                      (item, index) => `
                      <tr>
                        <td><input ${
                          item.included !== false ? "checked" : ""
                        } data-include="${index}" type="checkbox" aria-label="Include ${escapeHtml(item.title)}"></td>
                        <td><div class="sp-rfq-line-product">
                          ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="">` : '<span class="sp-rfq-thumb-placeholder"></span>'}
                          <span class="sp-rfq-line-copy">
                            <span class="sp-rfq-line-title-row">
                              <strong>${escapeHtml(item.title)}</strong>
                            </span>
                            ${item.variantTitle ? `<small>${escapeHtml(item.variantTitle)}</small>` : ""}
                          </span>
                        </div></td>
                        <td><input class="sp-rfq-input" data-field="quantity" data-index="${index}" min="1" type="number" value="${Number(item.quantity)}"></td>
                        <td>${money(item.unitPrice, config.currency)}</td>
                        <td><input class="sp-rfq-input" data-field="quotePrice" data-index="${index}" min="0" step="0.01" type="number" value="${formatInputMoney(item.quotePrice)}"></td>
                        <td><strong>${money(item.quantity * item.quotePrice, config.currency)}</strong></td>
                        <td><button class="sp-rfq-delete" data-delete="${index}" type="button" aria-label="Remove">${icons.trash}</button></td>
                      </tr>`,
                    )
                    .join("")}
                </tbody>
              </table>
            ${shouldCollectCustomerInfo ? renderGuestCustomerForm() : ""}
            ${
              cartNotice
                ? `<div class="sp-rfq-cart-notice">${escapeHtml(cartNotice)}</div>`
                : ""
            }
            </div>
            <div class="sp-rfq-quote-footer">
            <div class="sp-rfq-footer-left">
  <textarea class="sp-rfq-note" name="note" placeholder="${escapeHtml(t("addComments"))}"></textarea>
 <div class="sp-rfq-attach-container">
   <button class="sp-rfq-attach-btn" type="button">
     ${icons.paperclip}
     <span>${escapeHtml(t("attachFile"))}</span>
   </button>
   <input class="sp-rfq-file-input" type="file" accept=".png,.pdf,.jpg,.jpeg,.doc,.docx" multiple hidden>
   <span class="sp-rfq-attach-text">
     ${escapeHtml(t("attachFormats"))}
   </span>
  </div>
 ${renderCartAttachments()}
</div>

<div class="sp-rfq-footer-right">
  <div class="sp-rfq-total">
    <div>
      <span>${escapeHtml(t("originalTotal"))}</span>
      <strong>${money(
        selectedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
        config.currency,
      )}</strong>
    </div>
    <div>
      <strong>${escapeHtml(t("quoteTotal"))}</strong>
      <strong>${money(
        selectedItems.reduce((sum, item) => sum + item.quotePrice * item.quantity, 0),
        config.currency,
      )}</strong>
    </div>
  </div>
  <button class="sp-rfq-send" type="button" ${hasSelectedItems ? "" : "disabled"}>${escapeHtml(t("sendQuoteRequest"))}</button>
</div>

</div>
          `
      }</div>`;

    bindShellControls(modal);
    bindSearchProductDialog(modal);

    if (cart.length === 0) {
      bindProductSearch(modal);
    }

    modal.querySelectorAll("[data-include]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const item = cart[Number(checkbox.dataset.include)];
        if (!item) return;
        item.included = checkbox.checked;
        cartNotice = "";
        saveCart();
        renderCart(modal);
      });
    });

    modal.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("change", () => {
        const item = cart[Number(input.dataset.index)];
        if (!item) return;
        item[input.dataset.field] = Math.max(
          input.dataset.field === "quantity" ? 1 : 0,
          Number(input.value || 0),
        );
        cartNotice = "";
        saveCart();
        renderCart(modal);
      });
    });

    modal.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        cart.splice(Number(button.dataset.delete), 1);
        cartNotice = "";
        saveCart();
        renderCart(modal);
      });
    });

    modal
      .querySelector(".sp-rfq-send")
      ?.addEventListener("click", () => sendQuote(modal));

    bindAttachmentPicker(modal);
    restoreCartScrollIfNeeded(modal);
  }

  function bindAttachmentPicker(modal) {
    const input = modal.querySelector(".sp-rfq-file-input");
    const attachButton = modal.querySelector(".sp-rfq-attach-btn");

    attachButton?.addEventListener("click", () => input?.click());

    input?.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;

      if (files.some((file) => !isAllowedAttachmentFile(file))) {
        input.value = "";
        showWidgetToast(t("chooseValidFiles"), "error");
        return;
      }

      selectedAttachments = [
        ...selectedAttachments,
        ...(await Promise.all(files.map(fileToAttachment))),
      ];
      input.value = "";
      renderCart(modal);
    });

    bindGuestCustomerForm(modal);

    modal.querySelectorAll("[data-file-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedAttachments.splice(Number(button.dataset.fileRemove), 1);
        renderCart(modal);
      });
    });
  }

  function guestAddressRule() {
    return {
      cityLabel: "City",
      cityPlaceholder: "",
      regionLabel: "Province",
      regionPlaceholder: "",
      postalLabel: "Postal code",
      postalPlaceholder: "",
      regionOptions: [],
      ...(addressRules.default || {}),
      ...(addressRules[guestCustomerInfo.country] || {}),
    };
  }

  function countryCodeForCountryName(countryName) {
    return guestCountryOptions.find((country) => country.name === countryName)?.code || "";
  }

  function renderCartPreservingScroll(modal) {
    const content = modal.querySelector(".sp-rfq-content");
    const tableWrap = modal.querySelector(".sp-rfq-table-wrap");
    const previousScrollTop = content?.scrollTop ?? 0;
    const previousTableScrollTop = tableWrap?.scrollTop ?? 0;
    const previousWindowScrollY = window.scrollY || window.pageYOffset || 0;
    modal.dataset.rfqRestoreScrollTop = String(previousScrollTop);
    modal.dataset.rfqRestoreTableScrollTop = String(previousTableScrollTop);
    modal.dataset.rfqRestoreWindowScrollY = String(previousWindowScrollY);
    renderCart(modal);
  }

  function setCustomerFieldError(modal, fieldName, message) {
    const field = modal.querySelector(`[data-customer-info='${fieldName}']`);
    const label = field?.closest("label");
    if (!field || !label) return;

    label.classList.toggle("has-error", Boolean(message));
    field.setAttribute("aria-invalid", message ? "true" : "false");

    const existingError = Array.from(label.children).find((child) =>
      child.classList?.contains("sp-rfq-field-error"),
    );
    if (!message) {
      existingError?.remove();
      return;
    }

    const error = existingError || document.createElement("small");
    error.className = "sp-rfq-field-error";
    error.textContent = message;
    if (!existingError) label.appendChild(error);
  }

  function setCustomerFieldNotice(modal, fieldName, message) {
    const field = modal.querySelector(`[data-customer-info='${fieldName}']`);
    const label = field?.closest("label");
    if (!field || !label) return;

    const existingNotice = Array.from(label.children).find((child) =>
      child.classList?.contains("sp-rfq-field-notice"),
    );
    if (!message) {
      existingNotice?.remove();
      return;
    }

    const notice = existingNotice || document.createElement("small");
    notice.className = "sp-rfq-field-notice";
    notice.textContent = message;
    if (!existingNotice) label.appendChild(notice);
  }

  function setCustomerFieldChecking(modal, fieldName, isChecking) {
    const field = modal.querySelector(`[data-customer-info='${fieldName}']`);
    const control =
      field?.closest(".sp-rfq-field-control") ||
      field?.closest(".sp-rfq-phone-input-control");
    if (!field || !control) return;

    control.classList.toggle("is-checking", Boolean(isChecking));
    let spinner = control.querySelector(".sp-rfq-field-spinner");
    if (!isChecking) {
      spinner?.remove();
      return;
    }

    if (!spinner) {
      spinner = document.createElement("span");
      spinner.className = "sp-rfq-field-spinner";
      spinner.setAttribute("aria-hidden", "true");
      control.appendChild(spinner);
    }
  }

  function restoreCartScrollIfNeeded(modal) {
    const value = modal.dataset.rfqRestoreScrollTop;
    const tableValue = modal.dataset.rfqRestoreTableScrollTop;
    if (value === undefined && tableValue === undefined) return;
    const windowValue = modal.dataset.rfqRestoreWindowScrollY;
    delete modal.dataset.rfqRestoreScrollTop;
    delete modal.dataset.rfqRestoreTableScrollTop;
    delete modal.dataset.rfqRestoreWindowScrollY;
    const scrollTop = Number(value || 0);
    const tableScrollTop = Number(tableValue || 0);
    const windowScrollY = Number(windowValue || 0);
    const restore = () => {
      const content = modal.querySelector(".sp-rfq-content");
      const tableWrap = modal.querySelector(".sp-rfq-table-wrap");
      if (content) content.scrollTop = scrollTop;
      if (tableWrap) tableWrap.scrollTop = tableScrollTop;
      window.scrollTo(window.scrollX || 0, windowScrollY);
    };
    restore();
    requestAnimationFrame(restore);
    requestAnimationFrame(() => requestAnimationFrame(restore));
    window.setTimeout(restore, 0);
    window.setTimeout(restore, 50);
    window.setTimeout(restore, 150);
  }

  function setPhoneSelectExpanded(select, expanded) {
    if (!select) return;
    Array.from(select.options || []).forEach((option) => {
      const dialCode = option.dataset.dialCode || "";
      option.textContent = expanded && dialCode
        ? `${option.value} ${dialCode}`
        : option.value;
    });
  }

  function normalizePhoneNumber(countryCode, value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return {
        value: "",
        isValid: false,
        error: "Phone is required",
      };
    }

    let digits = "";
    if (raw.startsWith("+")) {
      digits = raw.slice(1).replace(/\D/g, "");
    } else if (raw.startsWith("00")) {
      digits = raw.slice(2).replace(/\D/g, "");
    } else {
      digits = raw.replace(/\D/g, "").replace(/^0+/, "");
      const dialDigits = phoneDialDigitsByCountry.get(countryCode) || "";
      if (dialDigits && !digits.startsWith(dialDigits)) {
        digits = `${dialDigits}${digits}`;
      }
    }

    const normalized = digits ? `+${digits}` : "";
    const dialDigits = phoneDialDigitsByCountry.get(countryCode) || "";
    const nationalDigits = dialDigits && digits.startsWith(dialDigits)
      ? digits.slice(dialDigits.length)
      : digits;
    const isE164 = /^\+[1-9]\d{7,14}$/.test(normalized);
    const matchesCountry = !dialDigits || digits.startsWith(dialDigits);
    const hasUsefulNumber = /\d*[1-9]\d*/.test(nationalDigits);

    if (!isE164 || !matchesCountry || !hasUsefulNumber) {
      return {
        value: normalized,
        isValid: false,
        error: matchesCountry
          ? "Please enter a valid phone number"
          : "Phone number does not match the selected country",
      };
    }

    return {
      value: normalized,
      isValid: true,
      error: "",
    };
  }

  function resetGuestContactLookup() {
    guestContactValidation = {
      email: "idle",
      phone: "idle",
      customerExists: false,
    };
    guestCustomerNotices = {};
  }

  function scheduleGuestContactValidation(modal, changedField = "email") {
    window.clearTimeout(contactValidationTimer);
    contactValidationTimer = window.setTimeout(() => {
      validateGuestContactAsync(modal, changedField);
    }, 450);
  }

  async function validateGuestContactAsync(modal, changedField = "email") {
    const config = getConfig();
    const email = String(guestCustomerInfo.email || "").trim().toLowerCase();
    let phone = String(guestCustomerInfo.phone || "").trim();

    if (!email && !phone) return;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      guestCustomerErrors = { ...guestCustomerErrors, email: "Email is invalid" };
      setCustomerFieldError(modal, "email", guestCustomerErrors.email);
      return;
    }

    if (phone) {
      const phoneResult = normalizePhoneNumber(guestCustomerInfo.phoneCode, phone);
      guestCustomerInfo.phone = phoneResult.value || phone;
      phone = guestCustomerInfo.phone;
      const phoneInput = modal.querySelector("[data-customer-info='phone']");
      if (phoneInput) phoneInput.value = phone;
      if (!phoneResult.isValid) {
        guestCustomerErrors = { ...guestCustomerErrors, phone: phoneResult.error };
        setCustomerFieldError(modal, "phone", guestCustomerErrors.phone);
        return;
      }
    }

    const requestId = ++contactValidationSeq;
    const shouldCheckEmail = changedField === "email" || Boolean(email);
    const shouldCheckPhone = changedField === "phone" || Boolean(phone);
    guestContactValidation = {
      ...guestContactValidation,
      email: shouldCheckEmail && email ? "checking" : "idle",
      phone: shouldCheckPhone && phone ? "checking" : "idle",
    };
    setCustomerFieldChecking(modal, "email", guestContactValidation.email === "checking");
    setCustomerFieldChecking(modal, "phone", guestContactValidation.phone === "checking");

    try {
      const params = new URLSearchParams();
      if (email) params.set("email", email);
      if (phone) params.set("phone", phone);
      const response = await fetch(
        `${config.proxyPath}/validate-contact?${params.toString()}`,
        { headers: { Accept: "application/json" } },
      );
      const data = await response.json().catch(() => ({}));
      if (requestId !== contactValidationSeq) return;

      if (!response.ok) {
        const errors = data.errors || {};
        guestCustomerErrors = {
          ...guestCustomerErrors,
          email: errors.email || guestCustomerErrors.email || "",
          phone: errors.phone || guestCustomerErrors.phone || "",
        };
        guestCustomerNotices = {};
        setCustomerFieldError(modal, "email", guestCustomerErrors.email);
        setCustomerFieldError(modal, "phone", guestCustomerErrors.phone);
        setCustomerFieldNotice(modal, "email", "");
        setCustomerFieldNotice(modal, "phone", "");
        guestContactValidation.customerExists = false;
        return;
      }

      guestCustomerErrors = {
        ...guestCustomerErrors,
        email: "",
        phone: "",
      };
      guestContactValidation.customerExists = Boolean(data.customerExists);
      guestCustomerNotices = {};
      if (data.customerExists && data.matchedBy === "phone") {
        guestCustomerNotices.phone =
          "An account with this phone number already exists. Your quote information will be sent to this account's email.";
      }
      if (data.customerExists && data.matchedBy === "email") {
        guestCustomerNotices.email =
          "An account with this email already exists. Your quote information will be sent to this account's email.";
      }
      setCustomerFieldError(modal, "email", "");
      setCustomerFieldError(modal, "phone", "");
      setCustomerFieldNotice(modal, "email", guestCustomerNotices.email || "");
      setCustomerFieldNotice(modal, "phone", guestCustomerNotices.phone || "");
    } catch (error) {
      console.warn("[SP RFQ] Could not validate customer contact.", error);
    } finally {
      if (requestId === contactValidationSeq) {
        guestContactValidation = {
          ...guestContactValidation,
          email: "idle",
          phone: "idle",
        };
        setCustomerFieldChecking(modal, "email", false);
        setCustomerFieldChecking(modal, "phone", false);
      }
    }
  }

  function renderGuestCustomerForm() {
    const emailError = guestCustomerErrors.email || "";
    const phoneError = guestCustomerErrors.phone || "";
    const emailNotice = guestCustomerNotices.email || "";
    const phoneNotice = guestCustomerNotices.phone || "";
    const addressRule = guestAddressRule();
    const regionOptions = Array.isArray(addressRule.regionOptions)
      ? addressRule.regionOptions
      : [];
    if (
      regionOptions.length &&
      !regionOptions.includes(guestCustomerInfo.state)
    ) {
      guestCustomerInfo.state = regionOptions[0];
    }
    return `<section class="sp-rfq-customer-form" aria-label="Customer information">
      <div class="sp-rfq-customer-panel">
        <h3>Customer information</h3>
        <div class="sp-rfq-customer-grid sp-rfq-customer-grid-main">
          <label>
            <span>First name <em>*</em></span>
            <input data-customer-info="firstName" value="${escapeHtml(guestCustomerInfo.firstName)}" autocomplete="given-name">
          </label>
          <label>
            <span>Last name <em>*</em></span>
            <input data-customer-info="lastName" value="${escapeHtml(guestCustomerInfo.lastName)}" autocomplete="family-name">
          </label>
          <label class="${emailError ? "has-error" : ""}">
            <span>Email Address <em>*</em></span>
            <div class="sp-rfq-field-control ${guestContactValidation.email === "checking" ? "is-checking" : ""}">
              <input data-customer-info="email" value="${escapeHtml(guestCustomerInfo.email)}" type="email" autocomplete="email" aria-invalid="${emailError ? "true" : "false"}">
              ${guestContactValidation.email === "checking" ? '<span class="sp-rfq-field-spinner" aria-hidden="true"></span>' : ""}
            </div>
            ${emailError ? `<small class="sp-rfq-field-error">${escapeHtml(emailError)}</small>` : ""}
            ${emailNotice ? `<small class="sp-rfq-field-notice">${escapeHtml(emailNotice)}</small>` : ""}
          </label>
          <label class="sp-rfq-phone-field ${phoneError ? "has-error" : ""}">
            <span>Phone <em>*</em></span>
            <div>
              <select data-customer-info="phoneCode" aria-label="Phone country code">
                ${guestPhoneCodeOptions
                  .map((option) => {
                    const label = option.countryCode;
                    return `<option value="${escapeHtml(label)}" data-dial-code="${escapeHtml(option.dialCode)}" ${guestCustomerInfo.phoneCode === label ? "selected" : ""}>${escapeHtml(label)}</option>`;
                  })
                  .join("")}
              </select>
              <div class="sp-rfq-phone-input-control ${guestContactValidation.phone === "checking" ? "is-checking" : ""}">
                <input data-customer-info="phone" value="${escapeHtml(guestCustomerInfo.phone)}" autocomplete="tel" aria-invalid="${phoneError ? "true" : "false"}">
                ${guestContactValidation.phone === "checking" ? '<span class="sp-rfq-field-spinner" aria-hidden="true"></span>' : ""}
              </div>
            </div>
            ${phoneError ? `<small class="sp-rfq-field-error">${escapeHtml(phoneError)}</small>` : ""}
            ${phoneNotice ? `<small class="sp-rfq-field-notice">${escapeHtml(phoneNotice)}</small>` : ""}
          </label>
          <label class="sp-rfq-customer-full">
            <span>Company</span>
            <input data-customer-info="company" value="${escapeHtml(guestCustomerInfo.company)}" autocomplete="organization">
          </label>
        </div>
      </div>

      <div class="sp-rfq-customer-panel">
        <h3>Ship to (optional)</h3>
        <div class="sp-rfq-customer-grid sp-rfq-customer-grid-ship">
          <label class="sp-rfq-customer-full">
            <span>Country/region</span>
            <select data-customer-info="country">
              ${guestCountryOptions
                .map((option) => {
                  const label = `${option.code} ${option.name}`;
                  return `<option value="${escapeHtml(option.name)}" ${guestCustomerInfo.country === option.name ? "selected" : ""}>${escapeHtml(label)}</option>`;
                })
                .join("")}
            </select>
          </label>
          <label class="sp-rfq-customer-full">
            <span>Address</span>
            <input data-customer-info="address" value="${escapeHtml(guestCustomerInfo.address)}" autocomplete="street-address">
          </label>
          <label>
            <span>${escapeHtml(addressRule.cityLabel)}</span>
            <input data-customer-info="city" value="${escapeHtml(guestCustomerInfo.city)}" placeholder="${escapeHtml(addressRule.cityPlaceholder)}" autocomplete="address-level2">
          </label>
          <label>
            <span>${escapeHtml(addressRule.regionLabel)}</span>
            ${
              regionOptions.length
                ? `<select data-customer-info="state" autocomplete="address-level1">
                    ${regionOptions
                      .map(
                        (state) =>
                          `<option value="${escapeHtml(state)}" ${guestCustomerInfo.state === state ? "selected" : ""}>${escapeHtml(state)}</option>`,
                      )
                      .join("")}
                  </select>`
                : `<input data-customer-info="state" value="${escapeHtml(guestCustomerInfo.state)}" placeholder="${escapeHtml(addressRule.regionPlaceholder)}" autocomplete="address-level1">`
            }
          </label>
          <label>
            <span>${escapeHtml(addressRule.postalLabel)}</span>
            <input data-customer-info="zip" value="${escapeHtml(guestCustomerInfo.zip)}" placeholder="${escapeHtml(addressRule.postalPlaceholder)}" autocomplete="postal-code">
          </label>
        </div>
      </div>
    </section>`;
  }

  function bindGuestCustomerForm(modal) {
    const validateEmailField = (field) => {
      const email = String(field.value || "").trim();
      if (!email) {
        guestCustomerErrors = { ...guestCustomerErrors, email: "Email is required" };
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        guestCustomerErrors = { ...guestCustomerErrors, email: "Email is invalid" };
      } else {
        guestCustomerErrors = { ...guestCustomerErrors, email: "" };
      }
      setCustomerFieldError(modal, "email", guestCustomerErrors.email);
      if (!guestCustomerErrors.email) {
        scheduleGuestContactValidation(modal, "email");
      }
    };

    modal.querySelectorAll("[data-customer-info]").forEach((field) => {
      field.addEventListener("input", () => {
        guestCustomerInfo[field.dataset.customerInfo] = field.value;
        if (field.dataset.customerInfo === "email" && guestCustomerErrors.email) {
          guestCustomerErrors = { ...guestCustomerErrors, email: "" };
          setCustomerFieldError(modal, "email", "");
        }
        if (field.dataset.customerInfo === "phone" && guestCustomerErrors.phone) {
          guestCustomerErrors = { ...guestCustomerErrors, phone: "" };
          setCustomerFieldError(modal, "phone", "");
        }
        if (
          field.dataset.customerInfo === "email" ||
          field.dataset.customerInfo === "phone"
        ) {
          setCustomerFieldNotice(modal, field.dataset.customerInfo, "");
          resetGuestContactLookup();
          setCustomerFieldChecking(modal, field.dataset.customerInfo, false);
        }
      });
      if (field.dataset.customerInfo === "email") {
        field.addEventListener("blur", () => validateEmailField(field));
      }
      field.addEventListener("change", () => {
        guestCustomerInfo[field.dataset.customerInfo] = field.value;
        if (field.dataset.customerInfo === "email" && guestCustomerErrors.email) {
          guestCustomerErrors = { ...guestCustomerErrors, email: "" };
          setCustomerFieldError(modal, "email", "");
          return;
        }
        if (field.dataset.customerInfo === "country") {
          guestCustomerInfo.state = "";
          const nextPhoneCode = countryCodeForCountryName(field.value);
          if (nextPhoneCode && phoneDialCodeByCountry.has(nextPhoneCode)) {
            guestCustomerInfo.phoneCode = nextPhoneCode;
          }
          renderCartPreservingScroll(modal);
        }
      });
    });

    const phoneCodeSelect = modal.querySelector("[data-customer-info='phoneCode']");
    if (phoneCodeSelect) {
      setPhoneSelectExpanded(phoneCodeSelect, false);
      phoneCodeSelect.addEventListener("pointerdown", () =>
        setPhoneSelectExpanded(phoneCodeSelect, true),
      );
      phoneCodeSelect.addEventListener("focus", () =>
        setPhoneSelectExpanded(phoneCodeSelect, true),
      );
      phoneCodeSelect.addEventListener("change", () => {
        guestCustomerInfo.phoneCode = phoneCodeSelect.value;
        if (guestCustomerInfo.phone.trim()) {
          const result = normalizePhoneNumber(
            guestCustomerInfo.phoneCode,
            guestCustomerInfo.phone,
          );
          guestCustomerInfo.phone = result.value || guestCustomerInfo.phone;
          guestCustomerErrors = { ...guestCustomerErrors, phone: result.isValid ? "" : result.error };
          const phoneInput = modal.querySelector("[data-customer-info='phone']");
          if (phoneInput) phoneInput.value = guestCustomerInfo.phone;
          setCustomerFieldError(modal, "phone", guestCustomerErrors.phone);
          if (result.isValid) {
            scheduleGuestContactValidation(modal, "phone");
          }
          window.setTimeout(() => setPhoneSelectExpanded(phoneCodeSelect, false), 0);
          return;
        }
        window.setTimeout(() => setPhoneSelectExpanded(phoneCodeSelect, false), 0);
      });
      phoneCodeSelect.addEventListener("blur", () =>
        setPhoneSelectExpanded(phoneCodeSelect, false),
      );
    }

    const phoneInput = modal.querySelector("[data-customer-info='phone']");
    phoneInput?.addEventListener("blur", () => {
      const result = normalizePhoneNumber(
        guestCustomerInfo.phoneCode,
        phoneInput.value,
      );
      guestCustomerInfo.phone = result.value || phoneInput.value.trim();
      phoneInput.value = guestCustomerInfo.phone;
      guestCustomerErrors = { ...guestCustomerErrors, phone: result.isValid ? "" : result.error };
      setCustomerFieldError(modal, "phone", guestCustomerErrors.phone);
      if (result.isValid) {
        scheduleGuestContactValidation(modal, "phone");
      }
    });
  }

  function readGuestCustomerInfo(modal) {
    modal.querySelectorAll("[data-customer-info]").forEach((field) => {
      guestCustomerInfo[field.dataset.customerInfo] = field.value;
    });
    return { ...guestCustomerInfo };
  }

  function validateGuestCustomerInfo(info) {
    const errors = {};
    const email = info.email.trim();
    if (!email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      errors.email = "Email is invalid";
    }
    const normalizedPhone = normalizePhoneNumber(info.phoneCode, info.phone);
    if (!normalizedPhone.isValid) {
      errors.phone = normalizedPhone.error;
    } else {
      info.phone = normalizedPhone.value;
      guestCustomerInfo.phone = normalizedPhone.value;
    }

    guestCustomerErrors = errors;
    return Boolean(
      info.firstName.trim() &&
        info.lastName.trim() &&
        email &&
        !errors.email &&
        !errors.phone,
    );
  }

  function guestCustomerAddress(info) {
    return [info.address, info.city, info.state, info.zip]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(", ");
  }

  function bindProductSearch(modal) {
    modal.querySelectorAll("[data-product-search]").forEach((input) => {
      if (input.dataset.searchBound) return;
      input.dataset.searchBound = "true";

      const searchBox = input.closest("[data-product-search-box]");
      const results = searchBox?.nextElementSibling?.matches(
        "[data-product-results]",
      )
        ? searchBox.nextElementSibling
        : modal.querySelector("[data-product-results]");
      if (!results) return;
      const cancel = modal.querySelector("[data-cart-search-cancel]");
      const confirm = modal.querySelector("[data-cart-search-confirm]");
      const footer = modal.querySelector("[data-cart-search-footer]");
      let removeOutsideSearchListener = () => {};

      const resetSearch = () => {
        window.clearTimeout(productSearchTimer);
        cartSearchRequestId += 1;
        selectedCartSearchProducts = [];
        input.value = "";
        results.innerHTML = "";
        delete results.dataset.loaded;
        if (confirm) confirm.disabled = true;
        if (footer) footer.hidden = true;
      };

      cancel?.addEventListener("click", () => {
        resetSearch();
        removeOutsideSearchListener();
      });
      confirm?.addEventListener("click", () => {
        if (selectedCartSearchProducts.length === 0) return;
        removeOutsideSearchListener();
        selectedCartSearchProducts.forEach(addProduct);
        selectedCartSearchProducts = [];
        renderCart(modal);
      });

      const runSearch = () => {
        window.clearTimeout(productSearchTimer);
        productSearchTimer = window.setTimeout(
          () => searchProducts(input.value, results, modal),
          250,
        );
      };

      const bindOutsideSearch = () => {
        if (modal.dataset.emptySearchOutsideBound) return;
        modal.dataset.emptySearchOutsideBound = "true";
        const handleOutsideSearch = (event) => {
          const target = event.target;
          if (!(target instanceof Node)) return;
          if (
            searchBox.contains(target) ||
            results.contains(target) ||
            footer?.contains(target)
          ) {
            return;
          }
          document.removeEventListener("mousedown", handleOutsideSearch);
          delete modal.dataset.emptySearchOutsideBound;
          resetSearch();
        };
        removeOutsideSearchListener = () => {
          document.removeEventListener("mousedown", handleOutsideSearch);
          delete modal.dataset.emptySearchOutsideBound;
          removeOutsideSearchListener = () => {};
        };
        document.addEventListener("mousedown", handleOutsideSearch);
      };

      input.addEventListener("input", runSearch);
      input.addEventListener("focus", () => {
        bindOutsideSearch();
        if (!results.dataset.loaded) {
          searchProducts("", results, modal);
        }
      });

      bindOutsideSearch();
    });
  }

  async function searchProducts(query, results, modal) {
    const config = getConfig();
    const requestId = (cartSearchRequestId += 1);
    const footer = modal.querySelector("[data-cart-search-footer]");
    if (footer) footer.hidden = true;
    results.dataset.loaded = "true";
    results.innerHTML =
      `<div class="sp-rfq-search-status">${escapeHtml(t("loading"))}</div>`;

    try {
      const response = await fetch(
        `${config.proxyPath}/products?q=${encodeURIComponent(query)}`,
      );
      if (!response.ok) throw new Error("Product search failed");
      const products = (await response.json()).products ?? [];
      if (requestId !== cartSearchRequestId) return;

      if (!products.length) {
        results.innerHTML =
          `<div class="sp-rfq-search-status">${escapeHtml(t("noEligibleProducts"))}</div>`;
        return;
      }

      results.innerHTML = products
        .map((product, index) => {
          const alreadyInCart = cart.some(
            (item) => item.key === productSearchKey(product),
          );
          const selected = selectedCartSearchProducts.some(
            (item) => productSearchKey(item) === productSearchKey(product),
          );

          return `
            <div class="sp-rfq-result">
              ${
                product.imageUrl
                  ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.imageAlt)}">`
                  : '<span class="sp-rfq-result-placeholder"></span>'
              }
              <span class="sp-rfq-result-copy">
                <strong>${escapeHtml(product.title)}</strong>
              </span>
              <strong class="sp-rfq-result-price">${money(product.unitPrice, config.currency)}</strong>
              <button class="sp-rfq-result-add ${selected || alreadyInCart ? "is-selected" : ""}" data-result-index="${index}" type="button" ${alreadyInCart ? "disabled" : ""}>
                ${selected || alreadyInCart ? "&#10003;" : escapeHtml(t("add"))}
              </button>
            </div>`;
        })
        .join("");
      if (footer) footer.hidden = false;

      results.querySelectorAll("[data-result-index]").forEach((button) => {
        button.addEventListener("click", () => {
          const product = products[Number(button.dataset.resultIndex)];
          const key = productSearchKey(product);
          const exists = selectedCartSearchProducts.some(
            (item) => productSearchKey(item) === key,
          );
          selectedCartSearchProducts = exists
            ? selectedCartSearchProducts.filter(
                (item) => productSearchKey(item) !== key,
              )
            : [...selectedCartSearchProducts, product];

          button.classList.toggle("is-selected", !exists);
          button.textContent = exists ? t("add") : "\u2713";

          const confirm = modal.querySelector("[data-cart-search-confirm]");
          if (confirm) {
            confirm.disabled = selectedCartSearchProducts.length === 0;
          }
        });
      });

      const confirm = modal.querySelector("[data-cart-search-confirm]");
      if (confirm) confirm.disabled = selectedCartSearchProducts.length === 0;
    } catch {
      if (requestId !== cartSearchRequestId) return;
      results.innerHTML =
        `<div class="sp-rfq-search-status">${escapeHtml(t("searchFailed"))}</div>`;
      if (footer) footer.hidden = true;
    }
  }

  async function searchPopupProducts(query, results, modal) {
    const config = getConfig();
    const requestId = (popupSearchRequestId += 1);
    results.innerHTML =
      `<div class="sp-rfq-search-status">${escapeHtml(t("loading"))}</div>`;

    try {
      const response = await fetch(
        `${config.proxyPath}/products?q=${encodeURIComponent(query)}`,
      );
      if (!response.ok) throw new Error("Product search failed");
      const products = (await response.json()).products ?? [];
      if (requestId !== popupSearchRequestId) return;

      if (!products.length) {
        results.innerHTML =
          `<div class="sp-rfq-search-status">${escapeHtml(t("noEligibleProducts"))}</div>`;
        return;
      }

      results.innerHTML = products
        .map((product, index) => {
          const selected = selectedSearchProducts.some(
            (item) => productSearchKey(item) === productSearchKey(product),
          );

          return `
            <div class="sp-rfq-popup-product">
              ${
                product.imageUrl
                  ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.imageAlt)}">`
                  : '<span class="sp-rfq-result-placeholder"></span>'
              }
              <strong>${escapeHtml(product.title)}</strong>
              <span>${money(product.unitPrice, config.currency)}</span>
              <button class="sp-rfq-popup-add ${selected ? "is-selected" : ""}" data-popup-result-index="${index}" type="button">
                ${selected ? "&#10003;" : escapeHtml(t("add"))}
              </button>
            </div>`;
        })
        .join("");

      results
        .querySelectorAll("[data-popup-result-index]")
        .forEach((button) => {
          button.addEventListener("click", () => {
            const product = products[Number(button.dataset.popupResultIndex)];
            const key = productSearchKey(product);
            const exists = selectedSearchProducts.some(
              (item) => productSearchKey(item) === key,
            );
            selectedSearchProducts = exists
              ? selectedSearchProducts.filter(
                  (item) => productSearchKey(item) !== key,
                )
              : [...selectedSearchProducts, product];

            button.classList.toggle("is-selected", !exists);
            button.textContent = exists ? t("add") : "\u2713";

            const confirm = modal.querySelector("[data-search-confirm]");
            if (confirm) confirm.disabled = selectedSearchProducts.length === 0;
          });
        });

      const confirm = modal.querySelector("[data-search-confirm]");
      if (confirm) confirm.disabled = selectedSearchProducts.length === 0;
    } catch {
      if (requestId !== popupSearchRequestId) return;
      results.innerHTML =
        `<div class="sp-rfq-search-status">${escapeHtml(t("searchFailed"))}</div>`;
    }
  }

  function productSearchKey(product) {
    return product.variantId || product.productId || product.title;
  }

  async function sendQuote(modal) {
    const config = getConfig();
    const button = modal.querySelector(".sp-rfq-send");
    const isGuest = !config.customerId && !config.customerEmail;
    if (isGuest && !showGuestCustomerForm) {
      showGuestCustomerForm = true;
      renderCart(modal);
      requestAnimationFrame(() => {
        modal
          .querySelector("[data-customer-info='firstName']")
          ?.focus();
      });
      return;
    }
    const guestInfo = isGuest ? readGuestCustomerInfo(modal) : null;
    if (isGuest && !validateGuestCustomerInfo(guestInfo)) {
      renderCart(modal);
      requestAnimationFrame(() => {
        const target =
          guestCustomerErrors.email
            ? modal.querySelector("[data-customer-info='email']")
            : guestCustomerErrors.phone
              ? modal.querySelector("[data-customer-info='phone']")
            : modal.querySelector("[data-customer-info='firstName']");
        target?.focus();
      });
      return;
    }
    const customerEmail = config.customerEmail || guestInfo?.email || "";
    const customerName =
      config.customerName ||
      [guestInfo?.firstName, guestInfo?.lastName].filter(Boolean).join(" ") ||
      customerEmail ||
      "Guest customer";
    const customerPhone =
      config.customerPhone ||
      guestInfo?.phone ||
      "";
    const customerAddress =
      config.customerAddress || (guestInfo ? guestCustomerAddress(guestInfo) : "");
    const note = modal.querySelector('[name="note"]')?.value || "";
    const selectedItems = cart.filter((item) => item.included !== false);
    const remainingItems = cart.filter((item) => item.included === false);
    cartNotice = "";

    if (!selectedItems.length) {
      button.disabled = true;
      return;
    }

    button.disabled = true;
    button.classList.add("is-loading");
    button.innerHTML = '<span class="sp-rfq-spinner" aria-hidden="true"></span>';
    const payload = {
      customerId: config.customerId,
      customerName,
      customerEmail,
      customerPhone,
      customerCountry: config.customerCountry || guestInfo?.country || "",
      customerRegion: config.customerRegion || guestInfo?.state || "",
      customerAddress,
      currency: config.currency,
      note,
      attachments: selectedAttachments,
      items: selectedItems,
    };
    const attachmentsToSend = selectedAttachments.map((attachment) => ({
      ...attachment,
    }));
    let createdQuote = null;

    try {
      const response = await fetch(`${config.proxyPath}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        if (
          response.status === 403 &&
          errorPayload?.code === "NOT_ELIGIBLE_TO_REQUEST_QUOTE"
        ) {
          cartNotice =
            errorPayload?.message ||
            "Your account is not eligible to request quotes.";
          renderCart(modal);
          return;
        }

        throw new Error(
          errorPayload?.error ||
            errorPayload?.message ||
            `HTTP ${response.status}`,
        );
      }
      createdQuote = (await response.json()).quote;
      historyCache = null;
    } catch (error) {
      console.error("[SP RFQ] Could not submit quote request.", error);
      showWidgetToast(t("quoteSubmitFailed"), "error");
      button.disabled = false;
      button.classList.remove("is-loading");
      button.textContent = t("sendQuoteRequest");
      return;
    }

    cart = remainingItems.map((item) => ({ ...item, included: false }));
    if (createdQuote?.id && attachmentsToSend.length && !String(createdQuote.id).startsWith("local-")) {
      saveLocalChatAttachmentMessage(String(createdQuote.id), {
        id: `local-cart-attachment-${Date.now()}`,
        sender: "CUSTOMER",
        senderName: customerName,
        message: "",
        attachments: attachmentsToSend,
        createdAt: new Date().toISOString(),
      });
    }
    selectedAttachments = [];
    showGuestCustomerForm = false;
    saveCart();
    if (isGuest) {
      renderGuestQuoteSuccess(modal, customerEmail);
      return;
    }
    activeView = "history";
    if (createdQuote?.id) {
      await openQuoteDetail(createdQuote.id);
    } else {
      renderModal();
    }
  }

  function guestLoginUrl(email, returnUrl = "/account") {
    const config = getConfig();
    const params = new URLSearchParams({
      return_url: returnUrl,
    });
    if (email) {
      params.set("email", email);
    }
    return `${config.accountLoginUrl}?${params.toString()}`;
  }

  function switchAccountUrl(returnUrl) {
    const config = getConfig();
    const loginUrl = guestLoginUrl("", returnUrl);
    const separator = config.accountLogoutUrl.includes("?") ? "&" : "?";
    return `${config.accountLogoutUrl}${separator}return_url=${encodeURIComponent(loginUrl)}`;
  }

  function redirectGuestToLogin(email) {
    window.location.href = guestLoginUrl(email);
  }

  function renderGuestQuoteSuccess(modal, email) {
    let seconds = 5;
    window.clearTimeout(guestSuccessRedirectTimer);
    window.clearInterval(guestSuccessCountdownTimer);
    guestSuccessRedirectTimer = null;
    guestSuccessCountdownTimer = null;

    const render = () => {
      modal.innerHTML = modalHeader(t("quoteCart"), t("quoteCartSubtitle")) +
        `<div class="sp-rfq-content sp-rfq-success-content">
          <div class="sp-rfq-success">
        <div class="sp-rfq-success-illustration" aria-hidden="true">
          <svg viewBox="0 0 260 170">
            <path d="M57 129c-25-26-10-74 29-78 16-2 22 6 40 1 25-7 35-33 65-21 26 11 31 45 20 70-16 36-53 42-91 42-27 0-48 1-63-14Z" fill="#f0f1f8"/>
            <path d="M84 128V73c0-6 5-11 11-11h47l25 25v41H84Z" fill="#fff" stroke="#111827" stroke-width="2"/>
            <path d="M142 62v26h25" fill="none" stroke="#111827" stroke-width="2"/>
            <path d="M104 93h42M104 108h48M104 123h32" stroke="#111827" stroke-width="2" stroke-linecap="round"/>
            <circle cx="77" cy="93" r="21" fill="#fff" stroke="#111827" stroke-width="6"/>
            <path d="m91 108 20 20" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
            <rect x="175" y="45" width="58" height="86" rx="5" fill="#fff" stroke="#111827" stroke-width="2"/>
            <path d="M190 66h28M190 83h30M190 100h24" stroke="#111827" stroke-width="2" stroke-linecap="round"/>
            <path d="M185 119c8-8 16-8 24 0 7-8 14-8 21 0" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round"/>
            <path d="M30 145h205" stroke="#111827" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h2>Thank you for requesting a quote!</h2>
        <p>We have successfully received your details. Our team is currently reviewing your request and will get back to you soon.</p>
        <button class="sp-rfq-success-button" type="button">Continue Shopping</button>
        <span class="sp-rfq-success-countdown">Redirecting in ${seconds} seconds...</span>
          </div>
        </div>`;
      modal
        .querySelector(".sp-rfq-success-button")
        ?.addEventListener("click", () => redirectGuestToLogin(email));
    };

    render();
    guestSuccessCountdownTimer = window.setInterval(() => {
      seconds -= 1;
      const countdown = modal.querySelector(".sp-rfq-success-countdown");
      if (countdown) {
        countdown.textContent = `Redirecting in ${Math.max(seconds, 0)} seconds...`;
      }
      if (seconds <= 0) {
        window.clearInterval(guestSuccessCountdownTimer);
      }
    }, 1000);
    guestSuccessRedirectTimer = window.setTimeout(() => {
      redirectGuestToLogin(email);
    }, 5000);
  }

  // ---------------------------------------------------------------------------
  // Quote history list and quote detail/conversation views
  // ---------------------------------------------------------------------------

