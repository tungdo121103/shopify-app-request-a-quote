(() => {
  // Source entry. Run `npm run build:widget` to update the Shopify asset.
  if (window.__spRequestQuoteLoaded) return;
  window.__spRequestQuoteLoaded = true;

  // ---------------------------------------------------------------------------
  // Constants, small utilities, icons, and shared widget state
  // ---------------------------------------------------------------------------

  const CART_KEY_PREFIX = "sp-rfq-cart";
  const HISTORY_KEY_PREFIX = "sp-rfq-history";
  const CHAT_ATTACHMENTS_KEY_PREFIX = "sp-rfq-chat-attachments";
  const GUEST_SESSION_KEY = "sp-rfq-guest-session";
  const LAST_IDENTITY_KEY = "sp-rfq-last-identity";
  const LANGUAGE_KEY = "sp-rfq-language";
  const LANGUAGE_OPTIONS = [
    { code: "US", label: "English", locale: "en-US", translation: "en" },
    { code: "cz", label: "Čeština", locale: "cs-CZ", translation: "cs" },
    { code: "DK", label: "Dansk", locale: "da-DK", translation: "da" },
    { code: "DE", label: "Deutsch", locale: "de-DE", translation: "de" },
    { code: "ES", label: "Español", locale: "es-ES", translation: "es" },
    { code: "FI", label: "Suomi", locale: "fi-FI", translation: "fi" },
    { code: "FR", label: "Français", locale: "fr-FR", translation: "fr" },
    { code: "IT", label: "Italiano", locale: "it-IT", translation: "it" },
    { code: "JP", label: "日本語", locale: "ja-JP", translation: "ja" },
    { code: "KR", label: "한국어", locale: "ko-KR", translation: "ko" },
    { code: "NO", label: "Norsk Bokmål", locale: "nb-NO", translation: "nb" },
    { code: "NL", label: "Nederlands", locale: "nl-NL", translation: "nl" },
    { code: "PL", label: "Polski", locale: "pl-PL", translation: "pl" },
    { code: "BR", label: "Português (BR)", locale: "pt-BR", translation: "pt-BR" },
    { code: "PT", label: "Português (PT)", locale: "pt-PT", translation: "pt-PT" },
    { code: "RO", label: "Română", locale: "ro-RO", translation: "ro" },
    { code: "SE", label: "Svenska", locale: "sv-SE", translation: "sv" },
    { code: "TH", label: "ไทย", locale: "th-TH", translation: "th" },
    { code: "TR", label: "Türkçe", locale: "tr-TR", translation: "tr" },
    { code: "VN", label: "Tiếng Việt", locale: "vi-VN", translation: "vi" },
    { code: "CN", label: "简体中文", locale: "zh-CN", translation: "zh-CN" },
    { code: "TW", label: "繁體中文", locale: "zh-TW", translation: "zh-TW" },
  ];
  const DEFAULT_TRANSLATION = "en";
  const translations = {};
  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  };
  const write = (key, value) =>
    localStorage.setItem(key, JSON.stringify(value));
  async function fetchMessageWithRetry(input, init) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });
        if (response.status < 500 || attempt === 1) return response;
        lastError = new Error(`Message server returned HTTP ${response.status}.`);
      } catch (error) {
        lastError = error;
        if (attempt === 1) throw error;
      } finally {
        window.clearTimeout(timer);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
    throw lastError || new Error("Message send failed.");
  }
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  const formatInputMoney = (value) => {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return "0";
    return String(Number(number.toFixed(2)));
  };
  const money = (value, currency = "USD") =>
    new Intl.NumberFormat(currentLocale(), {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  const icons = {
    search:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>',
    cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 8H7"></path><circle cx="10" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle></svg>',
    history:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1"></rect><path d="M9 8h6M9 12h6M9 16h4"></path></svg>',
    close:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"></path></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>',
    trash:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 14h10l1-14"></path><path d="M9 7V4h6v3"></path></svg>',
    paperclip:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.4 11.6-8.8 8.8a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.8-8.8"></path></svg>',
    download:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>',
    chevronDown:
      '<svg class="sp-rfq-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5"></path></svg>',
  };

  let root;
  let cart = [];
  let activeView = "cart";
  let isSearchPopupOpen = false;
  let isLanguageOpen = false;
  let selectedSearchProducts = [];
  let selectedCartSearchProducts = [];
  let selectedAttachments = [];
  let selectedChatAttachments = [];
  let showGuestCustomerForm = false;
  let cartNotice = "";
  let guestCustomerInfo = {
    firstName: "",
    lastName: "",
    country: "United States",
    email: "",
    phoneCode: "US",
    phone: "",
    company: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  };
  let guestCustomerErrors = {};
  let guestCustomerNotices = {};
  let guestContactValidation = {
    email: "idle",
    phone: "idle",
    customerExists: false,
  };
  const guestCountryOptions = Array.isArray(window.SPRFQ_COUNTRIES)
    ? window.SPRFQ_COUNTRIES
    : [
        { code: "CA", name: "Canada" },
        { code: "US", name: "United States" },
        { code: "VN", name: "Vietnam" },
      ];
  const guestPhoneCodeOptions = Array.isArray(window.SPRFQ_PHONE_CODES)
    ? window.SPRFQ_PHONE_CODES
    : [
        { countryCode: "US", dialCode: "+1" },
        { countryCode: "CA", dialCode: "+1" },
        { countryCode: "VN", dialCode: "+84" },
      ];
  const phoneDialCodeByCountry = new Map(
    guestPhoneCodeOptions.map((option) => [
      option.countryCode,
      String(option.dialCode || "").replace(/[^\d+]/g, ""),
    ]),
  );
  const phoneDialDigitsByCountry = new Map(
    guestPhoneCodeOptions.map((option) => [
      option.countryCode,
      String(option.dialCode || "").replace(/\D/g, ""),
    ]),
  );
  const addressRules = window.SPRFQ_ADDRESS_RULES || {};
  const chatDrafts = new Map();
  const optimisticChatMessages = new Map();
  const chatSendQueues = new Map();
  let activeQuoteDetailId = null;
  let activeQuoteDetail = null;
  let emailPortalToken = "";
  let emailPortalQuoteId = "";
  function portalTokenForQuote(quoteId) {
    return String(quoteId || "") === emailPortalQuoteId
      ? emailPortalToken
      : "";
  }
  let quoteDetailRequestSeq = 0;
  let selectedLanguage =
    LANGUAGE_OPTIONS.find((option) => option.code === localStorage.getItem(LANGUAGE_KEY)) ||
    LANGUAGE_OPTIONS[0];
  const sendingMessageCounts = new Map();
  let productSearchTimer;
  let cartSearchRequestId = 0;
  let popupSearchTimer;
  let contactValidationTimer;
  let contactValidationSeq = 0;
  let popupSearchRequestId = 0;
  let historyQuery = "";
  let historyStatus = "all";
  let historyPage = 1;
  let historyPageSize = 10;
  let historyCache = null;
  let historyRefreshInFlight = false;
  let historyLastRemoteRefresh = 0;
  let quoteDetailPollTimer = null;
  let buyerStatusConfirmOpen = false;
  let guestSuccessRedirectTimer = null;
  let guestSuccessCountdownTimer = null;
  let quoteDetailMessageRefreshInFlight = false;
  let floatingSuccessTimer = null;
  let widgetSettings = {
    widgetStyle: "text",
    widgetButtonText: "Get Quote",
    widgetSize: "medium",
    widgetOrientation: "horizontal",
    widgetDesktopPosition: "middle_left",
    widgetMobilePosition: "bottom_right",
    widgetDisplayMode: "all",
    widgetSpecificPages: "",
    widgetBackgroundColor: "#120670",
    widgetTextColor: "#ffffff",
    widgetAnimation: "pulse",
    widgetIconDataUrl: "",
  };
  const productEligibilityCache = new Map();

  // ---------------------------------------------------------------------------
  // Configuration and quote cart state helpers
  // ---------------------------------------------------------------------------

  function getConfig() {
    return {
      shop: root?.dataset.shop || "",
      customerId: root?.dataset.customerId || "",
      customerName: root?.dataset.customerName || "",
      customerEmail: root?.dataset.customerEmail || "",
      customerPhone: root?.dataset.customerPhone || "",
      customerCountry: root?.dataset.customerCountry || "",
      customerRegion: root?.dataset.customerRegion || "",
      customerAddress: root?.dataset.customerAddress || "",
      currency: root?.dataset.currency || "USD",
      proxyPath: root?.dataset.proxyPath || "/apps/request-a-quote",
      accountLoginUrl: root?.dataset.accountLoginUrl || "/account/login",
      accountLogoutUrl: root?.dataset.accountLogoutUrl || "/account/logout",
      buttonLabel:
        widgetSettings.widgetButtonText ||
        root?.dataset.buttonLabel ||
        "Get Quote",
    };
  }

  function normalizeStoragePart(value, fallback) {
    return String(value || fallback)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9@._:-]+/g, "-");
  }

  function randomStorageId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getGuestSessionId() {
    let guestSessionId = sessionStorage.getItem(GUEST_SESSION_KEY);
    if (!guestSessionId) {
      guestSessionId = randomStorageId();
      sessionStorage.setItem(GUEST_SESSION_KEY, guestSessionId);
    }
    return guestSessionId;
  }

  function customerIdentity(config = getConfig()) {
    return config.customerId || config.customerEmail || "";
  }

  function refreshStorageIdentity() {
    const identity = customerIdentity();
    const previousIdentity = sessionStorage.getItem(LAST_IDENTITY_KEY) || "";
    if (!identity && previousIdentity && !previousIdentity.startsWith("guest:")) {
      sessionStorage.removeItem(GUEST_SESSION_KEY);
    }

    const currentIdentity = identity
      ? `customer:${normalizeStoragePart(identity, "customer")}`
      : `guest:${normalizeStoragePart(getGuestSessionId(), "guest")}`;
    sessionStorage.setItem(LAST_IDENTITY_KEY, currentIdentity);
    return currentIdentity;
  }

  function storageScope() {
    const config = getConfig();
    const shop = normalizeStoragePart(config.shop || window.Shopify?.shop, "unknown-shop");
    const identity = customerIdentity(config)
      ? `customer:${normalizeStoragePart(customerIdentity(config), "customer")}`
      : `guest:${normalizeStoragePart(getGuestSessionId(), "guest")}`;
    return `${shop}:${identity}`;
  }

  const cartStorageKey = () => `${CART_KEY_PREFIX}:${storageScope()}`;
  const historyStorageKey = () => `${HISTORY_KEY_PREFIX}:${storageScope()}`;
  const chatAttachmentsStorageKey = () =>
    `${CHAT_ATTACHMENTS_KEY_PREFIX}:${storageScope()}`;

  function loadCart() {
    cart = read(cartStorageKey(), []);
  }

  function saveCart() {
    write(cartStorageKey(), cart);
    updateFloatingButton();
  }

  function updateFloatingButton() {
    const button = document.querySelector(".sp-rfq-floating");
    if (!button) return;
    if (button.classList.contains("is-success")) return;
    const count = cart.reduce((sum, item) => sum + Number(item.quantity), 0);
    applyWidgetSettingsToFloatingButton(button);
    renderFloatingButtonContent(button, count);
  }

  async function loadWidgetSettings() {
    const config = getConfig();
    try {
      const response = await fetch(`${config.proxyPath}/settings`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Could not load widget settings");
      const data = await response.json();
      widgetSettings = { ...widgetSettings, ...data.settings };
    } catch (error) {
      console.warn("[SP RFQ] Could not load widget settings.", error);
      // Keep the local bootstrap fallback. The server owns validation and
      // normalization, so the storefront does not maintain a second rule set.
    }
  }

  function applyWidgetSettingsToFloatingButton(button) {
    button.hidden = !shouldShowFloatingWidget();
    button.setAttribute("aria-label", getConfig().buttonLabel);
    button.style.setProperty("--sp-rfq-floating-bg", widgetSettings.widgetBackgroundColor);
    button.style.setProperty("--sp-rfq-floating-color", widgetSettings.widgetTextColor);
    button.className = [
      "sp-rfq-floating",
      `sp-rfq-floating--${widgetSettings.widgetStyle}`,
      `sp-rfq-floating--${widgetSettings.widgetSize}`,
      `sp-rfq-floating--${widgetSettings.widgetOrientation}`,
      `sp-rfq-floating--desktop-${widgetSettings.widgetDesktopPosition}`,
      `sp-rfq-floating--mobile-${widgetSettings.widgetMobilePosition}`,
      widgetSettings.widgetStyle === "icon" && widgetSettings.widgetIconDataUrl
        ? "sp-rfq-floating--custom-icon"
        : "",
      widgetSettings.widgetAnimation !== "none"
        ? `sp-rfq-floating--${widgetSettings.widgetAnimation}`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  function renderFloatingButtonContent(button, count) {
    const label = getConfig().buttonLabel;
    if (widgetSettings.widgetStyle === "icon") {
      button.innerHTML = `
        <span class="sp-rfq-floating-icon">${
          widgetSettings.widgetIconDataUrl
            ? `<img class="sp-rfq-floating-icon-img" src="${escapeHtml(
                widgetSettings.widgetIconDataUrl,
              )}" alt="">`
            : icons.cart
        }</span>
        ${count ? `<span class="sp-rfq-floating-badge">${count}</span>` : ""}
      `;
      return;
    }

    button.textContent = `${label}${count ? ` (${count})` : ""}`;
  }

  function shouldShowFloatingWidget() {
    if (widgetSettings.widgetDisplayMode !== "specific") return true;

    const rules = widgetSettings.widgetSpecificPages
      .split(/[\n,]+/)
      .map((rule) => rule.trim())
      .filter(Boolean);
    if (!rules.length) return false;

    const currentPath = normalizeWidgetPath(window.location.pathname);
    return rules.some((rule) => {
      const normalizedRule = normalizeWidgetPath(rule);
      if (normalizedRule === "/*" || normalizedRule === "*") return true;
      if (normalizedRule.endsWith("*")) {
        return currentPath.startsWith(normalizedRule.slice(0, -1));
      }
      return currentPath === normalizedRule;
    });
  }

  function normalizeWidgetPath(value) {
    const path = String(value || "").trim();
    if (!path || path === "*") return path;
    try {
      const parsed = path.startsWith("http")
        ? new URL(path).pathname
        : path;
      return parsed.startsWith("/") ? parsed : `/${parsed}`;
    } catch {
      return path.startsWith("/") ? path : `/${path}`;
    }
  }

  function showFloatingAddSuccess() {
    const button = document.querySelector(".sp-rfq-floating");
    if (!button) return;
    if (floatingSuccessTimer) window.clearTimeout(floatingSuccessTimer);
    const currentWidth = Math.ceil(button.getBoundingClientRect().width);
    if (currentWidth > 0) {
      button.style.setProperty("--sp-rfq-success-width", `${currentWidth}px`);
    }
    button.classList.add("is-success");
    button.setAttribute("aria-label", "Added to quote");
    button.innerHTML =
      '<svg class="sp-rfq-floating-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17l9-10"></path></svg>';
    floatingSuccessTimer = window.setTimeout(() => {
      button.classList.remove("is-success");
      button.style.removeProperty("--sp-rfq-success-width");
      floatingSuccessTimer = null;
      updateFloatingButton();
    }, 1200);
  }

  function normalizeShopifyResourceId(id) {
    return String(id || "").split("/").pop() || "";
  }

  function quoteCartItemKey(product) {
    const variantId = normalizeShopifyResourceId(product.variantId);
    const productId = normalizeShopifyResourceId(product.productId);
    if (variantId) return `variant:${variantId}`;
    if (productId) return `product:${productId}`;
    return `title:${String(product.title || "Product").trim().toLowerCase()}`;
  }

  function sameQuoteCartItem(item, product, key) {
    const itemVariantId = normalizeShopifyResourceId(item.variantId);
    const productVariantId = normalizeShopifyResourceId(product.variantId);
    const itemProductId = normalizeShopifyResourceId(item.productId);
    const productProductId = normalizeShopifyResourceId(product.productId);

    return (
      item.key === key ||
      Boolean(itemVariantId && productVariantId && itemVariantId === productVariantId) ||
      Boolean(itemProductId && productProductId && itemProductId === productProductId)
    );
  }

  function addProduct(product) {
    const key = quoteCartItemKey(product);
    const quantity = Math.max(1, Number(product.quantity || 1));
    const unitPrice = Number(product.unitPrice || 0);
    const existing = cart.find((item) => sameQuoteCartItem(item, product, key));
    if (existing) {
      existing.key = key;
      existing.productId = product.productId || existing.productId || "";
      existing.variantId = product.variantId || existing.variantId || "";
      existing.imageUrl = product.imageUrl || existing.imageUrl || "";
      existing.variantTitle =
        product.variantTitle || existing.variantTitle || "";
      existing.compareAtPrice = Number(
        product.compareAtPrice || existing.compareAtPrice || 0,
      );
      existing.inventoryStatus =
        product.inventoryStatus ||
        (product.inventoryQuantity !== null &&
        product.inventoryQuantity !== undefined &&
        Number(product.inventoryQuantity) <= 0
          ? "OUT_OF_STOCK"
          : existing.inventoryStatus || "AVAILABLE");
      existing.inventoryQuantity =
        product.inventoryQuantity === undefined
          ? existing.inventoryQuantity ?? null
          : Number(product.inventoryQuantity);
      existing.quantity += quantity;
      if (unitPrice > 0) {
        existing.unitPrice = unitPrice;
        existing.quotePrice = unitPrice;
      }
    } else {
      cart.push({
        key,
        productId: product.productId || "",
        variantId: product.variantId || "",
        title: product.title || "Product",
        variantTitle: product.variantTitle || "",
        imageUrl: product.imageUrl || "",
        quantity,
        unitPrice,
        quotePrice: unitPrice,
        included: true,
        inventoryStatus:
          product.inventoryStatus ||
          (product.inventoryQuantity !== null &&
          product.inventoryQuantity !== undefined &&
          Number(product.inventoryQuantity) <= 0
            ? "OUT_OF_STOCK"
            : "AVAILABLE"),
        inventoryQuantity:
          product.inventoryQuantity === undefined
            ? null
            : Number(product.inventoryQuantity),
        compareAtPrice: Number(product.compareAtPrice || 0),
      });
    }
    saveCart();
  }

  // ---------------------------------------------------------------------------
  // Storefront product parsing and Add to Quote buttons
  // ---------------------------------------------------------------------------

  function productFromButton(button) {
    const productForm = button.closest('form[action*="/cart/add"]');
    const pageForm =
      productForm || document.querySelector('form[action*="/cart/add"]');
    const variantInput = pageForm?.querySelector('[name="id"]');
    const unitPrice =
      Number(button.dataset.price || 0) ||
      readVisibleProductPrice() ||
      Number(
        document.querySelector('meta[property="product:price:amount"]')
          ?.content || 0,
      );

    return {
      productId: getAddButtonProductId(button),
      variantId: variantInput?.value || button.dataset.variantId,
      title:
        button.dataset.title ||
        document.querySelector("h1")?.textContent?.trim(),
      imageUrl:
        button.dataset.image ||
        document.querySelector('meta[property="og:image"]')?.content ||
        "",
      quantity: readProductQuantity(pageForm, button),
      unitPrice,
      compareAtPrice:
        Number(button.dataset.compareAtPrice || 0) ||
        readVisibleCompareAtPrice(),
      inventoryStatus:
        button.dataset.inventoryStatus ||
        button.dataset.status ||
        readProductInventoryStatus(pageForm, button),
    };
  }

  function readCurrentProductId(scope) {
    const scopedProductId =
      scope?.dataset?.productId ||
      scope?.closest?.("[data-product-id]")?.dataset?.productId ||
      scope?.querySelector?.("[data-product-id]")?.dataset?.productId ||
      "";
    if (scopedProductId) return scopedProductId;

    const analyticsProductId =
      window.ShopifyAnalytics?.meta?.product?.id ||
      window.ShopifyAnalytics?.meta?.selectedVariantId?.product_id ||
      "";
    if (analyticsProductId) return String(analyticsProductId);

    const productJson = document.querySelector(
      'script[type="application/json"][data-product-json], script[type="application/json"][id*="ProductJson"], script[type="application/json"][id*="product-json"]',
    );
    if (productJson?.textContent) {
      try {
        const parsed = JSON.parse(productJson.textContent);
        if (parsed?.id) return String(parsed.id);
        if (parsed?.product?.id) return String(parsed.product.id);
      } catch {
        // Ignore malformed theme JSON and fall back to showing the button.
      }
    }

    return "";
  }

  function getAddButtonProductId(button) {
    return (
      button?.dataset?.productId ||
      readCurrentProductId(button?.closest?.('form[action*="/cart/add"]')) ||
      ""
    );
  }

  function productInfoScope(button) {
    return (
      button?.closest?.(
        'product-info, .product, .product__info-container, .product-form, section[id*="Product"], [id*="ProductInfo"]',
      ) || document
    );
  }

  function findBuyButtonsAnchor(button) {
    const scope = productInfoScope(button);
    const paymentButton = scope.querySelector(
      ".shopify-payment-button, .shopify-payment-button__button",
    );
    if (paymentButton) {
      return paymentButton.closest(".shopify-payment-button") || paymentButton;
    }

    const cartForm = scope.querySelector('form[action*="/cart/add"]');
    if (cartForm) return cartForm;

    const addToCartButton = scope.querySelector(
      'button[name="add"], button[type="submit"], .product-form__submit',
    );
    return addToCartButton?.closest("form") || addToCartButton || null;
  }

  function positionAddToQuoteButtons() {
    document.querySelectorAll("[data-rfq-add]").forEach((button) => {
      const anchor = findBuyButtonsAnchor(button);
      if (!anchor || anchor === button || anchor.contains(button)) return;
      if (anchor.nextElementSibling === button) return;
      anchor.insertAdjacentElement("afterend", button);
    });
  }

  async function fetchProductEligibility(productIds) {
    const idsToLoad = productIds
      .map(normalizeShopifyResourceId)
      .filter(Boolean)
      .filter((id) => !productEligibilityCache.has(id));

    if (idsToLoad.length) {
      const config = getConfig();
      const query = new URLSearchParams({ productIds: idsToLoad.join(",") });
      const response = await fetch(`${config.proxyPath}/eligibility?${query}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Could not load product eligibility");
      const data = await response.json();
      Object.entries(data.eligibleByProductId || {}).forEach(
        ([productId, eligible]) => {
          productEligibilityCache.set(
            normalizeShopifyResourceId(productId),
            Boolean(eligible),
          );
        },
      );
    }

    return Object.fromEntries(
      productIds.map((productId) => {
        const normalizedProductId = normalizeShopifyResourceId(productId);
        return [
          normalizedProductId,
          productEligibilityCache.get(normalizedProductId) !== false,
        ];
      }),
    );
  }

  async function syncAddButtonEligibility() {
    const buttons = Array.from(document.querySelectorAll("[data-rfq-add]"));
    const productIds = buttons.map(getAddButtonProductId).filter(Boolean);
    if (!productIds.length) return;

    buttons.forEach((button) => {
      const productId = getAddButtonProductId(button);
      if (productId) {
        button.dataset.productId = productId;
        button.dataset.rfqEligibilityPending = "true";
        button.hidden = true;
      }
    });

    try {
      const eligibleByProductId = await fetchProductEligibility(productIds);
      buttons.forEach((button) => {
        const productId = normalizeShopifyResourceId(getAddButtonProductId(button));
        if (!productId) return;
        const isEligible = eligibleByProductId[productId] !== false;
        button.hidden = !isEligible;
        button.dataset.rfqEligible = String(isEligible);
        button.dataset.rfqEligibilityPending = "false";
      });
    } catch (error) {
      console.warn("[SP RFQ] Could not check product quote eligibility.", error);
      buttons.forEach((button) => {
        button.hidden = false;
        button.dataset.rfqEligibilityPending = "false";
      });
    }
  }

  function readProductInventoryStatus(pageForm, button) {
    const text = [
      button?.textContent,
      pageForm?.textContent,
      document.querySelector(".product-form__submit")?.textContent,
      document.querySelector("[name='add']")?.textContent,
    ]
      .join(" ")
      .toLowerCase();
    const submitButton =
      pageForm?.querySelector('[type="submit"], [name="add"]') ||
      document.querySelector('form[action*="/cart/add"] [type="submit"]');
    if (
      button?.disabled ||
      submitButton?.disabled ||
      text.includes("sold out") ||
      text.includes("out of stock")
    ) {
      return "OUT_OF_STOCK";
    }
    return "AVAILABLE";
  }

  function readProductQuantity(pageForm, button) {
    const selectors =
      'input[name="quantity"], input[id*="Quantity"], input[class*="quantity"], input[type="number"], quantity-input input, .quantity__input, [data-quantity-input]';
    const productScope = button?.closest(
      'product-info, .product, .product__info-container, .product-form, section, [id*="ProductInfo"]',
    );
    const candidates = uniqueElements([
      ...(productScope
        ? Array.from(productScope.querySelectorAll(selectors))
        : []),
      ...(pageForm ? Array.from(pageForm.querySelectorAll(selectors)) : []),
      ...Array.from(document.querySelectorAll(selectors)),
    ]).filter((input) => !input.disabled);

    const inputWithChangedQuantity = candidates.find((input) => {
      const value = Number(input.value || input.getAttribute("value") || 0);
      return value > 1;
    });

    const visibleInput = candidates.find((input) => {
      const rect = input.getBoundingClientRect?.();
      const value = Number(input.value || input.getAttribute("value") || 0);
      return value > 0 && rect && rect.width > 0 && rect.height > 0;
    });

    return Math.max(
      1,
      Number(
        inputWithChangedQuantity?.value ||
          visibleInput?.value ||
          inputWithChangedQuantity?.getAttribute("aria-valuenow") ||
          visibleInput?.getAttribute("aria-valuenow") ||
          inputWithChangedQuantity?.getAttribute("data-value") ||
          visibleInput?.getAttribute("data-value") ||
          1,
      ),
    );
  }

  function uniqueElements(elements) {
    return Array.from(new Set(elements.filter(Boolean)));
  }

  function readVisibleProductPrice() {
    const selectors = [
      ".price-item--regular",
      ".price-item--sale",
      ".price__regular .price-item",
      ".price__sale .price-item",
      "[data-product-price]",
      ".product__price",
      ".price",
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const price = parseMoney(element?.textContent || "");
      if (price > 0) return price;
    }

    return 0;
  }

  function readVisibleCompareAtPrice() {
    const selectors = [
      ".price__sale .price-item--regular",
      ".price-item--regular s",
      "s.price-item",
      ".price .price-item--regular",
      "[data-compare-price]",
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const price = parseMoney(element?.textContent || "");
      if (price > 0) return price;
    }

    return 0;
  }

  function parseMoney(value) {
    const match = String(value || "")
      .replace(/,/g, "")
      .match(/[-+]?\d*\.?\d+/);
    return match ? Number(match[0]) : 0;
  }

  function bindAddButtons() {
    document.querySelectorAll("[data-rfq-add]").forEach((button) => {
      if (button.dataset.rfqBound) return;
      button.dataset.rfqBound = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.dataset.rfqEligible === "false") return;
        addProduct(productFromButton(button));
        showFloatingAddSuccess();
        window.setTimeout(() => openModal("cart"), 260);
      });
    });

    const hasManualAddToQuoteBlock = Boolean(
      document.querySelector("[data-rfq-add]"),
    );
    let insertedAutoAddToQuote = false;

    document.querySelectorAll('form[action*="/cart/add"]').forEach((form) => {
      if (hasManualAddToQuoteBlock || form.querySelector("[data-rfq-add]"))
        return;
      if (insertedAutoAddToQuote) return;
      const variantInput = form.querySelector('[name="id"]');
      const priceMeta = document.querySelector(
        'meta[property="product:price:amount"]',
      );
      const image =
        document.querySelector('meta[property="og:image"]')?.content || "";
      const title =
        document.querySelector("h1")?.textContent?.trim() || "Product";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sp-rfq-add";
      button.dataset.rfqAdd = "";
      button.dataset.productId = readCurrentProductId(form);
      button.dataset.variantId = variantInput?.value || "";
      button.dataset.title = title;
      button.dataset.price = priceMeta?.content || "0";
      button.dataset.image = image;
      button.textContent = "Add to Quote";
      form.appendChild(button);
      insertedAutoAddToQuote = true;
    });

    document.querySelectorAll("[data-rfq-add]").forEach((button) => {
      if (button.dataset.rfqBound) return;
      button.dataset.rfqBound = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.dataset.rfqEligible === "false") return;
        addProduct(productFromButton(button));
        showFloatingAddSuccess();
        window.setTimeout(() => openModal("cart"), 260);
      });
    });

    positionAddToQuoteButtons();
    syncAddButtonEligibility();
  }

  // ---------------------------------------------------------------------------
  // Modal shell, header controls, tooltips, and product search dialog shell
  // ---------------------------------------------------------------------------
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
