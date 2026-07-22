export type QuoteSettingsInput = {
  requesterScope: string;
  allowCustomersNoPurchase: boolean;
  allowRepeatCustomers: boolean;
  allowAbandonedCheckout: boolean;
  allowEmailSubscribers: boolean;
  allowPurchasedCustomers: boolean;
  selectedCustomerQuery: string;
  emailPatterns: string;
  productEligibility: string;
  selectedProductResources: string;
  allowedProductResources: string;
  excludedProductResources: string;
  quoteExpiresAfterDays: number;
  reminderBeforeExpireDays: number;
};

import type { WidgetSettings } from "~/features/widget/widget-settings";

export type WidgetSettingsInput = WidgetSettings;

export type QuoteSettings = QuoteSettingsInput & WidgetSettingsInput & {
  id: string;
  shop: string;
  createdAt: string;
  updatedAt: string;
};
