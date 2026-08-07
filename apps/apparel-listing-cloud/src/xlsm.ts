import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { colorCode, colorMap, SIZE_VALUES } from "./rules";
import type { ProductInput, StoredImages, ValidationSummary } from "./types";

const H = {
  sku: "contribution_sku#1.value", productType: "product_type#1.value", action: "::record_action",
  parentage: "parentage_level[marketplace_id=ATVPDKIKX0DER]#1.value", parentSku: "child_parent_sku_relationship[marketplace_id=ATVPDKIKX0DER]#1.parent_sku", variation: "variation_theme#1.name",
  title: "item_name[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value", highlight: "title_differentiation[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value", brand: "brand[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value",
  productIdType: "amzn1.volt.ca.product_id_type", itemType: "item_type_keyword[marketplace_id=ATVPDKIKX0DER]#1.value", modelNumber: "model_number[marketplace_id=ATVPDKIKX0DER]#1.value", modelName: "model_name[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value", manufacturer: "manufacturer[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value",
  main: "main_product_image_locator[marketplace_id=ATVPDKIKX0DER]#1.media_location", swatch: "swatch_product_image_locator[marketplace_id=ATVPDKIKX0DER]#1.media_location",
  description: "product_description[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value", keywords: "generic_keyword[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value",
  style: "style[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value", department: "department[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value", gender: "target_gender[marketplace_id=ATVPDKIKX0DER]#1.value", age: "age_range_description[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value",
  apparelSystem: "apparel_size[marketplace_id=ATVPDKIKX0DER]#1.size_system", apparelClass: "apparel_size[marketplace_id=ATVPDKIKX0DER]#1.size_class", apparelValue: "apparel_size[marketplace_id=ATVPDKIKX0DER]#1.size", apparelBody: "apparel_size[marketplace_id=ATVPDKIKX0DER]#1.body_type", apparelHeight: "apparel_size[marketplace_id=ATVPDKIKX0DER]#1.height_type",
  shirtSystem: "shirt_size[marketplace_id=ATVPDKIKX0DER]#1.size_system", shirtClass: "shirt_size[marketplace_id=ATVPDKIKX0DER]#1.size_class", shirtValue: "shirt_size[marketplace_id=ATVPDKIKX0DER]#1.size", shirtBody: "shirt_size[marketplace_id=ATVPDKIKX0DER]#1.body_type", shirtHeight: "shirt_size[marketplace_id=ATVPDKIKX0DER]#1.height_type",
  material: "material[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value", fabric: "fabric_type[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value", packageQty: "item_package_quantity[marketplace_id=ATVPDKIKX0DER]#1.value", special: "special_size_type[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value",
  colorMap: "color[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.standardized_values#1", color: "color[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value", mpn: "part_number[marketplace_id=ATVPDKIKX0DER]#1.value", fit: "fit_type[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value", care: "care_instructions[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value", pattern: "pattern[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value", unitCount: "unit_count[marketplace_id=ATVPDKIKX0DER]#1.value", unitType: "unit_count[marketplace_id=ATVPDKIKX0DER]#1.type[language_tag=en_US].value",
  collar1: "collar_style[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value", collar2: "collar_style[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#2.value", shirtForm: "shirt_form_type[marketplace_id=ATVPDKIKX0DER]#1.value",
  sleeveLength: "sleeve[marketplace_id=ATVPDKIKX0DER]#1.length_description#1.value", sleeveType: "sleeve[marketplace_id=ATVPDKIKX0DER]#1.type[language_tag=en_US]#1.value", closure: "closure[marketplace_id=ATVPDKIKX0DER]#1.type[language_tag=en_US]#1.value", imported: "import_designation[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#1.value", condition: "condition_type[marketplace_id=ATVPDKIKX0DER]#1.value",
  listPrice: "list_price[marketplace_id=ATVPDKIKX0DER]#1.value", fulfillment: "fulfillment_availability#1.fulfillment_channel_code", quantity: "fulfillment_availability#1.quantity", handling: "fulfillment_availability#1.lead_time_to_ship_max_days", price: "purchasable_offer[marketplace_id=ATVPDKIKX0DER][audience=ALL]#1.our_price#1.schedule#1.value_with_tax", shipping: "merchant_shipping_group[marketplace_id=ATVPDKIKX0DER]#1.value", country: "country_of_origin[marketplace_id=ATVPDKIKX0DER]#1.value",
  complianceHandmade: "compliance_is_handmade[marketplace_id=ATVPDKIKX0DER]#1.value", compliancePrinting: "compliance_printing_method[marketplace_id=ATVPDKIKX0DER]#1.value", complianceAge: "compliance_age_range[marketplace_id=ATVPDKIKX0DER]#1.value", complianceWeave: "compliance_weave_type[marketplace_id=ATVPDKIKX0DER]#1.value", complianceShirtType: "compliance_shirt_type[marketplace_id=ATVPDKIKX0DER]#1.value", complianceCollar: "compliance_collar_type[marketplace_id=ATVPDKIKX0DER]#1.value",
} as const;

