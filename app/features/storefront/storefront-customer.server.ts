import { phoneDigits } from "~/lib/contact-validation";
import { normalizeShopifyId } from "~/features/storefront/storefront-customer-access.server";
import type { AdminGraphqlClient } from "~/features/storefront/storefront.types";
import {
  matchesEmailPatterns,
  parseSelectedCustomers,
} from "~/features/settings/quote-eligibility";
import { getQuoteSettings } from "~/models/quote-setting.server";

type StorefrontCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

export function contactMatchType(
  customer: StorefrontCustomer | null,
  email: string,
  phone: string,
) {
  if (!customer) return null;
  if (phone && customer.phone && phoneDigits(customer.phone) === phoneDigits(phone)) {
    return "phone";
  }
  if (email && customer.email && customer.email.toLowerCase() === email.toLowerCase()) {
    return "email";
  }
  return null;
}

export async function validateRequesterEligibility(input: {
  admin?: AdminGraphqlClient | null;
  shop: string;
  customerId: string;
  customerEmail: string;
  customerPhone: string;
}) {
  const settings = await getQuoteSettings(input.shop);
  if (settings.requesterScope === "ALL") return { allowed: true };

  const selectedCustomers = parseSelectedCustomers(settings.selectedCustomerQuery);
  const email = input.customerEmail.trim().toLowerCase();
  const phone = input.customerPhone.trim();
  const customerId = normalizeShopifyId(input.customerId);
  const selected = selectedCustomers.some((customer) =>
    normalizeShopifyId(customer.id) === customerId ||
    Boolean(email && customer.email?.toLowerCase() === email) ||
    Boolean(phone && customer.phone && phoneDigits(customer.phone) === phoneDigits(phone)),
  );
  if (selected || matchesEmailPatterns(email, settings.emailPatterns)) {
    return { allowed: true };
  }
  if (!input.admin) {
    return { allowed: false, reason: "This customer is not eligible to request a quote." };
  }

  const profile = await loadCustomerSegmentProfile(input.admin, {
    customerId: input.customerId,
    email,
    phone,
  });
  if (!profile) {
    return {
      allowed: Boolean(email) && Boolean(settings.allowCustomersNoPurchase),
      reason: "This customer is not eligible to request a quote.",
    };
  }
  if (settings.allowCustomersNoPurchase && profile.ordersCount === 0) return { allowed: true };
  if (settings.allowRepeatCustomers && profile.ordersCount > 1) return { allowed: true };
  if (settings.allowPurchasedCustomers && profile.ordersCount >= 1) return { allowed: true };
  if (settings.allowEmailSubscribers && profile.acceptsEmailMarketing) return { allowed: true };
  if (
    settings.allowAbandonedCheckout &&
    (await hasRecentAbandonedCheckout(input.admin, profile.email || email))
  ) return { allowed: true };

  return { allowed: false, reason: "This customer is not eligible to request a quote." };
}

export async function findCustomerByContact(
  admin: AdminGraphqlClient,
  email: string,
  phone: string,
): Promise<StorefrontCustomer | null> {
  const filters = [
    email ? `email:"${customerSearchValue(email)}"` : "",
    phone ? `phone:"${customerSearchValue(phone)}"` : "",
  ].filter(Boolean);
  if (!filters.length) return null;

  const response = await admin.graphql(
    `#graphql
      query FindQuoteCustomer($query: String!) {
        customers(first: 5, query: $query) {
          nodes {
            id
            displayName
            defaultEmailAddress { emailAddress }
            defaultPhoneNumber { phoneNumber }
          }
        }
      }`,
    { variables: { query: filters.join(" OR ") } },
  );
  const result = await response.json();
  const customers = result.data?.customers?.nodes ?? [];
  const customer =
    customers.find((node: { defaultPhoneNumber?: { phoneNumber?: string | null } | null }) =>
      phone && node.defaultPhoneNumber?.phoneNumber &&
      phoneDigits(node.defaultPhoneNumber.phoneNumber) === phoneDigits(phone),
    ) ||
    customers.find((node: { defaultEmailAddress?: { emailAddress?: string | null } | null }) =>
      email && node.defaultEmailAddress?.emailAddress?.toLowerCase() === email.toLowerCase(),
    ) || customers[0];
  return customer ? mapCustomer(customer) : null;
}

async function loadCustomerSegmentProfile(
  admin: AdminGraphqlClient,
  contact: { customerId: string; email: string; phone: string },
) {
  const gid = contact.customerId
    ? `gid://shopify/Customer/${normalizeShopifyId(contact.customerId)}`
    : "";
  const customer = gid
    ? await loadCustomerById(admin, gid)
    : await findCustomerByContact(admin, contact.email, contact.phone);
  if (!customer?.id) return null;

  const response = await admin.graphql(
    `#graphql
      query QuoteRequesterCustomerProfile($id: ID!) {
        customer(id: $id) {
          id
          defaultEmailAddress { emailAddress }
          defaultPhoneNumber { phoneNumber }
          numberOfOrders
          emailMarketingConsent { marketingState }
        }
      }`,
    { variables: { id: customer.id } },
  );
  const node = (await response.json()).data?.customer;
  if (!node) return null;
  return {
    id: String(node.id ?? ""),
    email: String(node.defaultEmailAddress?.emailAddress ?? customer.email),
    phone: String(node.defaultPhoneNumber?.phoneNumber ?? customer.phone),
    ordersCount: Number(node.numberOfOrders ?? 0),
    acceptsEmailMarketing:
      String(node.emailMarketingConsent?.marketingState ?? "").toUpperCase() === "SUBSCRIBED",
  };
}

async function loadCustomerById(admin: AdminGraphqlClient, id: string) {
  const response = await admin.graphql(
    `#graphql
      query FindQuoteCustomerById($id: ID!) {
        customer(id: $id) {
          id
          displayName
          defaultEmailAddress { emailAddress }
          defaultPhoneNumber { phoneNumber }
        }
      }`,
    { variables: { id } },
  );
  const customer = (await response.json()).data?.customer;
  return customer ? mapCustomer(customer) : null;
}

async function hasRecentAbandonedCheckout(admin: AdminGraphqlClient, email: string) {
  if (!email) return false;
  const since = new Date();
  since.setDate(since.getDate() - 30);
  try {
    const response = await admin.graphql(
      `#graphql
        query RecentAbandonedCheckouts($query: String!) {
          abandonedCheckouts(first: 1, query: $query) { nodes { id } }
        }`,
      { variables: { query: `email:"${customerSearchValue(email)}" created_at:>=${since.toISOString().slice(0, 10)}` } },
    );
    const result = await response.json();
    if (result.errors) {
      console.warn("[SP RFQ] Could not evaluate abandoned checkout segment.", { errors: result.errors });
      return false;
    }
    return Boolean(result.data?.abandonedCheckouts?.nodes?.length);
  } catch (error) {
    console.warn("[SP RFQ] Could not evaluate abandoned checkout segment.", error);
    return false;
  }
}

function customerSearchValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function mapCustomer(customer: Record<string, unknown>): StorefrontCustomer {
  const email = customer.defaultEmailAddress as { emailAddress?: string } | undefined;
  const phone = customer.defaultPhoneNumber as { phoneNumber?: string } | undefined;
  return {
    id: String(customer.id ?? ""),
    name: String(customer.displayName ?? ""),
    email: String(email?.emailAddress ?? ""),
    phone: String(phone?.phoneNumber ?? ""),
  };
}
