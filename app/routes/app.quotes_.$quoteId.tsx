import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
  useRevalidator,
  useRouteError,
  useSearchParams,
} from "react-router";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { getQuoteStatusLabel, getQuoteStatusTone } from "~/lib/quote-status";
import {
  addMessage,
  addQuoteItem,
  getQuote,
  markQuoteRead,
  markQuoteConverted,
  updateQuotePrices,
  updateQuoteStatus,
} from "~/models/quote.server";
import { authenticate } from "~/shopify.server";
import styles from "~/styles/quotes.module.css";

const validStatuses = [
  "REQUESTED_BY_CUSTOMER",
  "NEGOTIATING",
  "OFFERED_BY_MERCHANT",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CONVERTED_TO_ORDER",
] as const;

type AdminProductSearchItem = {
  productId: string;
  variantId: string;
  title: string;
  variantTitle: string;
  sku: string;
  price: number;
  imageUrl: string;
};

type AdminProductSearchData = {
  products: AdminProductSearchItem[];
};


async function getLiveCustomerInfo(admin: unknown, customerId?: string | null) {
  if (!customerId) return null;
  const numericId = customerId.split("/").pop();
  if (!numericId) return null;

  try {
    const response = await (
      admin as {
        graphql: (
          query: string,
          options: { variables: Record<string, string> },
        ) => Promise<Response>;
      }
    ).graphql(
      `#graphql
        query QuoteCustomer($id: ID!) {
          customer(id: $id) {
            displayName
            defaultEmailAddress {
              emailAddress
            }
            defaultPhoneNumber {
              phoneNumber
            }
            defaultAddress {
              address1
              city
              province
              country
            }
          }
        }
      `,
      {
        variables: { id: `gid://shopify/Customer/${numericId}` },
      },
    );
    const payload = (await response.json()) as {
      data?: {
        customer?: {
          displayName?: string | null;
          defaultEmailAddress?: { emailAddress?: string | null } | null;
          defaultPhoneNumber?: { phoneNumber?: string | null } | null;
          defaultAddress?: {
            address1?: string | null;
            city?: string | null;
            province?: string | null;
            country?: string | null;
          } | null;
        } | null;
      };
    };
    const customer = payload.data?.customer;
    if (!customer) return null;
    const address = [
      customer.defaultAddress?.address1,
      customer.defaultAddress?.city,
      customer.defaultAddress?.country,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      customerName: customer.displayName || null,
      customerEmail: customer.defaultEmailAddress?.emailAddress || null,
      customerPhone: customer.defaultPhoneNumber?.phoneNumber || null,
      customerCountry: customer.defaultAddress?.country || null,
      customerRegion: customer.defaultAddress?.province || null,
      customerAddress: address || null,
    };
  } catch (error) {
    console.warn("[RFQ] Could not load live customer info.", error);
    return null;
  }
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const quote = await getQuote(session.shop, params.quoteId ?? "");
  if (!quote) throw new Response("Quote not found", { status: 404 });
  await markQuoteRead({
    shop: session.shop,
    quoteId: quote.id,
    viewer: "MANAGER",
    viewerId: "manager",
  });
  const liveCustomer = await getLiveCustomerInfo(admin, quote.customerId);
  const hydratedQuote = liveCustomer
    ? {
        ...quote,
        customerName:
          quote.customerName && quote.customerName !== "Demo buyer"
            ? quote.customerName
            : liveCustomer.customerName,
        customerEmail: quote.customerEmail || liveCustomer.customerEmail,
        customerPhone: quote.customerPhone || liveCustomer.customerPhone,
        customerCountry: quote.customerCountry || liveCustomer.customerCountry,
        customerRegion: quote.customerRegion || liveCustomer.customerRegion,
        customerAddress:
          (quote as typeof quote & { customerAddress?: string | null })
            .customerAddress || liveCustomer.customerAddress,
      }
    : quote;

  const shopHandle = session.shop.replace(".myshopify.com", "");
  const draftOrderNumericId = hydratedQuote.orderId?.split("/").pop();

  return {
    quote: hydratedQuote,
    draftOrderAdminUrl:
      draftOrderNumericId && hydratedQuote.orderId
        ? `https://admin.shopify.com/store/${shopHandle}/draft_orders/${draftOrderNumericId}`
        : null,
  };
};

function readPrices(formData: FormData) {
  return [...formData.entries()]
    .filter(([key]) => key.startsWith("price:"))
    .map(([key, value]) => {
      const id = key.slice("price:".length);
      return {
        id,
        quotePrice: Number(value),
        quantity: Number(formData.get(`qty:${id}`) ?? 1),
      };
    });
}

function formatProductTitleList(titles: string[]) {
  const visibleTitles = titles.slice(0, 3).map((title) => `“${title}”`);
  if (titles.length === 1) return visibleTitles[0];
  if (titles.length === 2) return `${visibleTitles[0]} and ${visibleTitles[1]}`;
  if (titles.length === 3) {
    return `${visibleTitles[0]}, ${visibleTitles[1]}, and ${visibleTitles[2]}`;
  }
  return `${visibleTitles[0]}, ${visibleTitles[1]}, ${visibleTitles[2]}, and ${
    titles.length - 3
  } more products`;
}

