export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: R2Bucket;
  APP_TOKEN: string;
  PUBLIC_BASE_URL: string;
  BG_REMOVAL_ENDPOINT?: string;
  BG_REMOVAL_API_KEY?: string;
}

export type SizeCode = "S" | "M" | "L" | "XL" | "2XL" | "3XL" | "4XL" | "5XL";

export interface ColorInput {
  name: string;
  originalUrl: string;
}

export interface ProductInput {
  rowNumber: number;
  productUrl: string;
  shortName: string;
  listingDate: string;
  skuSuffix: string;
  parentTitle: string;
  childTitle: string;
  highlight: string;
  exceptions: string;
  price: number;
  description: string;
  bullets: string[];
  searchTerms: string;
  colors: ColorInput[];
  sizes: SizeCode[];
  material: string;
  neckStyle: "Crew Neck" | "V-Neck";
  neckValue: "Crew Neck" | "V Neck";
  sleeveType: "Short Sleeve" | "Long Sleeve";
}

export interface StoredImages {
  main: string;
  original: string;
}

export interface ValidationSummary {
  status: "PASS" | "FAIL";
  rows: number;
  children: number;
  colors: number;
  sizes: number;
  titleLength: number;
  highlightLength: number;
  checks: string[];
}
