import type { ProductInput, SizeCode } from "./types";

export const SIZE_VALUES: Record<SizeCode, string> = {
  S: "Small",
  M: "Medium",
  L: "Large",
  XL: "X-Large",
  "2XL": "XX-Large (xx_l)",
  "3XL": "3X-Large",
  "4XL": "4X-Large",
  "5XL": "5X-Large",
};

export const DEFAULT_SIZES = Object.keys(SIZE_VALUES) as SizeCode[];

const HEADER_ALIASES = {
  productUrl: ["产品链接*", "产品链接", "Product URL"],
  shortName: ["产品简称*", "产品简称", "Short Name"],
  listingDate: ["上架日期*（MMDD）", "上架日期", "Listing Date"],
  skuSuffix: ["SKU后缀*（如DBRN/VT）", "SKU 后缀", "SKU后缀", "SKU Suffix"],
  parentTitle: ["父体标题*（≤75字符）", "父体标题", "Parent Title"],
  childTitle: ["子体标题（空=同父体）", "子体标题", "Child Title"],
  highlight: ["Item Highlight*（≤125字符）", "Item Highlight", "商品亮点"],
  exceptions: ["非标准要求（无则填“无”）", "非标准要求", "颜色/尺码例外说明"],
  price: ["售价*（USD）", "售价", "Price"],
  description: ["Product Description（空=由系统生成）", "Product Description", "产品描述"],
  searchTerms: ["Search Term（空=由系统生成）", "Search Term", "Search Terms", "搜索词"],
  material: ["面料", "Material"],
  neck: ["领型", "Neck Style"],
  sleeve: ["袖型", "Sleeve Type"],
  sizes: ["尺码", "尺码范围", "Sizes"],
} as const;

function pick(row: Record<string, unknown>, aliases: readonly string[]): string {
  for (const key of aliases) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function parseSizeRange(value: string, exceptions: string): SizeCode[] {
  const text = `${value} ${exceptions}`.toUpperCase().replaceAll("–", "-").replaceAll("—", "-");
  const explicit = [...text.matchAll(/(?:^|[^0-9A-Z])(S|M|L|XL|2XL|3XL|4XL|5XL)(?=$|[^0-9A-Z])/g)].map((m) => m[1] as SizeCode);
  const range = text.match(/(S|M|L|XL|2XL|3XL|4XL|5XL)\s*(?:到|至|-)\s*(S|M|L|XL|2XL|3XL|4XL|5XL)/);
  if (range) {
    const start = DEFAULT_SIZES.indexOf(range[1] as SizeCode);
    const end = DEFAULT_SIZES.indexOf(range[2] as SizeCode);
    if (start >= 0 && end >= start) return DEFAULT_SIZES.slice(start, end + 1);
  }
  return explicit.length ? [...new Set(explicit)] : DEFAULT_SIZES;
}

function safeGeneratedContent(title: string, neck: string, sleeve: string) {
  const subject = title.replace(/\s+/g, " ").trim() || "Women's Graphic Shirt";
  return {
    description: `${subject} with a ${neck.toLowerCase()} and ${sleeve.toLowerCase()} silhouette. Designed as an easy women's graphic shirt for casual daily outfits.`,
    bullets: [
      `Women's graphic shirt with an easy-to-style printed design.`,
      `${neck} neckline and ${sleeve.toLowerCase()} construction.`,
      `Regular fit works well with jeans, shorts, or casual bottoms.`,
      `Suitable for everyday wear, relaxed outings, and seasonal gifting.`,
      `Machine wash; please review the size information before ordering.`,
    ],
    searchTerms: `${subject} women graphic shirt ${neck} ${sleeve} casual top`.toLowerCase(),
  };
}

function normalizeColorCell(value: unknown): { name: string; originalUrl: string } | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = text.match(/^(.+?)[｜|]\s*(https?:\/\/\S+)$/i);
  if (!match) throw new Error(`颜色图片格式不正确：${text}`);
  return { name: match[1].trim(), originalUrl: match[2].trim() };
}

