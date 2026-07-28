import puppeteer from "@cloudflare/puppeteer";

interface Env {
  BROWSER: Fetcher;
  MCP_AUTH_TOKEN: string;
}

type RpcId = string | number | null;
type RpcRequest = { jsonrpc?: string; id?: RpcId; method?: string; params?: Record<string, unknown> };

const SEARCH_TOOL = {
  name: "amazon_search",
  description: "Read the first Amazon US search-result page for a keyword and return up to 48 product cards plus a viewport screenshot. Use this to judge effective same-product supply and visual relevance.",
  inputSchema: {
    type: "object",
    properties: {
      keyword: { type: "string", minLength: 2, maxLength: 100 },
      max_results: { type: "integer", minimum: 1, maximum: 48, default: 48 },
      screenshot: { type: "boolean", default: true }
    },
    required: ["keyword"],
    additionalProperties: false
  }
};

const PRODUCT_TOOL = {
  name: "amazon_product",
  description: "Read one public Amazon US product detail page and return visible title, image, product-detail text, BSR evidence, date-first-available evidence, seller/fulfillment evidence, variation ASINs, and a screenshot.",
  inputSchema: {
    type: "object",
    properties: {
      asin: { type: "string", pattern: "^[A-Z0-9]{10}$" },
      screenshot: { type: "boolean", default: true }
    },
    required: ["asin"],
    additionalProperties: false
  }
};

function json(id: RpcId, result: unknown, status = 200) {
  return Response.json({ jsonrpc: "2.0", id, result }, { status });
}

function rpcError(id: RpcId, code: number, message: string, status = 400) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

function authorized(request: Request, env: Env) {
  const expected = env.MCP_AUTH_TOKEN ? `Bearer ${env.MCP_AUTH_TOKEN}` : "";
  return Boolean(expected && request.headers.get("authorization") === expected);
}

function toolResult(data: unknown, screenshot?: Uint8Array) {
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: JSON.stringify(data) }
  ];
  if (screenshot) {
    content.push({
      type: "image",
      data: Buffer.from(screenshot).toString("base64"),
      mimeType: "image/png"
    });
  }
  return { content, structuredContent: data };
}

async function withAmazonPage<T>(env: Env, url: string, action: (page: any) => Promise<T>) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  let launchError: unknown;
  for (const waitMs of [0, 2_000, 5_000]) {
    if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
    try {
      browser = await puppeteer.launch(env.BROWSER);
      break;
    } catch (error) {
      launchError = error;
      if (!/429|rate limit/i.test(error instanceof Error ? error.message : String(error))) throw error;
    }
  }
  if (!browser) throw launchError instanceof Error ? launchError : new Error("Unable to create an Amazon browser session");
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const title = await page.title();
    const body = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) ?? "");
    if (/robot check|captcha|enter the characters you see/i.test(`${title}\n${body}`)) {
      throw new Error("Amazon returned a robot-check page; retry later or use the approved data-provider fallback.");
    }
    return await action(page);
  } finally {
    await browser.close();
  }
}

async function amazonSearch(env: Env, args: Record<string, unknown>) {
  const keyword = typeof args.keyword === "string" ? args.keyword.trim() : "";
  if (keyword.length < 2 || keyword.length > 100) throw new Error("keyword must contain 2-100 characters");
  const maxResults = Math.max(1, Math.min(48, Number(args.max_results) || 48));
  const includeScreenshot = args.screenshot !== false;
  const url = `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`;

  return withAmazonPage(env, url, async page => {
    await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 20_000 }).catch(() => undefined);
    const data = await page.evaluate((limit: number) => {
      const clean = (value: string | null | undefined) => value?.replace(/\s+/g, " ").trim() || null;
      const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-component-type="s-search-result"][data-asin]'));
      const items = cards.slice(0, limit).map((card, index) => {
        const asin = card.dataset.asin || "";
        const anchor = card.querySelector<HTMLAnchorElement>('h2 a, a.a-link-normal.s-no-outline');
        const image = card.querySelector<HTMLImageElement>('img.s-image');
        const text = clean(card.innerText) || "";
        return {
          position: index + 1,
          asin,
          title: clean(card.querySelector<HTMLElement>('h2')?.innerText),
          product_url: anchor?.href || (asin ? `https://www.amazon.com/dp/${asin}` : null),
          image_url: image?.src || null,
          price: clean(card.querySelector('.a-price .a-offscreen')?.textContent),
          sponsored: /Sponsored/i.test(text)
        };
      }).filter(item => item.asin);
      const resultInfo = clean(document.querySelector<HTMLElement>('[data-component-type="s-result-info-bar"], .s-desktop-toolbar')?.innerText);
      return {
        captured_at: new Date().toISOString(),
        result_info: resultInfo,
        returned_count: items.length,
        items
      };
    }, maxResults);
    const screenshot = includeScreenshot ? await page.screenshot({ type: "png", fullPage: false }) as Uint8Array : undefined;
    return toolResult({ keyword, search_url: url, ...data }, screenshot);
  });
}

