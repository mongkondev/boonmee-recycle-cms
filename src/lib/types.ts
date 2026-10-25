export type ProductRow = {
  id: number;
  title: string;
  description: string | null;
  imageId: string | null;
  price: number;
  /** pending price waiting for publish */
  draftPrice: number | null;
  priceNote: string | null;
  unitId: number | null;
  unitName: string | null;
  isActive: boolean;
  sortOrder: number;
  /** optional grouping inside the main category */
  subCategoryId: number | null;
  subName: string | null;
  /** true when there is no sub category */
  subActive: boolean;
  mainCategoryId: number;
  mainName: string;
  mainActive: boolean;
  /** price before the latest change, null when the price has never changed */
  prevPrice: number | null;
  lastChanged: string | null;
};

export type CategoryTree = {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  /** products attached to the main category without a sub category */
  directCount: number;
  subs: { id: number; name: string; sortOrder: number; isActive: boolean; productCount: number }[];
}[];

export type Unit = { id: number; name: string; sortOrder: number; productCount: number };

export type ShopSettings = {
  shop_name: string;
  phones: string;
  tagline: string;
  open_hours: string;
  line_url: string;
  website: string;
};
