export type AdminProductSearchItem = {
  productId: string;
  variantId: string;
  title: string;
  variantTitle: string;
  sku: string;
  price: number;
  imageUrl: string;
};

export type AdminProductSearchData = {
  products: AdminProductSearchItem[];
};
