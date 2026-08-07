import type { Env, ProductInput, StoredImages } from "./types";
import { parseBatchWorkbook } from "./input";
import { createListingXlsm } from "./xlsm";
import { slug } from "./rules";

const TEMPLATE_KEY = "private/templates/xy-current.xlsm";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

function authorized(request: Request, env: Env): boolean {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return Boolean(env.APP_TOKEN) && token === env.APP_TOKEN;
}

function requireAuth(request: Request, env: Env): Response | null {
  return authorized(request, env) ? null : json({ error: "登录信息无效" }, 401);
}

function safeName(value: string): string {
  return value.replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 120);
}

function normalizeMatch(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function fileExtension(file: File): string {
  const byName = file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  if (byName) return byName.toLowerCase();
  return file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
}

function findWhiteImage(files: File[], product: ProductInput, color: string): File | undefined {
  const p = normalizeMatch(product.shortName); const c = normalizeMatch(color);
  const both = files.find((file) => { const n = normalizeMatch(file.name); return n.includes(p) && n.includes(c); });
  if (both) return both;
  return files.find((file) => normalizeMatch(file.name).includes(c));
}

async function putRemoteOriginal(env: Env, jobId: string, product: ProductInput, color: string, url: string): Promise<{ key: string; bytes: Uint8Array; contentType: string }> {
  const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 AmazonListingImporter/1.0" } });
  if (!response.ok) throw new Error(`${color} 原图下载失败（HTTP ${response.status}）`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`${color} 原图为空`);
  const contentType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const key = `public/${jobId}/${slug(product.shortName)}/${slug(color)}-original.${extension}`;
  await env.FILES.put(key, bytes, { metadata: { contentType, cacheControl: "public, max-age=31536000, immutable" } });
  return { key, bytes, contentType };
}

async function removeBackground(env: Env, original: Uint8Array, contentType: string, fileName: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (!env.BG_REMOVAL_ENDPOINT) throw new Error(`缺少 ${fileName} 白底图，且尚未配置自动抠图服务`);
  const form = new FormData();
  const imageBuffer = original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength) as ArrayBuffer;
  form.set("image", new File([imageBuffer], fileName, { type: contentType }));
  const response = await fetch(env.BG_REMOVAL_ENDPOINT, {
    method: "POST",
    headers: env.BG_REMOVAL_API_KEY ? { authorization: `Bearer ${env.BG_REMOVAL_API_KEY}` } : undefined,
    body: form,
  });
  if (!response.ok) throw new Error(`自动抠图服务失败（HTTP ${response.status}）`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get("content-type")?.split(";")[0] || "image/png" };
}

async function prepareImages(env: Env, jobId: string, product: ProductInput, whiteFiles: File[]): Promise<Record<string, StoredImages>> {
  const entries = await Promise.all(product.colors.map(async (color) => {
    const original = await putRemoteOriginal(env, jobId, product, color.name, color.originalUrl);
    const white = findWhiteImage(whiteFiles, product, color.name);
    let mainBytes: Uint8Array; let mainType: string; let extension: string;
    if (white) {
      mainBytes = new Uint8Array(await white.arrayBuffer()); mainType = white.type || "image/jpeg"; extension = fileExtension(white);
    } else {
      const processed = await removeBackground(env, original.bytes, original.contentType, `${product.shortName}-${color.name}.jpg`);
      mainBytes = processed.bytes; mainType = processed.contentType; extension = mainType.includes("png") ? "png" : "jpg";
    }
    const mainKey = `public/${jobId}/${slug(product.shortName)}/${slug(color.name)}-main.${extension}`;
    await env.FILES.put(mainKey, mainBytes, { metadata: { contentType: mainType, cacheControl: "public, max-age=31536000, immutable" } });
    const base = env.PUBLIC_BASE_URL.replace(/\/$/, "");
    return [color.name, { main: `${base}/media/${mainKey}`, original: `${base}/media/${original.key}` }] as const;
  }));
  return Object.fromEntries(entries);
}