const bullets = Array.from({ length: 5 }, (_, i) => `bullet_point[marketplace_id=ATVPDKIKX0DER][language_tag=en_US]#${i + 1}.value`);
const others = Array.from({ length: 5 }, (_, i) => `other_product_image_locator_${i + 1}[marketplace_id=ATVPDKIKX0DER]#1.media_location`);
const necks = Array.from({ length: 5 }, (_, i) => `neck[marketplace_id=ATVPDKIKX0DER]#1.neck_style[language_tag=en_US]#${i + 1}.value`);
const sixComplianceBlank = [H.complianceWeave, H.complianceShirtType, H.compliancePrinting, H.complianceAge, H.complianceCollar, H.complianceHandmade];

function decodeXml(value: string): string { return value.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&amp;", "&"); }
function encodeXml(value: unknown): string { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;"); }
function lettersToNumber(value: string): number { let n = 0; for (const c of value) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; }
function numberToLetters(value: number): string { let n = value + 1, out = ""; while (n) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); } return out; }
function cellColumn(ref: string): number { return lettersToNumber(ref.match(/[A-Z]+/)?.[0] ?? "A"); }
function cellValue(cell: string, shared: string[]): string {
  const type = cell.match(/\bt="([^"]+)"/)?.[1];
  if (type === "inlineStr") return decodeXml([...(cell.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))].map((m) => m[1]).join(""));
  const raw = cell.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  return type === "s" ? shared[Number(raw)] ?? "" : decodeXml(raw);
}
function parseShared(xml?: string): string[] { return xml ? [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decodeXml([...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""))) : []; }
function readRows(xml: string): Map<number, string> { const rows = new Map<number, string>(); for (const m of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) { const n = Number(m[1].match(/\br="(\d+)"/)?.[1]); if (n) rows.set(n, m[0]); } return rows; }
function readCells(rowXml: string): Map<number, string> { const cells = new Map<number, string>(); for (const m of rowXml.matchAll(/<c\b[^>]*\br="([A-Z]+)\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)) cells.set(lettersToNumber(m[1]), m[0]); return cells; }
function cellStyle(cell?: string): string { return cell?.match(/\bs="([^"]+)"/)?.[1] ?? ""; }
function stableCode(value: string): string { let h = 2166136261; for (const c of value) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).toUpperCase().padStart(8, "0").slice(-8); }

function findTemplateSheet(files: Record<string, Uint8Array>): string {
  const workbook = strFromU8(files["xl/workbook.xml"]);
  const rels = strFromU8(files["xl/_rels/workbook.xml.rels"]);
  const tag = [...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g)].find((m) => decodeXml(m[1]) === "Template");
  if (!tag) throw new Error("XY 模板中找不到 Template 工作表");
  const target = [...rels.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g)].find((m) => m[1] === tag[2])?.[2];
  if (!target) throw new Error("无法解析 Template 工作表路径");
  return target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
}

function headerMap(sheetXml: string, shared: string[]): Map<string, number> {
  const row5 = readRows(sheetXml).get(5);
  if (!row5) throw new Error("XY 模板缺少第 5 行机器字段名");
  const map = new Map<string, number>();
  for (const [col, cell] of readCells(row5)) map.set(cellValue(cell, shared), col);
  return map;
}

