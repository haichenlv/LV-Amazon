const state = { token: sessionStorage.getItem("listing-token") || "", jobs: [] };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...(options.headers || {}), authorization: `Bearer ${state.token}` } });
  const type = response.headers.get("content-type") || "";
  const body = type.includes("json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(body.error || body || `HTTP ${response.status}`);
  return body;
}

function setView(name) {
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  const names = { workbench: "上架工作台", jobs: "任务记录", rules: "规则库", settings: "系统设置" };
  $("#page-title").textContent = names[name];
}

const rules = [
  ["01 · 类目", "统一使用 SHIRT", "短袖、长袖、T-shirt、shirt 或 sweatshirt，Product Type 均为 SHIRT；真实袖型和领型仍按产品填写。"],
  ["02 · 标题", "75 / 125 字符限制", "Item Name 不超过 75 字符；Item Highlight 不超过 125 字符。用户填写内容优先。"],
  ["03 · 尺码", "两套尺码字段同步", "Apparel Size 与 Shirt Size 同步：US / Alpha / Regular；父体 One Size，子体按 SKU 映射。"],
  ["04 · 报价", "List Price = 售价 × 2", "父体售价为空；子体填写售价。List Price 按每个产品售价自动计算。"],
  ["05 · 库存物流", "父空、子体固定", "父体库存、履约、处理时间、Shipping 留空；子体 FBM、数量 1000、处理时间 3、Shipping 6.99。"],
  ["06 · 图片", "Main 与原图分流", "Main 使用已抠白底图且不再校验；Swatch 与 Other 使用重新托管的原图；父体图片为空。"],
  ["07 · 标识", "SKU / MPN 唯一", "Model Number 留空；Model Name 为 none；MPN 使用产品简称与稳定随机码，每一行独立。"],
  ["08 · 默认属性", "固定服装属性", "Special Size Standard、Fit Regular、Machine Wash、Japan、Imported、New、Generic。"],
  ["09 · 合规", "六个字段必须空白", "Weave Type、Shirt Type、Printing method、Age Range、Collar Type、Is Handmade 均不填写。"],
];
$("#rule-grid").innerHTML = rules.map(([n, h, p]) => `<article class="rule-card"><span>${n}</span><h3>${h}</h3><p>${p}</p></article>`).join("");

function escapeHtml(value) { const div = document.createElement("div"); div.textContent = String(value ?? ""); return div.innerHTML; }
function statusClass(status) { return status === "COMPLETED" ? "completed" : status === "FAILED" ? "failed" : "processing"; }
function statusLabel(status) { return status === "COMPLETED" ? "已完成" : status === "FAILED" ? "失败" : "处理中"; }

function renderJobs(target, jobs) {
  const node = $(target);
  if (!jobs.length) { node.className = "job-list empty-state"; node.innerHTML = `<span>◎</span><p>还没有任务</p><small>新任务会显示在这里。</small>`; return; }
  node.className = "job-list";
  node.innerHTML = jobs.map((job) => `<article class="job-card"><div><h4>${escapeHtml(job.source_name)}</h4><div class="job-meta"><span>${escapeHtml(job.created_at)}</span><span>${job.product_count} 个产品</span><span>${job.completed_count}/${job.product_count} 已完成</span></div></div><span class="status ${statusClass(job.status)}">${statusLabel(job.status)}</span>${job.error ? `<div class="error-text">${escapeHtml(job.error)}</div>` : ""}<div class="products">${(job.products || []).map((p) => `<div class="product-row"><div><strong>${escapeHtml(p.short_name)}</strong><br><small>${p.color_count} 色 · ${p.variant_count} 个子体</small></div><span class="status ${statusClass(p.status)}">${statusLabel(p.status)}</span>${p.downloadUrl ? `<a class="download" href="${p.downloadUrl}" data-download>下载 XLSM</a>` : ""}${p.error ? `<div class="error-text">${escapeHtml(p.error)}</div>` : ""}</div>`).join("") || `<small>正在准备产品记录…</small>`}</div></article>`).join("");
  node.querySelectorAll("[data-download]").forEach((link) => link.addEventListener("click", async (event) => { event.preventDefault(); const response = await fetch(link.getAttribute("href"), { headers: { authorization: `Bearer ${state.token}` } }); if (!response.ok) return alert("下载失败，请重新登录"); const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = decodeURIComponent(response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || "Amazon_Listing.xlsm"); a.click(); URL.revokeObjectURL(url); }));
}

async function refresh() {
  const [jobs, settings] = await Promise.all([api("/api/jobs"), api("/api/settings")]);
  state.jobs = jobs.jobs || [];
  renderJobs("#recent-jobs", state.jobs.slice(0, 3)); renderJobs("#all-jobs", state.jobs);
  const pill = $("#template-pill");
  if (settings.template) { pill.textContent = `XY 模板 · ${settings.template.name}`; pill.className = "pill success"; $("#template-meta").textContent = `${settings.template.name} · ${Math.round(settings.template.size / 1024)} KB`; }
  else { pill.textContent = "尚未上传 XY 模板"; pill.className = "pill warning"; }
  $("#bg-status").textContent = settings.backgroundRemovalConfigured ? "已配置" : "未配置（需提供白底图）";
}

$("#login-form").addEventListener("submit", async (event) => { event.preventDefault(); state.token = $("#token").value; try { await api("/api/session"); sessionStorage.setItem("listing-token", state.token); $("#login").classList.add("hidden"); $("#login-error").textContent = ""; await refresh(); } catch (error) { $("#login-error").textContent = error.message; } });
$("#workbook").addEventListener("change", (event) => { $("#workbook-name").textContent = event.target.files[0]?.name || "尚未选择"; });
$("#white-images").addEventListener("change", (event) => { const count = event.target.files.length; $("#images-name").textContent = count ? `已选择 ${count} 张白底图` : "可不选；缺图时调用自动抠图服务"; });

$("#job-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.currentTarget.querySelector("button[type=submit]"); const message = $("#job-message");
  button.disabled = true; button.querySelector("span").textContent = "正在生成，请勿关闭…"; message.className = "form-message"; message.textContent = "正在读取 Excel、迁移图片并写入 XY 模板。产品较多时需要几分钟。";
  const form = new FormData(); form.set("workbook", $("#workbook").files[0]); for (const file of $("#white-images").files) form.append("white_images", file);
  try { const result = await api("/api/jobs", { method: "POST", body: form }); message.textContent = `任务已完成：${result.productCount} 个上架文件。`; await refresh(); setView("jobs"); }
  catch (error) { message.className = "form-message error"; message.textContent = error.message; await refresh().catch(() => {}); }
  finally { button.disabled = false; button.querySelector("span").textContent = "开始生成上架文件"; }
});

$("#template-form").addEventListener("submit", async (event) => { event.preventDefault(); const file = $("#template-file").files[0]; const message = $("#template-message"); const form = new FormData(); form.set("template", file); try { await api("/api/settings/template", { method: "POST", body: form }); message.textContent = "XY 模板已更新并保存到私有存储。"; message.className = "form-message"; await refresh(); } catch (error) { message.textContent = error.message; message.className = "form-message error"; } });
$$('[data-view]').forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
$$('[data-go]').forEach((button) => button.addEventListener("click", () => setView(button.dataset.go)));
$("#refresh").addEventListener("click", () => refresh().catch((error) => alert(error.message)));
$("#jobs-refresh").addEventListener("click", () => refresh().catch((error) => alert(error.message)));

if (state.token) api("/api/session").then(() => { $("#login").classList.add("hidden"); refresh(); }).catch(() => sessionStorage.removeItem("listing-token"));