async function updateJob(env: Env, id: string, status: string, completed: number, error: string | null = null) {
  await env.DB.prepare("UPDATE jobs SET status=?, completed_count=?, error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status, completed, error, id).run();
}

async function processBatch(env: Env, jobId: string, products: ProductInput[], whiteFiles: File[]) {
  const templateBytes = await env.FILES.get(TEMPLATE_KEY, "arrayBuffer");
  if (!templateBytes) throw new Error("尚未上传 XY 原始 XLSM 模板，请先到系统设置上传");
  let completed = 0;
  for (const product of products) {
    const productId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO products (id,job_id,row_number,short_name,listing_date,sku_suffix,status,color_count,variant_count) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(productId, jobId, product.rowNumber, product.shortName, product.listingDate, product.skuSuffix, "PROCESSING", product.colors.length, product.colors.length * product.sizes.length).run();
    try {
      const images = await prepareImages(env, jobId, product, whiteFiles);
      const result = createListingXlsm(templateBytes.slice(0), product, images);
      const fileName = `${safeName(product.shortName)}_${product.listingDate}_Amazon_US_SHIRT_XY最终上传.xlsm`;
      const outputKey = `private/outputs/${jobId}/${fileName}`;
      await env.FILES.put(outputKey, result.bytes, { metadata: { contentType: "application/vnd.ms-excel.sheet.macroEnabled.12", contentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"` } });
      await env.DB.prepare("UPDATE products SET status='COMPLETED', output_key=?, validation_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(outputKey, JSON.stringify(result.validation), productId).run();
      completed += 1; await updateJob(env, jobId, completed === products.length ? "COMPLETED" : "PROCESSING", completed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await env.DB.prepare("UPDATE products SET status='FAILED', error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(message, productId).run();
      await updateJob(env, jobId, "FAILED", completed, message);
      throw error;
    }
  }
}

async function createJob(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  const workbook = form.get("workbook");
  if (!(workbook instanceof File)) return json({ error: "请选择产品信息 Excel" }, 400);
  const whiteFiles = form.getAll("white_images").filter((value): value is File => value instanceof File && value.size > 0);
  const products = parseBatchWorkbook(await workbook.arrayBuffer());
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO jobs (id,status,source_name,product_count) VALUES (?,?,?,?)").bind(id, "PROCESSING", workbook.name, products.length).run();
  try {
    await processBatch(env, id, products, whiteFiles);
    return json({ id, status: "COMPLETED", productCount: products.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateJob(env, id, "FAILED", 0, message);
    return json({ id, status: "FAILED", error: message }, 422);
  }
}

async function listJobs(env: Env): Promise<Response> {
  const jobs = await env.DB.prepare("SELECT id,status,source_name,product_count,completed_count,error,created_at,updated_at FROM jobs ORDER BY created_at DESC LIMIT 50").all();
  const products = await env.DB.prepare("SELECT id,job_id,short_name,listing_date,status,color_count,variant_count,output_key,validation_json,error FROM products WHERE job_id IN (SELECT id FROM jobs ORDER BY created_at DESC LIMIT 50) ORDER BY created_at").all();
  const grouped = new Map<string, unknown[]>();
  for (const product of products.results) { const key = String(product.job_id); const list = grouped.get(key) ?? []; list.push({ ...product, downloadUrl: product.output_key ? `/downloads/${product.output_key}` : null, validation: product.validation_json ? JSON.parse(String(product.validation_json)) : null, output_key: undefined, validation_json: undefined }); grouped.set(key, list); }
  return json({ jobs: jobs.results.map((job) => ({ ...job, products: grouped.get(String(job.id)) ?? [] })) });
}

async function uploadTemplate(request: Request, env: Env): Promise<Response> {
  const form = await request.formData(); const file = form.get("template");
  if (!(file instanceof File) || !/\.xlsm$/i.test(file.name)) return json({ error: "请选择 XY 原始 .xlsm 模板" }, 400);
  await env.FILES.put(TEMPLATE_KEY, await file.arrayBuffer(), { metadata: { contentType: "application/vnd.ms-excel.sheet.macroEnabled.12", originalName: file.name, uploadedAt: new Date().toISOString() } });
  await env.DB.prepare("INSERT INTO app_settings (key,value,updated_at) VALUES ('template_meta',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify({ name: file.name, size: file.size, uploadedAt: new Date().toISOString() })).run();
  return json({ ok: true, name: file.name, size: file.size });
}

async function getSettings(env: Env): Promise<Response> {
  const record = await env.DB.prepare("SELECT value FROM app_settings WHERE key='template_meta'").first<{ value: string }>();
  return json({ template: record?.value ? JSON.parse(record.value) : null, backgroundRemovalConfigured: Boolean(env.BG_REMOVAL_ENDPOINT) });
}

async function serveObject(env: Env, key: string, download: boolean): Promise<Response> {
  if (!key.startsWith(download ? "private/outputs/" : "public/")) return new Response("Not found", { status: 404 });
  const object = await env.FILES.getWithMetadata<{ contentType?: string; cacheControl?: string; contentDisposition?: string }>(key, "stream");
  if (!object.value) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  if (object.metadata?.contentType) headers.set("content-type", object.metadata.contentType);
  if (object.metadata?.cacheControl) headers.set("cache-control", object.metadata.cacheControl);
  if (object.metadata?.contentDisposition) headers.set("content-disposition", object.metadata.contentDisposition);
  if (!download) headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.value, { headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/media/") && request.method === "GET") return serveObject(env, decodeURIComponent(url.pathname.slice(7)), false);
      if (url.pathname === "/api/health") return json({ ok: true, service: "amazon-apparel-listing-cloud" });
      const authError = requireAuth(request, env); if (authError) return authError;
      if (url.pathname.startsWith("/downloads/") && request.method === "GET") return serveObject(env, decodeURIComponent(url.pathname.slice(11)), true);
      if (url.pathname === "/api/session" && request.method === "GET") return json({ ok: true });
      if (url.pathname === "/api/settings" && request.method === "GET") return getSettings(env);
      if (url.pathname === "/api/settings/template" && request.method === "POST") return uploadTemplate(request, env);
      if (url.pathname === "/api/jobs" && request.method === "GET") return listJobs(env);
      if (url.pathname === "/api/jobs" && request.method === "POST") return createJob(request, env);
      if (url.pathname.startsWith("/api/")) return json({ error: "接口不存在" }, 404);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("request_failed", { path: url.pathname, error: error instanceof Error ? error.message : String(error) });
      return json({ error: error instanceof Error ? error.message : "服务异常" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