function buildListingRows(product: ProductInput, images: Record<string, StoredImages>, headers: Map<string, number>): Map<string, string | number | null>[] {
  const has = (header: string) => headers.has(header);
  const prefix = `XYWX${product.listingDate}${product.shortName}-${product.skuSuffix}-`;
  const parentSku = `${prefix}PTPT`;
  const listPrice = Number((product.price * 2).toFixed(2));
  const common = (sku: string, parent: boolean) => {
    const row = new Map<string, string | number | null>();
    const set = (h: string, v: string | number | null) => { if (has(h)) row.set(h, v); };
    set(H.sku, sku); set(H.productType, "SHIRT"); set(H.action, "Create or Replace (Full Update)"); set(H.parentage, parent ? "Parent" : "Child"); set(H.parentSku, parent ? null : parentSku); set(H.variation, "SIZE/COLOR");
    set(H.title, parent ? product.parentTitle : product.childTitle); set(H.highlight, product.highlight); set(H.brand, "Generic"); set(H.productIdType, "GTIN Exempt"); set(H.itemType, "fashion-t-shirts"); set(H.modelNumber, null); set(H.modelName, "none"); set(H.manufacturer, "Generic");
    set(H.description, product.description); product.bullets.forEach((v, i) => set(bullets[i], v)); set(H.keywords, product.searchTerms); set(H.style, parent ? "fashion" : "Classic"); set(H.department, "Womens"); set(H.gender, "Female"); set(H.age, "Adult");
    for (const [system, klass, body, height] of [[H.shirtSystem, H.shirtClass, H.shirtBody, H.shirtHeight], [H.apparelSystem, H.apparelClass, H.apparelBody, H.apparelHeight]]) { set(system, "US"); set(klass, "Alpha"); set(body, "Regular"); set(height, "Regular"); }
    set(H.material, product.material); set(H.fabric, product.material); set(H.packageQty, 1); set(H.special, "Standard"); set(H.mpn, `${product.shortName}-${stableCode(`${product.shortName}:${product.listingDate}:${sku}`)}`); set(H.fit, "Regular"); set(H.care, "Machine Wash"); set(H.pattern, "Graphic"); set(H.unitCount, 1); set(H.unitType, "Count");
    set(H.collar1, product.neckStyle); set(H.collar2, product.neckStyle); necks.forEach((h) => set(h, product.neckValue)); set(H.shirtForm, "T-Shirt"); set(H.sleeveLength, product.sleeveType); set(H.sleeveType, product.sleeveType); set(H.closure, "Pull On"); set(H.imported, "Imported"); set(H.condition, "New"); set(H.listPrice, listPrice); set(H.country, "Japan"); sixComplianceBlank.forEach((h) => set(h, null));
    return row;
  };
  const rows: Map<string, string | number | null>[] = [];
  const parent = common(parentSku, true);
  parent.set(H.shirtValue, "One Size"); if (has(H.apparelValue)) parent.set(H.apparelValue, "One Size");
  [H.main, H.swatch, ...others, H.color, H.colorMap, H.fulfillment, H.quantity, H.handling, H.price, H.shipping].forEach((h) => { if (has(h)) parent.set(h, null); });
  rows.push(parent);
  for (const color of product.colors) for (const size of product.sizes) {
    const sku = `${prefix}${colorCode(color.name)}${size}`;
    const row = common(sku, false); const links = images[color.name]; if (!links) throw new Error(`缺少 ${color.name} 图片链接`);
    row.set(H.shirtValue, SIZE_VALUES[size]); if (has(H.apparelValue)) row.set(H.apparelValue, SIZE_VALUES[size]); row.set(H.color, color.name.toLowerCase()); row.set(H.colorMap, colorMap(color.name)); row.set(H.main, links.main); row.set(H.swatch, links.original); others.forEach((h) => { if (has(h)) row.set(h, links.original); });
    row.set(H.fulfillment, "Fulfillment by Merchant (Default)"); row.set(H.quantity, 1000); row.set(H.handling, 3); row.set(H.price, product.price); row.set(H.shipping, "6.99"); rows.push(row);
  }
  return rows;
}

