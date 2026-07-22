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