function isSystemQuoteMessage(message: string) {
  return (
    message.startsWith("The seller ") ||
    message.startsWith("The customer ") ||
    message === "A new price offer has been sent."
  );
}

async function readMessageAttachments(formData: FormData) {
  const files = formData
    .getAll("attachments")
    .map(async (value) => {
      if (
        !value ||
        typeof value !== "object" ||
        !("name" in value) ||
        !("size" in value)
      ) {
        return null;
      }

      const file = value as File;
      if (!file.name || file.size <= 0) return null;
      const type = file.type || "application/octet-stream";
      const fileUrl = `data:${type};base64,${Buffer.from(
        await file.arrayBuffer(),
      ).toString("base64")}`;

      return {
        fileName: file.name,
        fileUrl,
        mimeType: `${type};size=${file.size}`,
      };
    })
  const attachments = await Promise.all(files);
  return attachments.filter((file): file is NonNullable<typeof file> =>
    Boolean(file),
  );
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const quoteId = params.quoteId ?? "";

  try {
    if (intent === "message") {
      const message = String(formData.get("message") ?? "").trim();
      const attachments = await readMessageAttachments(formData);
      if (!message && attachments.length === 0) {
        return { ok: false, error: "Message or attachment is required." };
      }

      await addMessage({
        quoteId,
        shop: session.shop,
        sender: "MANAGER",
        senderName: "Manager",
        message,
        attachments,
      });
      return { ok: true, message: "Message sent." };
    }

    if (intent === "save_prices" || intent === "send_offer") {
      const quote = await getQuote(session.shop, quoteId);
      if (!quote) return { ok: false, error: "Quote not found." };
      if (
        quote.status === "OFFERED_BY_MERCHANT" ||
        quote.status === "ACCEPTED" ||
        quote.status === "DECLINED" ||
        String(quote.status) === "EXPIRED" ||
        quote.status === "CONVERTED_TO_ORDER" ||
        quote.orderId
      ) {
        return {
          ok: false,
          error:
            quote.status === "OFFERED_BY_MERCHANT"
              ? "Reopen this quote before editing or sending a new offer."
              : "This quote can no longer be edited.",
        };
      }

      const items = readPrices(formData);
      if (items.length === 0) {
        return { ok: false, error: "No quote prices were submitted." };
      }

      const updateResult = await updateQuotePrices({
        quoteId,
        shop: session.shop,
        items,
        status: intent === "send_offer" ? "OFFERED_BY_MERCHANT" : undefined,
      });

      if (intent === "send_offer") {
        await addMessage({
          quoteId,
          shop: session.shop,
          sender: "MANAGER",
          senderName: "Manager",
          message: "A new price offer has been sent.",
        });
      } else if (updateResult.quantityChanges.length > 0) {
        await addMessage({
          quoteId,
          shop: session.shop,
          sender: "MANAGER",
          senderName: "Manager",
          message: `The seller updated quantities for ${formatProductTitleList(
            updateResult.quantityChanges.map((item) => item.title),
          )}.`,
        });
      } else if (updateResult.priceChanges.length > 0) {
        await addMessage({
          quoteId,
          shop: session.shop,
          sender: "MANAGER",
          senderName: "Manager",
          message: "The seller updated quote pricing.",
        });
      }

      return {
        ok: true,
        message:
          intent === "send_offer"
            ? "Offer sent to the customer."
            : "Quote prices saved.",
      };
    }

    if (intent === "add_quote_items") {
      const quote = await getQuote(session.shop, quoteId);
      if (!quote) return { ok: false, error: "Quote not found." };
      if (
        quote.status === "OFFERED_BY_MERCHANT" ||
        quote.status === "ACCEPTED" ||
        quote.status === "DECLINED" ||
        String(quote.status) === "EXPIRED" ||
        quote.status === "CONVERTED_TO_ORDER" ||
        quote.orderId
      ) {
        return {
          ok: false,
          error:
            quote.status === "OFFERED_BY_MERCHANT"
              ? "Reopen this quote before adding products."
              : "This quote can no longer be edited.",
        };
      }

      const selectedProducts = JSON.parse(
        String(formData.get("selectedProducts") ?? "[]"),
      ) as AdminProductSearchItem[];

      const validProducts = selectedProducts.filter(
        (product) =>
          product.title?.trim() &&
          Number.isFinite(Number(product.price)) &&
          product.variantId &&
          !quote.items.some(
            (item) =>
              item.variantId === product.variantId ||
              (!!item.productId && item.productId === product.productId),
          ),
      );

      if (validProducts.length === 0) {
        return { ok: false, error: "Please select at least one product." };
      }

      await Promise.all(
        validProducts.map((product) => {
          const unitPrice = Number(product.price);

          return addQuoteItem({
            shop: session.shop,
            quoteId,
            productId: product.productId,
            variantId: product.variantId,
            title: product.title,
            imageUrl: product.imageUrl,
            sku: product.sku,
            quantity: 1,
            unitPrice,
            quotePrice: unitPrice,
          });
        }),
      );

      await addMessage({
        quoteId,
        shop: session.shop,
        sender: "MANAGER",
        senderName: "Manager",
        message: `The seller added ${formatProductTitleList(
          validProducts.map((product) => product.title),
        )} to this quote.`,
      });

      return { ok: true, message: "Products added to quote." };
    }

    if (intent === "status") {
      const status = String(formData.get("status") ?? "");
      if (!validStatuses.includes(status as (typeof validStatuses)[number])) {
        return { ok: false, error: "Invalid quote status." };
      }
      const quote = await getQuote(session.shop, quoteId);
      if (!quote) return { ok: false, error: "Quote not found." };
      const isReopenRequest = status === "NEGOTIATING";
      const canReopenQuote =
        quote.status === "DECLINED" || String(quote.status) === "EXPIRED";
      const canReviseQuote = quote.status === "OFFERED_BY_MERCHANT";
      if (!isReopenRequest || (!canReopenQuote && !canReviseQuote)) {
        return { ok: false, error: "This quote cannot be reopened or revised." };
      }

      await updateQuoteStatus(
        session.shop,
        quoteId,
        status as never,
      );
      await addMessage({
        quoteId,
        shop: session.shop,
        sender: "MANAGER",
        senderName: "Manager",
        message: canReviseQuote
          ? "The seller is revising this offer. You will be able to accept or decline after a new quote is sent."
          : "The seller reopened this quote. You can continue the negotiation.",
      });
      return { ok: true, message: "Quote status updated." };
    }

    if (intent === "convert_order") {
      const quote = await getQuote(session.shop, quoteId);
      if (!quote) return { ok: false, error: "Quote not found." };
      if (quote.status !== "ACCEPTED") {
        return {
          ok: false,
          error: "Only an accepted quote can be converted to a Draft Order.",
        };
      }
      if (quote.orderId) {
        return { ok: false, error: "This quote was already converted." };
      }

      const response = await admin.graphql(
        `#graphql
          mutation CreateQuoteDraftOrder($input: DraftOrderInput!) {
            draftOrderCreate(input: $input) {
              draftOrder {
                id
                name
                invoiceUrl
              }
              userErrors {
                field
                message
              }
            }
          }`,
        {
          variables: {
            input: {
              email: quote.customerEmail || undefined,
              note: [`Created from ${quote.quoteNumber}.`, quote.note || ""]
                .filter(Boolean)
                .join("\n"),
              tags: ["RFQ", quote.quoteNumber],
              customAttributes: [{ key: "Quote ID", value: quote.quoteNumber }],
              lineItems: quote.items.map((item) => ({
                title: item.title,
                quantity: item.quantity,
                originalUnitPrice: item.quotePrice,
                ...(item.sku ? { sku: item.sku } : {}),
              })),
            },
          },
        },
      );
      const result = await response.json();
      const payload = result.data?.draftOrderCreate;
      const userErrors = payload?.userErrors ?? [];

      if (userErrors.length > 0 || !payload?.draftOrder) {
        return {
          ok: false,
          error:
            userErrors
              .map((error: { message: string }) => error.message)
              .join(" ") || "Shopify could not create the Draft Order.",
        };
      }

      await markQuoteConverted({
        shop: session.shop,
        quoteId,
        orderId: payload.draftOrder.id,
        orderName: payload.draftOrder.name,
        orderInvoiceUrl: payload.draftOrder.invoiceUrl,
      });

      await addMessage({
        quoteId,
        shop: session.shop,
        sender: "MANAGER",
        senderName: "Manager",
        message: `Quote converted to Draft Order ${payload.draftOrder.name}.`,
      });

      return {
        ok: true,
        message: `Draft Order ${payload.draftOrder.name} created.`,
      };
    }

    return { ok: false, error: "Unknown action." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
};

const money = (value: string | number | null | undefined, currency: string) => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
};

const moneyInputValue = (value: string | number | null | undefined) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0";
  return String(Number(amount.toFixed(2)));
};

