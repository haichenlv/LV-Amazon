import * as XLSX from "xlsx";
import { normalizeProductRow } from "./rules";
import type { ProductInput } from "./types";

export function parseBatchWorkbook(bytes: ArrayBuffer): ProductInput[] {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames.find((name) => name === "产品信息填写") ?? workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel 中没有工作表");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" });
  const headerIndex = matrix.findIndex((row) => Array.isArray(row) && row.some((value) => String(value).includes("产品链接")) && row.some((value) => String(value).includes("产品简称")));
  if (headerIndex < 0) throw new Error("找不到批量产品信息表头");
  const headers = matrix[headerIndex].map((value) => String(value).trim());
  const products: ProductInput[] = [];
  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const values = matrix[i] ?? [];
    if (!values.some((value) => String(value).trim())) continue;
    const row = Object.fromEntries(headers.map((header, col) => [header, values[col] ?? ""]));
    const productLink = Object.entries(row).find(([key]) => key.includes("产品链接"))?.[1];
    if (!String(productLink ?? "").trim()) continue;
    products.push(normalizeProductRow(row, i + 1));
  }
  if (!products.length) throw new Error("没有读取到可处理的产品行");
  return products;
}
