import fs from "node:fs";
import crypto from "node:crypto";
import { unzipSync } from "fflate";
import { createListingXlsm } from "../src/xlsm";
import type { ProductInput } from "../src/types";

const templatePath = process.argv[2];
const outputPath = process.argv[3];
if (!templatePath || !outputPath) throw new Error("Usage: regression <template.xlsm> <output.xlsm>");

const product: ProductInput = {
  rowNumber: 7,
  productUrl: "https://example.com/product",
  shortName: "CloudTest",
  listingDate: "0807",
  skuSuffix: "VT",
  parentTitle: "Women's Graphic Shirt",
  childTitle: "Women's Graphic Shirt",
  highlight: "Funny Crew Neck Tshirt",
  exceptions: "无",
  price: 12.99,
  description: "Women's graphic shirt with a crew neck and short sleeves for casual daily wear.",
  bullets: ["Graphic shirt for women.", "Crew neck style.", "Short sleeve construction.", "Regular casual fit.", "Machine wash."],
  searchTerms: "women graphic shirt crew neck funny tshirt",
  colors: [
    { name: "Black", originalUrl: "https://media.example.com/black.jpg" },
    { name: "Blue", originalUrl: "https://media.example.com/blue.jpg" },
  ],
  sizes: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
  material: "Cotton",
  neckStyle: "Crew Neck",
  neckValue: "Crew Neck",
  sleeveType: "Short Sleeve",
};

const images = Object.fromEntries(product.colors.map((color) => [color.name, {
  main: `https://listing.example.com/${color.name.toLowerCase()}-main.jpg`,
  original: `https://listing.example.com/${color.name.toLowerCase()}-original.jpg`,
}]));
const input = fs.readFileSync(templatePath);
const result = createListingXlsm(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), product, images);
fs.writeFileSync(outputPath, result.bytes);

const before = unzipSync(input);
const after = unzipSync(result.bytes);
const digest = (value: Uint8Array | undefined) => value ? crypto.createHash("sha256").update(value).digest("hex") : null;
const retainedEntries = Object.keys(before).filter((name) => /vbaProject\.bin$|^customXml\//i.test(name));
const mismatches = retainedEntries.filter((name) => digest(before[name]) !== digest(after[name]));
if (mismatches.length) throw new Error(`Retained OOXML entries changed: ${mismatches.join(", ")}`);
if (before["xl/vbaProject.bin"] && !after["xl/vbaProject.bin"]) throw new Error("vbaProject.bin is missing from output");
if (digest(before["xl/workbook.xml"]) !== digest(after["xl/workbook.xml"])) throw new Error("workbook.xml changed unexpectedly");
if (result.validation.rows !== 17 || result.validation.children !== 16) throw new Error("Variant row count is incorrect");
console.log(JSON.stringify({ outputPath, validation: result.validation, retainedEntries: retainedEntries.length, retainedMismatch: mismatches.length, zipEntries: Object.keys(after).length }, null, 2));
