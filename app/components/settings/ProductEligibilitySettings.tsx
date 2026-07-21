import type { QuoteSettings } from "~/features/settings/quote-settings.server";
import { useProductEligibility } from "~/features/settings/useProductEligibility";
import pageStyles from "~/styles/settings.module.css";

const styles = pageStyles;

export function ProductEligibilitySettings({ settings, hidden }: { settings: QuoteSettings; hidden: boolean }) {
  const product = useProductEligibility(settings);
  const activeSettingsTab = hidden ? "requesters" : "products";
  const productEligibility = product.eligibility;
  const setProductEligibility = product.setEligibility;
  const allowedProductResources = product.allowed;
  const excludedProductResources = product.excluded;
  const activeProductResources = product.selected;
  const resourceSearch = product.search;
  const setResourceSearch = product.setSearch;
  const resourcePickerType = product.type;
  const setResourcePickerType = product.setType;
  const isResourcePickerOpen = product.open;
  const setIsResourcePickerOpen = product.setOpen;
  const resourcePickerRef = product.pickerRef;
  const resourceResults = product.results;
  const isResourceLoading = product.loading;
  const toggleResource = product.toggle;
  const isResourceSelected = product.isSelected;

  return (

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
  );
}
