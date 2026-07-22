import { useEffect, useRef, useState } from "react";
import { Form } from "react-router";
import { QueryClient, useQuery } from "@tanstack/react-query";
import {
  fetchAdminProducts,
  formatQuoteMoney,
} from "~/features/quotes/quote-detail";
import type {
  AdminProductSearchData,
  AdminProductSearchItem,
} from "~/features/quotes/quote-product.types";
import styles from "~/styles/quote-detail.module.css";

type QuoteProductPickerProps = {
  actionCompleted: boolean;
  actionResult: unknown;
  currency: string;
  currentSearch: string;
  disabled: boolean;
  existingProductKeys: Set<string>;
  isSubmitting: boolean;
  onSearchChange: (value: string) => void;
  pathname: string;
  searchQuery: string;
  value: string;
};

export function QuoteProductPicker({
  actionCompleted,
  actionResult,
  currency,
  currentSearch,
  disabled,
  existingProductKeys,
  isSubmitting,
  onSearchChange,
  pathname,
  searchQuery,
  value,
}: QuoteProductPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<AdminProductSearchItem[]>([]);
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
  const inputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const productsQuery = useQuery<AdminProductSearchData>(
    {
      enabled: isOpen,
      queryKey: ["admin-quote-products", pathname, currentSearch, searchQuery],
      queryFn: () => fetchAdminProducts(pathname, currentSearch, searchQuery),
      placeholderData: (previousData) => previousData,
    },
    queryClient,
  );

  useEffect(() => {
    if (!actionCompleted) return;
    setIsOpen(false);
    setSelectedProducts([]);
    onSearchChange("");
  }, [actionCompleted, actionResult, onSearchChange]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !areaRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  return (
    <div className={styles.merchantProductSearchArea} ref={areaRef}>
      <div className={styles.merchantItemsToolbar}>
        <input
          disabled={disabled}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder="Search products"
          ref={inputRef}
          type="search"
          value={value}
        />
        <button
          disabled={disabled}
          onClick={() => {
            setIsOpen(true);
            inputRef.current?.focus();
          }}
          title="Browse products"
          type="button"
        >
          Browse
        </button>
      </div>

      {isOpen && (
        <div className={styles.merchantProductDropdown}>
          {productsQuery.isFetching && !productsQuery.data ? (
            <p className={styles.merchantProductDropdownStatus}>Searching products...</p>
          ) : productsQuery.isError ? (
            <p className={styles.merchantProductDropdownStatus}>Could not load products.</p>
          ) : (productsQuery.data?.products ?? []).length === 0 ? (
            <p className={styles.merchantProductDropdownStatus}>No products found.</p>
          ) : (
            productsQuery.data?.products.map((product) => {
              const isAlreadyAdded =
                existingProductKeys.has(product.variantId) ||
                existingProductKeys.has(product.productId);
              const isSelected = selectedProducts.some(
                (selectedProduct) => selectedProduct.variantId === product.variantId,
              );
              return (
                <button
                  className={`${styles.merchantProductDropdownItem} ${
                    isSelected ? styles.merchantProductDropdownItemSelected : ""
                  } ${isAlreadyAdded ? styles.merchantProductDropdownItemAdded : ""}`}
                  disabled={isAlreadyAdded}
                  key={product.variantId}
                  onClick={() => {
                    if (isAlreadyAdded) return;
                    setSelectedProducts((currentProducts) =>
                      isSelected
                        ? currentProducts.filter(
                            (selectedProduct) => selectedProduct.variantId !== product.variantId,
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
                  <em>{formatQuoteMoney(product.price, currency)}</em>
                  <b>{isAlreadyAdded ? "✓ Added" : isSelected ? "✓" : "+ Add"}</b>
                </button>
              );
            })
          )}
          <div className={styles.merchantProductDropdownFooter}>
            <button
              onClick={() => {
                setSelectedProducts([]);
                setIsOpen(false);
              }}
              type="button"
            >
              Cancel
            </button>
            <Form method="post">
              <input name="intent" type="hidden" value="add_quote_items" />
              <input
                name="selectedProducts"
                type="hidden"
                value={JSON.stringify(selectedProducts)}
              />
              <button disabled={selectedProducts.length === 0 || isSubmitting} type="submit">
                Confirm
              </button>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}
