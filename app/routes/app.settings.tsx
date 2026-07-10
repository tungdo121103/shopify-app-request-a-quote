import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useEffect, useRef, useState } from "react";
import {
  Form,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
} from "react-router";
import {
  getQuoteSettings,
  normalizeSettingsForm,
  updateQuoteSettings,
} from "~/models/quote-setting.server";
import { authenticate } from "~/shopify.server";
import styles from "~/styles/quotes.module.css";

type CustomerOption = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

type ResourceOption = {
  id: string;
  type: "PRODUCT" | "COLLECTION";
  title: string;
  imageUrl: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource");

  if (resource === "customers") {
    const search = url.searchParams.get("q")?.trim() ?? "";
    try {
      const response = await admin.graphql(
        `#graphql
          query SearchQuoteSettingCustomers($query: String!) {
            customers(first: 10, query: $query) {
              nodes {
                id
                displayName
                defaultEmailAddress {
                  emailAddress
                }
                defaultPhoneNumber {
                  phoneNumber
                }
              }
            }
          }`,
        { variables: { query: search } },
      );
      const result = await response.json();
      const customers = (result.data?.customers?.nodes ?? []).map(
        (customer: {
          id?: string;
          displayName?: string;
          defaultEmailAddress?: { emailAddress?: string | null } | null;
          defaultPhoneNumber?: { phoneNumber?: string | null } | null;
        }) => ({
          id: String(customer.id ?? ""),
          name: String(customer.displayName ?? "Customer"),
          email: String(customer.defaultEmailAddress?.emailAddress ?? ""),
          phone: String(customer.defaultPhoneNumber?.phoneNumber ?? ""),
        }),
      );

      return { customers };
    } catch (error) {
      console.warn("Unable to search customers for quote settings", error);
      return {
        customers: [],
        customerSearchError:
          "Customer search requires Shopify protected customer data access.",
      };
    }
  }

  if (resource === "eligibility-products") {
    const search = url.searchParams.get("q")?.trim() ?? "";
    const response = await admin.graphql(
      `#graphql
        query SearchQuoteSettingProducts($query: String!) {
          products(first: 10, query: $query, sortKey: TITLE) {
            nodes {
              id
              title
              featuredImage {
                url
              }
            }
          }
        }`,
      {
        variables: {
          query: search ? `${search} status:active` : "status:active",
        },
      },
    );
    const result = await response.json();
    const resources = (result.data?.products?.nodes ?? []).map(
      (product: { id?: string; title?: string; featuredImage?: { url?: string } }) => ({
        id: String(product.id ?? ""),
        type: "PRODUCT" as const,
        title: String(product.title ?? "Product"),
        imageUrl: String(product.featuredImage?.url ?? ""),
      }),
    );

    return { resources };
  }

  if (resource === "eligibility-collections") {
    const search = url.searchParams.get("q")?.trim() ?? "";
    const response = await admin.graphql(
      `#graphql
        query SearchQuoteSettingCollections($query: String!) {
          collections(first: 10, query: $query, sortKey: TITLE) {
            nodes {
              id
              title
              image {
                url
              }
            }
          }
        }`,
      {
        variables: {
          query: search,
        },
      },
    );
    const result = await response.json();
    const resources = (result.data?.collections?.nodes ?? []).map(
      (collection: { id?: string; title?: string; image?: { url?: string } }) => ({
        id: String(collection.id ?? ""),
        type: "COLLECTION" as const,
        title: String(collection.title ?? "Collection"),
        imageUrl: String(collection.image?.url ?? ""),
      }),
    );

    return { resources };
  }

  const settings = await getQuoteSettings(session.shop);
  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const input = normalizeSettingsForm(formData);

  await updateQuoteSettings(session.shop, input);

  return { ok: true, message: "Quote settings saved." };
};

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>() as {
    settings: Awaited<ReturnType<typeof getQuoteSettings>>;
  };
  const actionData = useActionData<typeof action>();
  const customerFetcher = useFetcher<{
    customers: CustomerOption[];
    customerSearchError?: string;
  }>();
  const productResourceFetcher = useFetcher<{ resources: ResourceOption[] }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    "requesters" | "products"
  >("requesters");
  const [requesterScope, setRequesterScope] = useState(
    settings.requesterScope === "ALL" ? "ALL" : "SELECTED",
  );
  const [segmentSettings, setSegmentSettings] = useState({
    allowCustomersNoPurchase: settings.allowCustomersNoPurchase,
    allowRepeatCustomers: settings.allowRepeatCustomers,
    allowAbandonedCheckout: settings.allowAbandonedCheckout,
    allowEmailSubscribers: settings.allowEmailSubscribers,
    allowPurchasedCustomers: settings.allowPurchasedCustomers,
  });
  const [selectedCustomers, setSelectedCustomers] = useState<CustomerOption[]>(
    parseSelectedCustomers(settings.selectedCustomerQuery),
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [productEligibility, setProductEligibility] = useState(
    settings.productEligibility,
  );
  const [allowedProductResources, setAllowedProductResources] = useState<
    ResourceOption[]
  >(
    parseSelectedProductResources(
      settings.allowedProductResources || settings.selectedProductResources,
    ),
  );
  const [excludedProductResources, setExcludedProductResources] = useState<
    ResourceOption[]
  >(parseSelectedProductResources(settings.excludedProductResources));
  const [resourceSearch, setResourceSearch] = useState("");
  const [resourcePickerType, setResourcePickerType] = useState<
    "PRODUCT" | "COLLECTION"
  >("PRODUCT");
  const [isResourcePickerOpen, setIsResourcePickerOpen] = useState(false);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const customerPickerRef = useRef<HTMLDivElement | null>(null);
  const resourcePickerRef = useRef<HTMLDivElement | null>(null);
  const lastCustomerSearchRequestRef = useRef<string | null>(null);
  const lastResourceSearchRequestRef = useRef<string | null>(null);
  const customerResults = customerFetcher.data?.customers ?? [];
  const resourceResults = productResourceFetcher.data?.resources ?? [];
  const isCustomerLoading =
    customerFetcher.state === "loading" || customerFetcher.state === "submitting";
  const isResourceLoading =
    productResourceFetcher.state === "loading" ||
    productResourceFetcher.state === "submitting";

  useEffect(() => {
    if (!isCustomerPickerOpen) return;

    const timeout = window.setTimeout(() => {
      if (lastCustomerSearchRequestRef.current === customerSearch) return;
      lastCustomerSearchRequestRef.current = customerSearch;
      customerFetcher.load(
        `?resource=customers&q=${encodeURIComponent(customerSearch)}`,
      );
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [customerSearch, isCustomerPickerOpen]);

  useEffect(() => {
    if (!isResourcePickerOpen) return;

    const requestKey = `${resourcePickerType}:${resourceSearch}`;
    const timeout = window.setTimeout(() => {
      if (lastResourceSearchRequestRef.current === requestKey) return;
      lastResourceSearchRequestRef.current = requestKey;
      productResourceFetcher.load(
        `?resource=${
          resourcePickerType === "PRODUCT"
            ? "eligibility-products"
            : "eligibility-collections"
        }&q=${encodeURIComponent(resourceSearch)}`,
      );
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [resourcePickerType, resourceSearch, isResourcePickerOpen]);

  useEffect(() => {
    if (!isCustomerPickerOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        customerPickerRef.current &&
        !customerPickerRef.current.contains(event.target as Node)
      ) {
        setIsCustomerPickerOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isCustomerPickerOpen]);

  useEffect(() => {
    if (!isResourcePickerOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        resourcePickerRef.current &&
        !resourcePickerRef.current.contains(event.target as Node)
      ) {
        setIsResourcePickerOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isResourcePickerOpen]);

  useEffect(() => {
    if (!actionData) return;

    setIsToastVisible(true);
    const timeout = window.setTimeout(() => setIsToastVisible(false), 3200);

    return () => window.clearTimeout(timeout);
  }, [actionData]);

  const isCustomerSelected = (customerId: string) =>
    selectedCustomers.some((customer) => customer.id === customerId);

  const toggleCustomer = (customer: CustomerOption) => {
    setSelectedCustomers((current) =>
      current.some((selected) => selected.id === customer.id)
        ? current.filter((selected) => selected.id !== customer.id)
        : [...current, customer],
    );
  };
  const activeProductResources =
    productEligibility === "EXCLUDED"
      ? excludedProductResources
      : allowedProductResources;
  const setActiveProductResources =
    productEligibility === "EXCLUDED"
      ? setExcludedProductResources
      : setAllowedProductResources;
  const isResourceSelected = (resourceId: string) =>
    activeProductResources.some((resource) => resource.id === resourceId);
  const toggleResource = (resource: ResourceOption) => {
    setActiveProductResources((current) =>
      current.some((selected) => selected.id === resource.id)
        ? current.filter((selected) => selected.id !== resource.id)
        : [...current, resource],
    );
  };
  const isAllCustomers = requesterScope === "ALL";

  return (
    <main className={styles.adminPage}>
      <header className={styles.adminHeader}>
        <div>
          <p className={styles.kicker}>Request a Quote</p>
          <h1 className={styles.adminTitle}>Quote settings</h1>
        </div>
      </header>

      {actionData && isToastVisible && (
        <div
          className={`${styles.quoteToast} ${
            actionData.ok ? styles.quoteToastSuccess : styles.quoteToastError
          }`}
          role="status"
        >
          {actionData.ok ? actionData.message : "Could not save settings."}
        </div>
      )}

      <Form method="post">
        <section className={`${styles.settingsPanel} ${styles.settingsAccessPanel}`}>
          <div className={styles.settingsTabSwitch} role="tablist">
            <button
              aria-selected={activeSettingsTab === "requesters"}
              className={
                activeSettingsTab === "requesters"
                  ? styles.settingsTabButtonActive
                  : styles.settingsTabButton
              }
              onClick={() => setActiveSettingsTab("requesters")}
              role="tab"
              type="button"
            >
              Who can request quotes?
            </button>
            <button
              aria-selected={activeSettingsTab === "products"}
              className={
                activeSettingsTab === "products"
                  ? styles.settingsTabButtonActive
                  : styles.settingsTabButton
              }
              onClick={() => setActiveSettingsTab("products")}
              role="tab"
              type="button"
            >
              Product Eligibility
            </button>
          </div>

          <div
            className={`${styles.settingsTabPanel} ${
              activeSettingsTab === "requesters" ? "" : styles.settingsTabPanelHidden
            }`}
            role="tabpanel"
          >
            <div className={styles.settingsBody}>
              <label className={styles.radioRow}>
                <input
                  checked={requesterScope === "ALL"}
                  name="requesterScope"
                  onChange={() => setRequesterScope("ALL")}
                  type="radio"
                  value="ALL"
                />
                <span>All customers</span>
              </label>

              <label className={styles.radioRow}>
                <input
                  checked={requesterScope !== "ALL"}
                  name="requesterScope"
                  onChange={() => setRequesterScope("SELECTED")}
                  type="radio"
                  value="SELECTED"
                />
                <span>Selected customers</span>
              </label>

              <div className={styles.settingsSelectedOptions}>
                <div className={styles.settingsSubsection}>
                  <h3>Customer segments</h3>
                  <label className={styles.checkboxRow}>
                    <input
                      checked={
                        !isAllCustomers &&
                        segmentSettings.allowCustomersNoPurchase
                      }
                      disabled={isAllCustomers}
                      name="allowCustomersNoPurchase"
                      onChange={(event) =>
                        setSegmentSettings((current) => ({
                          ...current,
                          allowCustomersNoPurchase: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span>Customers who haven&apos;t purchased</span>
                  </label>
                  <label className={styles.checkboxRow}>
                    <input
                      checked={
                        !isAllCustomers && segmentSettings.allowRepeatCustomers
                      }
                      disabled={isAllCustomers}
                      name="allowRepeatCustomers"
                      onChange={(event) =>
                        setSegmentSettings((current) => ({
                          ...current,
                          allowRepeatCustomers: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span>Customers who have purchased more than once</span>
                  </label>
                  <label className={styles.checkboxRow}>
                    <input
                      checked={
                        !isAllCustomers &&
                        segmentSettings.allowAbandonedCheckout
                      }
                      disabled={isAllCustomers}
                      name="allowAbandonedCheckout"
                      onChange={(event) =>
                        setSegmentSettings((current) => ({
                          ...current,
                          allowAbandonedCheckout: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span>Abandoned checkouts in the last 30 days</span>
                  </label>
                  <label className={styles.checkboxRow}>
                    <input
                      checked={
                        !isAllCustomers && segmentSettings.allowEmailSubscribers
                      }
                      disabled={isAllCustomers}
                      name="allowEmailSubscribers"
                      onChange={(event) =>
                        setSegmentSettings((current) => ({
                          ...current,
                          allowEmailSubscribers: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span>Email subscribers</span>
                  </label>
                  <label className={styles.checkboxRow}>
                    <input
                      checked={
                        !isAllCustomers &&
                        segmentSettings.allowPurchasedCustomers
                      }
                      disabled={isAllCustomers}
                      name="allowPurchasedCustomers"
                      onChange={(event) =>
                        setSegmentSettings((current) => ({
                          ...current,
                          allowPurchasedCustomers: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span>Customers who have purchased at least once</span>
                  </label>
                </div>

                <div className={styles.settingsFieldGroup}>
                  <label htmlFor="customerSearch">
                    Select individual customers
                  </label>
                  <input
                    name="selectedCustomerQuery"
                    readOnly
                    type="hidden"
                    value={JSON.stringify(selectedCustomers)}
                  />
                  {selectedCustomers.length > 0 && (
                    <div className={styles.settingsCustomerChips}>
                      {selectedCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => toggleCustomer(customer)}
                          type="button"
                        >
                          {customer.name}
                          {customer.email ? ` · ${customer.email}` : ""}
                          <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div ref={customerPickerRef}>
                    <div className={styles.settingsSearchRow}>
                      <input
                        id="customerSearch"
                        onChange={(event) =>
                          setCustomerSearch(event.target.value)
                        }
                        onFocus={() => setIsCustomerPickerOpen(true)}
                        placeholder="Search customers..."
                        value={customerSearch}
                      />
                      <button
                        onClick={() => setIsCustomerPickerOpen((open) => !open)}
                        type="button"
                      >
                        Browse
                      </button>
                    </div>
                    {isCustomerPickerOpen && (
                      <div className={styles.settingsCustomerPicker}>
                        {isCustomerLoading && (
                          <div className={styles.settingsCustomerEmpty}>
                            Searching customers...
                          </div>
                        )}
                        {!isCustomerLoading && customerResults.length === 0 && (
                          <div className={styles.settingsCustomerEmpty}>
                            {customerFetcher.data?.customerSearchError ??
                              "No customers found"}
                          </div>
                        )}
                        {!isCustomerLoading &&
                          customerResults.map((customer) => (
                            <button
                              key={customer.id}
                              className={styles.settingsCustomerOption}
                              onClick={() => toggleCustomer(customer)}
                              type="button"
                            >
                              <span>
                                <strong>{customer.name}</strong>
                                <small>
                                  {customer.email ||
                                    customer.phone ||
                                    "No contact"}
                                </small>
                              </span>
                              <em>
                                {isCustomerSelected(customer.id) ? "✓" : "+ Add"}
                              </em>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.settingsFieldGroup}>
                  <label htmlFor="emailPatterns">Email patterns</label>
                  <textarea
                    defaultValue={settings.emailPatterns ?? ""}
                    id="emailPatterns"
                    name="emailPatterns"
                    placeholder="@company.com, *@wholesale.com"
                    rows={3}
                  />
                  <p>Use * as wildcard</p>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`${styles.settingsTabPanel} ${
              activeSettingsTab === "products" ? "" : styles.settingsTabPanelHidden
            }`}
            role="tabpanel"
          >
            <div className={styles.settingsBody}>
              <label className={styles.radioRow}>
                <input
                  checked={productEligibility === "ALL"}
                  name="productEligibility"
                  onChange={() => setProductEligibility("ALL")}
                  type="radio"
                  value="ALL"
                />
                <span>All products</span>
              </label>
              <label className={styles.radioRow}>
                <input
                  checked={productEligibility === "SELECTED"}
                  name="productEligibility"
                  onChange={() => setProductEligibility("SELECTED")}
                  type="radio"
                  value="SELECTED"
                />
                <span>Selected products or collections</span>
              </label>
              <label className={styles.radioRow}>
                <input
                  checked={productEligibility === "EXCLUDED"}
                  name="productEligibility"
                  onChange={() => setProductEligibility("EXCLUDED")}
                  type="radio"
                  value="EXCLUDED"
                />
                <span>Exclude selected products</span>
              </label>

              <input
                name="selectedProductResources"
                readOnly
                type="hidden"
                value={JSON.stringify(allowedProductResources)}
              />
              <input
                name="allowedProductResources"
                readOnly
                type="hidden"
                value={JSON.stringify(allowedProductResources)}
              />
              <input
                name="excludedProductResources"
                readOnly
                type="hidden"
                value={JSON.stringify(excludedProductResources)}
              />

              {productEligibility === "ALL" ? (
                <div className={styles.settingsInfoBox}>
                  All active products can be added to quote requests.
                </div>
              ) : (
                <div className={styles.settingsFieldGroup}>
                  <label htmlFor="resourceSearch">
                    {productEligibility === "SELECTED"
                      ? "Products and collections allowed for quotes"
                      : "Products and collections excluded from quotes"}
                  </label>

                  {false && activeProductResources.length > 0 && (
                    <div className={styles.settingsCustomerChips}>
                      {activeProductResources.map((resource) => (
                        <button
                          key={resource.id}
                          onClick={() => toggleResource(resource)}
                          type="button"
                        >
                          {resource.type === "COLLECTION" ? "Collection: " : ""}
                          {resource.title}
                          <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div ref={resourcePickerRef}>
                    <div className={styles.settingsResourceHeader}>
                      <select
                        aria-label="Resource type"
                        className={styles.settingsResourceTypeSelect}
                        onChange={(event) =>
                          setResourcePickerType(
                            event.target.value === "COLLECTION"
                              ? "COLLECTION"
                              : "PRODUCT",
                          )
                        }
                        value={resourcePickerType}
                      >
                        <option value="PRODUCT">Products</option>
                        <option value="COLLECTION">Collections</option>
                      </select>
                    </div>

                    {activeProductResources.length > 0 && (
                      <div className={styles.settingsCustomerChips}>
                        {activeProductResources.map((resource) => (
                          <button
                            key={`${resource.id}-below-type`}
                            onClick={() => toggleResource(resource)}
                            type="button"
                          >
                            {resource.type === "COLLECTION" ? "Collection: " : ""}
                            {resource.title}
                            <span aria-hidden="true">×</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className={styles.settingsSearchRow}>
                      <input
                        id="resourceSearch"
                        onChange={(event) => setResourceSearch(event.target.value)}
                        onFocus={() => setIsResourcePickerOpen(true)}
                        placeholder={
                          resourcePickerType === "PRODUCT"
                            ? "Search products..."
                            : "Search collections..."
                        }
                        value={resourceSearch}
                      />
                      <button
                        onClick={() => setIsResourcePickerOpen((open) => !open)}
                        type="button"
                      >
                        Browse
                      </button>
                    </div>
                    {isResourcePickerOpen && (
                      <div className={styles.settingsCustomerPicker}>
                        {isResourceLoading && (
                          <div className={styles.settingsCustomerEmpty}>
                            Searching{" "}
                            {resourcePickerType === "PRODUCT"
                              ? "products"
                              : "collections"}
                            ...
                          </div>
                        )}
                        {!isResourceLoading && resourceResults.length === 0 && (
                          <div className={styles.settingsCustomerEmpty}>
                            No{" "}
                            {resourcePickerType === "PRODUCT"
                              ? "products"
                              : "collections"}{" "}
                            found
                          </div>
                        )}
                        {!isResourceLoading &&
                          resourceResults.map((resource) => (
                            <button
                              key={resource.id}
                              className={styles.settingsCustomerOption}
                              onClick={() => toggleResource(resource)}
                              type="button"
                            >
                              <span className={styles.settingsResourceOptionMain}>
                                <span className={styles.settingsResourceThumb}>
                                  {resource.imageUrl ? (
                                    <img alt="" src={resource.imageUrl} />
                                  ) : (
                                    resource.type === "PRODUCT" ? "P" : "C"
                                  )}
                                </span>
                                <span>
                                  <strong>{resource.title}</strong>
                                  <small>
                                    {resource.type === "PRODUCT"
                                      ? "Product"
                                      : "Collection"}
                                  </small>
                                </span>
                              </span>
                              <em>
                                {isResourceSelected(resource.id) ? "✓" : "+ Add"}
                              </em>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className={`${styles.settingsPanel} ${styles.expirationPanel}`}>
          <h2>Quote Expiration</h2>
          <div className={styles.expirationField}>
            <label htmlFor="quoteExpiresAfterDays">Quote expire after</label>
            <div className={styles.suffixInput}>
              <input
                defaultValue={settings.quoteExpiresAfterDays}
                id="quoteExpiresAfterDays"
                min={0}
                name="quoteExpiresAfterDays"
                type="number"
              />
              <span>day(s)</span>
            </div>
            <p>
              Quotes will automatically expire if the customer does not respond
              (Accept/ Decline) within the specified number of days, counted
              from the last time the quote was sent. A reminder email will be
              sent before the expiration date if configured.
            </p>
          </div>

          <div className={styles.expirationField}>
            <label htmlFor="reminderBeforeExpireDays">
              Quote reminders send before
            </label>
            <div className={styles.suffixInput}>
              <input
                defaultValue={settings.reminderBeforeExpireDays}
                id="reminderBeforeExpireDays"
                min={0}
                name="reminderBeforeExpireDays"
                type="number"
              />
              <span>day(s) before expiration</span>
            </div>
            <p>
              Example: If the quote is sent on Oct 1, with expiry set to 7 days
              and reminder set to 3 days, the quote will expire on Oct 8 and a
              reminder email will be sent on Oct 5
            </p>
          </div>
        </section>

        <div className={styles.settingsActions}>
          <button
            className={styles.primaryButton}
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Saving..." : "Save settings"}
          </button>
        </div>
      </Form>
    </main>
  );
}

function parseSelectedCustomers(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((customer): CustomerOption | null => {
        if (!customer || typeof customer !== "object") return null;
        const record = customer as Record<string, unknown>;
        const id = String(record.id ?? "");
        if (!id) return null;

        return {
          id,
          name: String(record.name ?? "Customer"),
          email: String(record.email ?? ""),
          phone: String(record.phone ?? ""),
        };
      })
      .filter((customer): customer is CustomerOption => Boolean(customer));
  } catch {
    return [];
  }
}

function parseSelectedProductResources(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((resource): ResourceOption | null => {
        if (!resource || typeof resource !== "object") return null;
        const record = resource as Record<string, unknown>;
        const id = String(record.id ?? "");
        const type = String(record.type ?? "").toUpperCase();
        if (!id || (type !== "PRODUCT" && type !== "COLLECTION")) return null;

        return {
          id,
          type,
          title: String(record.title ?? "Resource"),
          imageUrl: String(record.imageUrl ?? ""),
        } as ResourceOption;
      })
      .filter((resource): resource is ResourceOption => Boolean(resource));
  } catch {
    return [];
  }
}