export function normalizeProductRow(row: Record<string, unknown>, rowNumber: number): ProductInput {
  const productUrl = pick(row, HEADER_ALIASES.productUrl);
  const shortName = pick(row, HEADER_ALIASES.shortName);
  const listingDate = pick(row, HEADER_ALIASES.listingDate).padStart(4, "0");
  const skuSuffix = pick(row, HEADER_ALIASES.skuSuffix);
  const parentTitle = pick(row, HEADER_ALIASES.parentTitle);
  const childTitle = pick(row, HEADER_ALIASES.childTitle) || parentTitle;
  const highlight = pick(row, HEADER_ALIASES.highlight);
  const exceptions = pick(row, HEADER_ALIASES.exceptions) || "无";
  const price = Number(pick(row, HEADER_ALIASES.price));
  const materialText = pick(row, HEADER_ALIASES.material) || exceptions;
  const neckText = `${pick(row, HEADER_ALIASES.neck)} ${exceptions} ${parentTitle}`.toLowerCase();
  const sleeveText = `${pick(row, HEADER_ALIASES.sleeve)} ${exceptions} ${parentTitle}`.toLowerCase();
  const material = /polyester|涤纶/i.test(materialText) ? "Polyester" : /cotton|棉/i.test(materialText) ? "Cotton" : "Cotton";
  const isVNeck = /v[\s-]?neck|v领/i.test(neckText);
  const longSleeve = /long[\s-]?sleeve|长袖|sweatshirt/i.test(sleeveText);
  const neckStyle = isVNeck ? "V-Neck" : "Crew Neck";
  const sleeveType = longSleeve ? "Long Sleeve" : "Short Sleeve";
  const generated = safeGeneratedContent(childTitle, neckStyle, sleeveType);
  const colors = Object.entries(row)
    .filter(([header]) => /^颜色\d+/.test(header))
    .map(([, value]) => normalizeColorCell(value))
    .filter((value): value is { name: string; originalUrl: string } => Boolean(value));
  const bullets = Array.from({ length: 5 }, (_, i) => pick(row, [`Bullet Point ${i + 1}（空=由系统生成）`, `Bullet Point ${i + 1}`]) || generated.bullets[i]);
  const description = pick(row, HEADER_ALIASES.description) || generated.description;
  const searchTerms = pick(row, HEADER_ALIASES.searchTerms) || generated.searchTerms;
  const sizes = parseSizeRange(pick(row, HEADER_ALIASES.sizes), exceptions);

  const missing = [
    [productUrl, "产品链接"], [shortName, "产品简称"], [listingDate, "上架日期"], [skuSuffix, "SKU后缀"],
    [parentTitle, "父体标题"], [highlight, "Item Highlight"], [Number.isFinite(price) && price > 0, "售价"], [colors.length, "颜色原图"],
  ].filter(([value]) => !value).map(([, label]) => label);
  if (missing.length) throw new Error(`第 ${rowNumber} 行缺少：${missing.join("、")}`);
  if (parentTitle.length > 75 || childTitle.length > 75) throw new Error(`第 ${rowNumber} 行标题超过 75 字符`);
  if (highlight.length > 125) throw new Error(`第 ${rowNumber} 行 Item Highlight 超过 125 字符`);
  if (!/^\d{4}$/.test(listingDate)) throw new Error(`第 ${rowNumber} 行上架日期必须为 MMDD`);

  return { rowNumber, productUrl, shortName, listingDate, skuSuffix, parentTitle, childTitle, highlight, exceptions, price, description, bullets, searchTerms, colors, sizes, material, neckStyle, neckValue: isVNeck ? "V Neck" : "Crew Neck", sleeveType };
}

export function colorCode(name: string): string {
  const known: Record<string, string> = { black: "BK", white: "WH", blue: "BL", navy: "NV", red: "RD", pink: "PK", green: "GN", gray: "GY", grey: "GY", orange: "OR", beige: "BE", brown: "BR", coffee: "CF", purple: "PU", yellow: "YL", khaki: "KH" };
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(known)) if (lower.includes(key)) return value;
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36).toUpperCase().padStart(2, "0").slice(-2);
}

export function colorMap(name: string): string {
  const values = ["Black", "White", "Blue", "Red", "Pink", "Green", "Gray", "Orange", "Beige", "Brown", "Purple", "Yellow", "Khaki"];
  return values.find((value) => name.toLowerCase().includes(value.toLowerCase())) ?? "Multicolored";
}

export function slug(value: string): string {
  return value.normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase();
}