async function fetchAdminProducts(
  pathname: string,
  currentSearch: string,
  query: string,
) {
  const params = new URLSearchParams(currentSearch);
  params.set("q", query);
  const response = await fetch(`${pathname}/products?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Could not load products: HTTP ${response.status}`);
  }

  return (await response.json()) as AdminProductSearchData;
}

const shortDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value || Date.now()));

const messageTime = (value: string | Date, isLatest = false) => {
  const date = new Date(value || Date.now());
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  if (isLatest && isSameDay) return `Today ${time}`;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const shouldShowMessageTime = (
  messages: Array<{ sender: string; createdAt: string | Date }>,
  index: number,
) => {
  const current = messages[index];
  const next = messages[index + 1];
  if (!current || !next) return true;
  if (current.sender !== next.sender) return true;

  const currentTime = new Date(current.createdAt).getTime();
  const nextTime = new Date(next.createdAt).getTime();
  if (!Number.isFinite(currentTime) || !Number.isFinite(nextTime)) return true;

  return nextTime - currentTime > 5 * 60 * 1000;
};

const formatFileSize = (size: number | null | undefined) => {
  const value = Number(size ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
};

const attachmentMeta = (file: {
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
}) => {
  const [mimeType = "", ...params] = String(file.mimeType ?? "").split(";");
  const sizeParam = params
    .map((param) => param.trim())
    .find((param) => param.startsWith("size="));
  const size = sizeParam ? Number(sizeParam.slice("size=".length)) : 0;
  const extension =
    file.fileName.split(".").pop()?.toUpperCase() ||
    mimeType.split("/").pop()?.toUpperCase() ||
    "FILE";
  const isImage =
    mimeType.startsWith("image/") && file.fileUrl.startsWith("data:image/");

  return {
    extension,
    fileSize: formatFileSize(size),
    isImage,
    mimeType,
  };
};

const currencyNames: Record<string, string> = {
  CAD: "Canadian Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  JPY: "Japanese Yen",
  USD: "US Dollar",
  VND: "Vietnamese Dong",
};

export default function QuoteDetailsPage() {
  const { quote, draftOrderAdminUrl } = useLoaderData<typeof loader>() as Awaited<
    ReturnType<typeof loader>
  > & {
    quote: NonNullable<Awaited<ReturnType<typeof loader>>["quote"]>;
    draftOrderAdminUrl: string | null;
  };
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const [itemSearch, setItemSearch] = useState("");
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<
    AdminProductSearchItem[]
  >([]);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            placeholderData: (previousData: unknown) => previousData,
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5000,
          },
        },
      }),
  );
  const itemSearchRef = useRef<HTMLInputElement>(null);
  const productSearchAreaRef = useRef<HTMLDivElement>(null);
  const firstQuotePriceInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatPanelRef = useRef<HTMLElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatAttachments, setChatAttachments] = useState<
    Array<{ file: File; preview?: string }>
  >([]);
  type ConversationMessage = (typeof quote.messages)[number];
  const [optimisticMessages, setOptimisticMessages] = useState<
    ConversationMessage[]
  >([]);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const isSubmitting = navigation.state === "submitting";
  const hasChatContent = chatMessage.trim().length > 0 || chatAttachments.length > 0;
  const productsQuery = useQuery<AdminProductSearchData>(
    {
      enabled: isProductDropdownOpen,
      queryKey: [
        "admin-quote-products",
        location.pathname,
        location.search,
        debouncedItemSearch,
      ],
      queryFn: () =>
        fetchAdminProducts(
          location.pathname,
          location.search,
          debouncedItemSearch,
        ),
      placeholderData: (previousData) => previousData,
    },
    queryClient,
  );
  const mode = searchParams.get("mode") ?? "";
  const focus = searchParams.get("focus") ?? "";
  const isViewMode = mode === "view";
  const isEditMode = mode === "edit" || (!mode && !focus);
  const isChatMode = focus === "chat";
  const isLockedStatus =
    quote.status === "OFFERED_BY_MERCHANT" ||
    quote.status === "ACCEPTED" ||
    quote.status === "DECLINED" ||
    String(quote.status) === "EXPIRED" ||
    quote.status === "CONVERTED_TO_ORDER";
  const isPriceReadOnly = isViewMode || isLockedStatus || Boolean(quote.orderId);
  const tone = getQuoteStatusTone(quote.status);
  const canSendOffer =
    quote.status === "REQUESTED_BY_CUSTOMER" ||
    quote.status === "NEGOTIATING";
  const canReopen =
    quote.status === "DECLINED" || String(quote.status) === "EXPIRED";
  const canRevise = quote.status === "OFFERED_BY_MERCHANT";
  const canConvert = quote.status === "ACCEPTED" && !quote.orderId;
  const pageTitle = `Quote Details - ${quote.quoteNumber}`;
  const pdfSearch = new URLSearchParams(location.search);
  pdfSearch.delete("mode");
  pdfSearch.delete("focus");
  const pdfQuery = pdfSearch.toString();
  const pdfHref = `/app/quotes/${quote.id}/pdf${pdfQuery ? `?${pdfQuery}` : ""}`;
  const editSearch = new URLSearchParams(location.search);
  editSearch.set("mode", "edit");
  editSearch.delete("focus");
  const editAction = `${location.pathname}?${editSearch.toString()}`;
  const quoteCustomer = quote as typeof quote & {
    customerPhone?: string | null;
    customerCountry?: string | null;
    customerRegion?: string | null;
    customerAddress?: string | null;
  };
  const customerLabel =
    quote.customerName || quote.customerEmail || "Guest customer";
  const customerMarket = [
    quoteCustomer.customerCountry,
    quoteCustomer.customerRegion,
  ]
    .filter(Boolean)
    .join(" / ");
  const customerAddress = quoteCustomer.customerAddress || customerMarket;
  const currencyLabel = `${currencyNames[quote.currency] ?? quote.currency} (${
    quote.currency
  })`;
  const filteredItems = useMemo(() => {
    const query = debouncedItemSearch.trim().toLowerCase();
    if (!query) return quote.items;
    return quote.items.filter((item) => {
      return [item.title, item.sku, item.productId, item.variantId]
        .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [debouncedItemSearch, quote.items]);
  const existingProductKeys = useMemo(
    () =>
      new Set(
        quote.items.flatMap((item) =>
          [item.variantId, item.productId].filter(Boolean).map(String),
        ),
      ),
    [quote.items],
  );
  const conversationMessages = useMemo(
    () =>
      [...quote.messages, ...optimisticMessages].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime(),
      ),
    [optimisticMessages, quote.messages],
  );

  const updateChatAttachments = (files: File[]) => {
    setChatAttachments(
      files.map((file) => ({
        file,
        preview: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
      })),
    );
    if (!chatFileInputRef.current) return;

    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    chatFileInputRef.current.files = transfer.files;
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedItemSearch(itemSearch);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [itemSearch]);

  useEffect(() => {
    if (actionData?.ok && actionData.message === "Products added to quote.") {
      setIsProductDropdownOpen(false);
      setItemSearch("");
      setSelectedProducts([]);
    }
  }, [actionData]);

  useEffect(() => {
    if (!actionData) return;

    setIsToastVisible(true);
    const timer = window.setTimeout(() => {
      setIsToastVisible(false);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [actionData]);

  useEffect(() => {
    if (!isProductDropdownOpen) return;
    const closeProductDropdown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (productSearchAreaRef.current?.contains(target)) return;
      setIsProductDropdownOpen(false);
    };

    document.addEventListener("mousedown", closeProductDropdown);
    return () => {
      document.removeEventListener("mousedown", closeProductDropdown);
    };
  }, [isProductDropdownOpen]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || revalidator.state !== "idle") return;
      if (navigation.state !== "idle") return;
      if (chatAttachments.length > 0) return;
      revalidator.revalidate();
    }, 1500);
    const revalidateOnFocus = () => {
      if (revalidator.state !== "idle") return;
      if (navigation.state !== "idle") return;
      if (chatAttachments.length > 0) return;
      revalidator.revalidate();
    };
    window.addEventListener("focus", revalidateOnFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", revalidateOnFocus);
    };
  }, [chatAttachments.length, navigation.state, revalidator]);

  useEffect(() => {
    if (isEditMode) {
      firstQuotePriceInputRef.current?.focus();
    }
  }, [isEditMode]);

  useEffect(() => {
    if (isChatMode) {
      chatPanelRef.current?.scrollIntoView({ block: "nearest" });
      chatInputRef.current?.focus();
    }
  }, [isChatMode]);

  useEffect(() => {
    if (actionData?.ok && actionData.message === "Message sent.") {
      if (chatInputRef.current) chatInputRef.current.value = "";
      if (chatFileInputRef.current) chatFileInputRef.current.value = "";
      setChatMessage("");
      setChatAttachments([]);
      setOptimisticMessages([]);
    } else if (actionData && !actionData.ok) {
      setOptimisticMessages([]);
    }
  }, [actionData]);

  useEffect(() => {
    if (!chatMessagesRef.current) return;
    chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
  }, [quote.messages.length]);

  return (
    <main className={styles.quoteDetailPage}>
      <section
        className={`${styles.quoteDetailShell} ${
          isViewMode ? styles.quoteDetailShellReadonly : ""
        }`}
      >
        <header className={styles.quoteDetailHeader}>
          <div className={styles.quoteDetailTitleRow}>
            <Link className={styles.quoteDetailBackLink} to="/app/quotes">
              <svg
                aria-hidden="true"
                fill="none"
                height="24"
                viewBox="0 0 24 24"
                width="24"
              >
                <path
                  d="M19 12H5m0 0 6-6m-6 6 6 6"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </Link>
            <h1>{pageTitle}</h1>
            <span className={`${styles.quoteDetailBadge} ${styles[tone]}`}>
              {getQuoteStatusLabel(quote.status)}
            </span>
            <a
              className={styles.quoteDetailIconButton}
              href={pdfHref}
              title="Download quote"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="18"
                viewBox="0 0 24 24"
                width="18"
              >
                <path
                  d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </a>
          </div>

          <div className={styles.quoteDetailHeaderActions}>
            {canRevise ? (
              <Form action={editAction} method="post">
                <input name="status" type="hidden" value="NEGOTIATING" />
                <button
                  className={styles.quoteDetailTinyButton}
                  disabled={isSubmitting}
                  name="intent"
                  type="submit"
                  value="status"
                >
                  Revise quote
                </button>
              </Form>
            ) : null}
            {canReopen ? (
              <Form action={editAction} method="post">
                <input name="status" type="hidden" value="NEGOTIATING" />
                <button
                  className={styles.quoteDetailTinyButton}
                  disabled={isSubmitting}
                  name="intent"
                  type="submit"
                  value="status"
                >
                  Reopen
                </button>
              </Form>
            ) : null}
            <button
              className={styles.quoteDetailTinyButton}
              disabled={
                isSubmitting ||
                Boolean(quote.orderId) ||
                !canSendOffer ||
                isViewMode ||
                isLockedStatus
              }
              form="quote-detail-prices"
              name="intent"
              type="submit"
              value="send_offer"
            >
              Send quote
            </button>
            <Form method="post">
              <input name="intent" type="hidden" value="convert_order" />
              <button
                className={styles.quoteDetailTinyButton}
                disabled={isSubmitting || !canConvert}
                type="submit"
              >
                Convert quote
              </button>
            </Form>
          </div>
        </header>

        {actionData && isToastVisible && (
          <div
            className={`${styles.quoteToast} ${
              actionData.ok ? styles.quoteToastSuccess : styles.quoteToastError
            }`}
            role="status"
          >
            {actionData.ok ? actionData.message : actionData.error}
          </div>
        )}

        {quote.orderId && (
          <section className={`${styles.card} ${styles.orderBanner}`}>
            <div>
              <strong>Draft Order {quote.orderName ?? "created"}</strong>
              <p>This quote has been converted into a Shopify Draft Order.</p>
            </div>
            <div className={styles.actionRow}>
              {quote.orderInvoiceUrl && (
                <a
                  className={styles.secondaryButton}
                  href={quote.orderInvoiceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open invoice
                </a>
              )}
              {draftOrderAdminUrl && (
                <a
                  className={styles.primaryButton}
                  href={draftOrderAdminUrl}
                  rel="noreferrer"
                  target="_top"
                >
                  Open Draft Order
                </a>
              )}
            </div>
          </section>
        )}

        <div className={styles.merchantQuoteGrid}>
          <div className={styles.merchantQuoteLeft}>
            <section className={styles.merchantInfoCard}>
              <div>
                <h2>Quote Information</h2>
                <dl>
                  <dt>Quote ID:</dt>
                  <dd>{quote.quoteNumber}</dd>
                  <dt>Draft Order:</dt>
                  <dd>{quote.orderName ?? "-"}</dd>
                  <dt>Order:</dt>
                  <dd>-</dd>
                  <dt>Created date:</dt>
                  <dd>{shortDateTime(quote.createdAt)}</dd>
                </dl>
              </div>

              <div>
                <h2>Customer</h2>
                <p className={styles.merchantInfoTextBlue}>{customerLabel}</p>
                <h3>Contact information</h3>
                <p className={styles.merchantInfoTextBlue}>
                  {quote.customerEmail ?? "No email"}
                </p>
                <p>{quoteCustomer.customerPhone ?? "No phone"}</p>
                <h3>Markets</h3>
                <span className={styles.merchantPill}>
                  {customerMarket || "No market"}
                </span>
                <h3>Address</h3>
                <p>{customerAddress || "No address"}</p>
                <h3>Currency</h3>
                <span className={styles.merchantPill}>{currencyLabel}</span>
              </div>
            </section>

            <section
              className={`${styles.merchantItemsCard} ${
                isEditMode ? styles.merchantPanelActive : ""
              }`}
            >
              <h2>Quote Items</h2>
              <div
                className={styles.merchantProductSearchArea}
                ref={productSearchAreaRef}
              >
                <div className={styles.merchantItemsToolbar}>
                  <input
                    disabled={isViewMode || isLockedStatus}
                    onChange={(event) => {
                      setItemSearch(event.currentTarget.value);
                    }}
                    placeholder="Search products"
                    ref={itemSearchRef}
                    type="search"
                    value={itemSearch}
                  />
                  <button
                    disabled={isViewMode || isLockedStatus || Boolean(quote.orderId)}
                    onClick={() => {
                      setIsProductDropdownOpen(true);
                      itemSearchRef.current?.focus();
                    }}
                    title="Browse products"
                    type="button"
                  >
                    Browse
                  </button>
                </div>
                {isProductDropdownOpen && (
                  <div className={styles.merchantProductDropdown}>
                    {productsQuery.isFetching && !productsQuery.data ? (
                      <p className={styles.merchantProductDropdownStatus}>
                        Searching products...
                      </p>
                    ) : productsQuery.isError ? (
                      <p className={styles.merchantProductDropdownStatus}>
                        Could not load products.
                      </p>
                    ) : (productsQuery.data?.products ?? []).length === 0 ? (
                      <p className={styles.merchantProductDropdownStatus}>
                        No products found.
                      </p>
                    ) : (
                      productsQuery.data?.products.map((product) => {
                        const isAlreadyAdded =
                          existingProductKeys.has(product.variantId) ||
                          existingProductKeys.has(product.productId);
                        const isSelected = selectedProducts.some(
                          (selectedProduct) =>
                            selectedProduct.variantId === product.variantId,
                        );

                        return (
                          <button
                            className={`${styles.merchantProductDropdownItem} ${
                              isSelected
                                ? styles.merchantProductDropdownItemSelected
                                : ""
                            } ${
                              isAlreadyAdded
                                ? styles.merchantProductDropdownItemAdded
                                : ""
                            }`}
                            disabled={isAlreadyAdded}
                            key={product.variantId}
                            onClick={() => {
                              if (isAlreadyAdded) return;
                              setSelectedProducts((currentProducts) =>
                                isSelected
                                  ? currentProducts.filter(
                                      (selectedProduct) =>
                                        selectedProduct.variantId !==
                                        product.variantId,
                                    )
                                  : [...currentProducts, product],
                              );
                            }}
                            type="button"
                          >
                            {product.imageUrl ? (
                              <img alt="" src={product.imageUrl} />
                            ) : (
                              <span>{product.title.slice(0, 1)}</span>
                            )}
                            <strong>{product.title}</strong>
                            <em>{money(product.price, quote.currency)}</em>
                            <b>
                              {isAlreadyAdded ? "✓ Added" : isSelected ? "✓" : "+ Add"}
                            </b>
                          </button>
                        );
                      })
                    )}
                    <div className={styles.merchantProductDropdownFooter}>
                      <button
                        onClick={() => {
                          setSelectedProducts([]);
                          setIsProductDropdownOpen(false);
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                      <Form method="post">
                        <input
                          name="intent"
                          type="hidden"
                          value="add_quote_items"
                        />
                        <input
                          name="selectedProducts"
                          type="hidden"
                          value={JSON.stringify(selectedProducts)}
                        />
                        <button
                          disabled={selectedProducts.length === 0 || isSubmitting}
                          type="submit"
                        >
                          Confirm
                        </button>
                      </Form>
                    </div>
                  </div>
                )}
              </div>

              <Form id="quote-detail-prices" method="post">
                <div className={styles.merchantItemsTableWrap}>
                  <table className={styles.merchantItemsTable}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Price</th>
                        <th>Qty</th>
                        <th>Quote Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={4}>No quote items found.</td>
                        </tr>
                      ) : (
                        filteredItems.map((item, index) => (
                          <tr key={item.id}>
                            <td>
                              <div className={styles.merchantItemProduct}>
                                {item.imageUrl ? (
                                  <img alt="" src={item.imageUrl} />
                                ) : (
                                  <span>{index + 1}</span>
                                )}
                                <div>
                                  <strong>{item.title}</strong>
                                  <small>{item.sku || "Default Title"}</small>
                                </div>
                              </div>
                            </td>
                            <td>{money(item.unitPrice, quote.currency)}</td>
                            <td>
                              <input
                                className={styles.merchantSmallInput}
                                defaultValue={item.quantity}
                                disabled={isPriceReadOnly}
                                min="1"
                                name={`qty:${item.id}`}
                                step="1"
                                type="number"
                              />
                            </td>
                            <td>
                              <input
                                className={styles.merchantSmallInput}
                                defaultValue={moneyInputValue(item.quotePrice)}
                                disabled={isPriceReadOnly}
                                min="0"
                                name={`price:${item.id}`}
                                ref={index === 0 ? firstQuotePriceInputRef : null}
                                step="0.01"
                                type="number"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total</td>
                        <td>{money(quote.originalTotal, quote.currency)}</td>
                        <td />
                        <td>{money(quote.quoteTotal, quote.currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className={styles.merchantItemsActions}>
                  <button
                    className={styles.quoteDetailGhostButton}
                    disabled={
                      isSubmitting ||
                      Boolean(quote.orderId) ||
                      isViewMode ||
                      isLockedStatus
                    }
                    name="intent"
                    type="submit"
                    value="save_prices"
                  >
                    Save prices
                  </button>
                </div>
              </Form>
            </section>
          </div>

          <section className={styles.merchantConversation} ref={chatPanelRef}>
            <h2>Conversation</h2>
            <div className={styles.quoteDetailConversationBanner}>
              Reply here to start negotiation
            </div>
            <div
              className={styles.quoteDetailMessages}
              ref={chatMessagesRef}
            >
              {conversationMessages.length === 0 ? (
                <div className={styles.quoteDetailEmptyMessage}>
                  No messages yet.
                </div>
              ) : (
                <>
                  <div className={styles.quoteDetailDatePill}>Today</div>
                  {conversationMessages.map((message, index) => {
                    const isSystemMessage = isSystemQuoteMessage(
                      message.message,
                    );

                    return (
                    <article
                      className={`${styles.quoteDetailMessage} ${
                        isSystemMessage
                          ? styles.quoteDetailMessageSystem
                          : message.sender === "MANAGER"
                            ? styles.quoteDetailMessageManager
                            : styles.quoteDetailMessageCustomer
                      }`}
                      key={message.id}
                    >
                      {message.attachments.length > 0 && (
                        <div className={styles.quoteDetailMessageAttachments}>
                          {message.attachments.map((file) => {
                            const meta = attachmentMeta(file);

                            return (
                              <a
                                className={styles.quoteDetailMessageAttachment}
                                download={file.fileName}
                                href={file.fileUrl}
                                key={file.id}
                              >
                                <div
                                  className={
                                    styles.quoteDetailMessageAttachmentThumb
                                  }
                                >
                                  {meta.isImage ? (
                                    <img alt={file.fileName} src={file.fileUrl} />
                                  ) : (
                                    <span>{meta.extension}</span>
                                  )}
                                </div>
                                <div>
                                  <strong>{file.fileName}</strong>
                                  <small>
                                    {[meta.extension, meta.fileSize]
                                      .filter(Boolean)
                                      .join(" • ")}
                                  </small>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      )}
                      {message.message ? (
                        <div className={styles.quoteDetailMessageBubble}>
                          {message.message}
                        </div>
                      ) : null}
                      {shouldShowMessageTime(conversationMessages, index) && (
                        <span>
                          {messageTime(
                            message.createdAt,
                            index === conversationMessages.length - 1,
                          )}
                        </span>
                      )}
                    </article>
                    );
                  })}
                </>
              )}
            </div>
            <Form
              className={`${styles.quoteDetailComposer} ${
                hasChatContent ? styles.quoteDetailComposerActive : ""
              }`}
              encType="multipart/form-data"
              method="post"
              onSubmit={(event) => {
                const message = chatMessage.trim();
                if (!message && chatAttachments.length === 0) {
                  event.preventDefault();
                  return;
                }
                const now = new Date();
                const optimisticMessage = {
                  id: `optimistic-${now.getTime()}`,
                  quoteId: quote.id,
                  sender: "MANAGER",
                  senderName: "Manager",
                  message,
                  createdAt: now,
                  attachments: chatAttachments.map((attachment, index) => ({
                    id: `optimistic-file-${now.getTime()}-${index}`,
                    quoteId: quote.id,
                    messageId: `optimistic-${now.getTime()}`,
                    fileName: attachment.file.name,
                    fileUrl: attachment.preview ?? "",
                    mimeType: `${attachment.file.type || "application/octet-stream"};size=${attachment.file.size}`,
                    createdAt: now,
                  })),
                } as ConversationMessage;
                setOptimisticMessages((messages) => [
                  ...messages,
                  optimisticMessage,
                ]);
              }}
            >
              <input name="intent" type="hidden" value="message" />
              <input
                accept=".png,.pdf,.jpg,.jpeg,.doc,.docx"
                hidden
                multiple
                name="attachments"
                onChange={(event) => {
                  updateChatAttachments(
                    Array.from(event.currentTarget.files ?? []),
                  );
                }}
                ref={chatFileInputRef}
                type="file"
              />
              {chatAttachments.length > 0 && (
                <div className={styles.quoteDetailComposerFiles}>
                  {chatAttachments.map((attachment, index) => (
                    <div
                      className={styles.quoteDetailComposerFileTile}
                      key={`${attachment.file.name}-${attachment.file.size}-${index}`}
                      title={attachment.file.name}
                    >
                      {attachment.preview ? (
                        <img
                          alt={attachment.file.name}
                          src={attachment.preview}
                        />
                      ) : (
                        <span>
                          {attachment.file.name
                            .split(".")
                            .pop()
                            ?.toUpperCase() || "FILE"}
                        </span>
                      )}
                      <button
                        aria-label={`Remove ${attachment.file.name}`}
                        onClick={() =>
                          updateChatAttachments(
                            chatAttachments
                              .filter((_, fileIndex) => fileIndex !== index)
                              .map((item) => item.file),
                          )
                        }
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                name="message"
                onChange={(event) => setChatMessage(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }}
                placeholder="Type a message..."
                ref={chatInputRef}
                value={chatMessage}
              />
              <div className={styles.quoteDetailComposerActions}>
                <button
                  aria-label="Attach file"
                  onClick={() => chatFileInputRef.current?.click()}
                  title="Attach file"
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="m21.4 11.6-8.8 8.8a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.8-8.8" />
                  </svg>
                  📎
                </button>
                <button disabled={isSubmitting} type="submit" title="Send">
                  ↑
                </button>
              </div>
            </Form>
          </section>
        </div>
      </section>
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message =
    error instanceof Error
      ? error.message
      : error instanceof Response
        ? `${error.status} ${error.statusText}`
        : "Unknown quote detail error.";

  return (
    <main className={styles.quoteDetailPage}>
      <section className={styles.quoteDetailShell}>
        <h1>Quote detail error</h1>
        <div className={`${styles.notice} ${styles.noticeError}`}>{message}</div>
        <Link className={styles.secondaryButton} to="/app/quotes">
          Back to quotes
        </Link>
      </section>
    </main>
  );
}