async function amazonProduct(env: Env, args: Record<string, unknown>) {
  const asin = typeof args.asin === "string" ? args.asin.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{10}$/.test(asin)) throw new Error("asin must be a 10-character Amazon ASIN");
  const includeScreenshot = args.screenshot !== false;
  const url = `https://www.amazon.com/dp/${asin}?th=1&psc=1`;

  return withAmazonPage(env, url, async page => {
    await page.waitForSelector('#productTitle, [data-feature-name="title"]', { timeout: 20_000 }).catch(() => undefined);
    const data = await page.evaluate(() => {
      const clean = (value: string | null | undefined) => value?.replace(/\s+/g, " ").trim() || null;
      const texts = Array.from(document.querySelectorAll<HTMLElement>(
        '#detailBullets_feature_div li, #productDetails_detailBullets_sections1 tr, #productDetails_techSpec_section_1 tr, #productDetails_db_sections tr'
      )).map(node => clean(node.innerText)).filter(Boolean) as string[];
      const findEvidence = (label: RegExp) => texts.filter(text => label.test(text));
      const fulfillmentSelectors = [
        '#fulfillerInfoFeature_feature_div', '#merchantInfoFeature_feature_div', '#merchant-info',
        '#tabular-buybox', '#shipsFromSoldBy_feature_div', '#deliveryBlock_feature_div'
      ];
      const fulfillment_evidence = fulfillmentSelectors
        .map(selector => clean(document.querySelector<HTMLElement>(selector)?.innerText))
        .filter(Boolean);
      const variation_asins = Array.from(document.querySelectorAll<HTMLElement>('[data-defaultasin], [data-asin]'))
        .map(node => node.dataset.defaultasin || node.dataset.asin || "")
        .filter(value => /^[A-Z0-9]{10}$/.test(value));
      return {
        captured_at: new Date().toISOString(),
        title: clean(document.querySelector<HTMLElement>('#productTitle, [data-feature-name="title"]')?.innerText),
        image_url: document.querySelector<HTMLImageElement>('#landingImage, #imgBlkFront')?.src || null,
        price: clean(document.querySelector('.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice')?.textContent),
        bullets: Array.from(document.querySelectorAll<HTMLElement>('#feature-bullets li')).map(node => clean(node.innerText)).filter(Boolean),
        bsr_evidence: findEvidence(/Best Sellers Rank/i),
        date_first_available_evidence: findEvidence(/Date First Available/i),
        fulfillment_evidence,
        variation_asins: Array.from(new Set(variation_asins)).slice(0, 100),
        detail_evidence: texts
      };
    });
    const screenshot = includeScreenshot ? await page.screenshot({ type: "png", fullPage: false }) as Uint8Array : undefined;
    return toolResult({ asin, product_url: url, ...data }, screenshot);
  });
}

async function handleRpc(request: Request, env: Env) {
  let body: RpcRequest;
  try {
    body = await request.json<RpcRequest>();
  } catch {
    return rpcError(null, -32700, "Invalid JSON");
  }
  const id = body.id ?? null;

  if (body.method === "initialize") {
    return json(id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "amazon-frontend-verifier", version: "0.1.0" }
    });
  }
  if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (body.method === "tools/list") return json(id, { tools: [SEARCH_TOOL, PRODUCT_TOOL] });
  if (body.method === "ping") return json(id, {});
  if (body.method !== "tools/call") return rpcError(id, -32601, "Method not found");

  const name = typeof body.params?.name === "string" ? body.params.name : "";
  const args = body.params?.arguments && typeof body.params.arguments === "object"
    ? body.params.arguments as Record<string, unknown>
    : {};
  try {
    const result = name === "amazon_search"
      ? await amazonSearch(env, args)
      : name === "amazon_product"
        ? await amazonProduct(env, args)
        : null;
    if (!result) return rpcError(id, -32602, `Unknown tool: ${name}`);
    return json(id, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Amazon verification failed";
    return json(id, { content: [{ type: "text", text: message }], isError: true });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true, service: "amazon-frontend-verifier" });
    if (url.pathname !== "/mcp") return new Response("Not found", { status: 404 });
    if (!authorized(request, env)) return new Response("Unauthorized", { status: 401 });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
    return handleRpc(request, env);
  }
} satisfies ExportedHandler<Env>;