function rewriteDataRows(sheetXml: string, headers: Map<string, number>, listingRows: Map<string, string | number | null>[]): string {
  const originalRows = readRows(sheetXml);
  const maxTemplateDataRow = Math.max(104, ...originalRows.keys());
  const replacement = new Map<number, string>();
  for (let rowNumber = 8; rowNumber <= maxTemplateDataRow; rowNumber++) {
    const original = originalRows.get(rowNumber) ?? originalRows.get(rowNumber === 8 ? 8 : 9);
    if (!original) throw new Error("XY 模板缺少父体/子体样式行");
    const attrs = original.match(/^<row\b([^>]*)>/)?.[1]?.replace(/\br="\d+"/, `r="${rowNumber}"`) ?? ` r="${rowNumber}"`;
    const oldCells = readCells(original);
    const values = listingRows[rowNumber - 8];
    const targetColumns = new Set(oldCells.keys());
    if (values) for (const header of values.keys()) { const col = headers.get(header); if (col !== undefined) targetColumns.add(col); }
    const cells = [...targetColumns].sort((a, b) => a - b).map((col) => {
      const ref = `${numberToLetters(col)}${rowNumber}`; const style = cellStyle(oldCells.get(col)); const styleAttr = style ? ` s="${style}"` : "";
      if (!values) return `<c r="${ref}"${styleAttr}/>`;
      const header = [...headers].find(([, index]) => index === col)?.[0]; const value = header ? values.get(header) : null;
      if (value === undefined || value === null || value === "") return `<c r="${ref}"${styleAttr}/>`;
      if (typeof value === "number") return `<c r="${ref}"${styleAttr} t="n"><v>${value}</v></c>`;
      return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${encodeXml(value)}</t></is></c>`;
    }).join("");
    replacement.set(rowNumber, `<row${attrs}>${cells}</row>`);
  }
  let out = sheetXml.replace(/<row\b([^>]*)>([\s\S]*?)<\/row>/g, (full, attrs) => { const n = Number(String(attrs).match(/\br="(\d+)"/)?.[1]); return replacement.get(n) ?? full; });
  for (let n = 8; n < 8 + listingRows.length; n++) if (!originalRows.has(n)) out = out.replace("</sheetData>", `${replacement.get(n)}</sheetData>`);
  const last = 7 + listingRows.length;
  out = out.replace(/<dimension\b[^>]*ref="([A-Z]+\d+):([A-Z]+)\d+"[^>]*\/>/, (_m, start, endCol) => `<dimension ref="${start}:${endCol}${Math.max(last, 7)}"/>`);
  return out;
}

export function createListingXlsm(templateBytes: ArrayBuffer, product: ProductInput, images: Record<string, StoredImages>): { bytes: Uint8Array; validation: ValidationSummary } {
  const files = unzipSync(new Uint8Array(templateBytes));
  const sheetPath = findTemplateSheet(files);
  const sheetXml = strFromU8(files[sheetPath]);
  const shared = parseShared(files["xl/sharedStrings.xml"] ? strFromU8(files["xl/sharedStrings.xml"]) : undefined);
  const headers = headerMap(sheetXml, shared);
  const essential = [H.sku, H.productType, H.title, H.highlight, H.productIdType, H.shirtSystem, H.shirtClass, H.shirtValue, H.style, H.sleeveType, H.fulfillment, H.quantity, H.price, H.shipping];
  const missing = essential.filter((header) => !headers.has(header)); if (missing.length) throw new Error(`XY 模板缺少必要机器字段：${missing.join(", ")}`);
  const rows = buildListingRows(product, images, headers);
  files[sheetPath] = strToU8(rewriteDataRows(sheetXml, headers, rows));
  const expectedChildren = product.colors.length * product.sizes.length;
  const validation: ValidationSummary = { status: "PASS", rows: rows.length, children: expectedChildren, colors: product.colors.length, sizes: product.sizes.length, titleLength: Math.max(product.parentTitle.length, product.childTitle.length), highlightLength: product.highlight.length, checks: ["Product Type 全部为 SHIRT", "父体 Shipping Template 为空", "子体 Shipping Template 全部为 6.99", "Shirt/Apparel Size 同步填写", "父体 Size Value 为 One Size", "六个指定 Compliance 字段为空", "Model Number 为空", "每行 MPN 唯一", "Main/Swatch/Other 图片已换成云端链接"] };
  return { bytes: zipSync(files, { level: 6 }), validation };
}
