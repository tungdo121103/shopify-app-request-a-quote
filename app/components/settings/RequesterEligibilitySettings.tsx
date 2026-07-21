import type { QuoteSettings } from "~/features/settings/quote-settings.server";
import { useCustomerEligibility } from "~/features/settings/useCustomerEligibility";
import pageStyles from "~/styles/settings.module.css";

const styles = pageStyles;

export function RequesterEligibilitySettings({ settings, hidden }: { settings: QuoteSettings; hidden: boolean }) {
  const customer = useCustomerEligibility(settings);
  const activeSettingsTab = hidden ? "products" : "requesters";
  const customerFetcher = customer.fetcher;
  const requesterScope = customer.scope;
  const setRequesterScope = customer.setScope;
  const segmentSettings = customer.segments;
  const setSegmentSettings = customer.setSegments;
  const selectedCustomers = customer.selected;
  const customerSearch = customer.search;
  const setCustomerSearch = customer.setSearch;
  const isCustomerPickerOpen = customer.open;
  const setIsCustomerPickerOpen = customer.setOpen;
  const customerPickerRef = customer.pickerRef;
  const customerResults = customer.results;
  const isCustomerLoading = customer.loading;
  const toggleCustomer = customer.toggle;
  const isCustomerSelected = customer.isSelected;
  const isAllCustomers = requesterScope === "ALL";

  return (

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
  );
}
