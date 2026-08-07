import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const child = spawn(process.execPath, [wrangler, "dev", "--port", "8791", "--var", "APP_TOKEN:smoke-token"], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  stdio: ["ignore", "pipe", "pipe"],
});

let logs = "";
child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

try {
  for (let attempt = 0; attempt < 60 && !logs.includes("Ready on http://localhost:8791"); attempt++) await delay(500);
  if (!logs.includes("Ready on http://localhost:8791")) throw new Error(`Wrangler did not become ready:\n${logs.slice(-4000)}`);
  const auth = { authorization: "Bearer smoke-token" };
  const request = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
  const [home, health, settings, jobs, unauthorized] = await Promise.all([
    request("http://127.0.0.1:8791/"),
    request("http://127.0.0.1:8791/api/health"),
    request("http://127.0.0.1:8791/api/settings", { headers: auth }),
    request("http://127.0.0.1:8791/api/jobs", { headers: auth }),
    request("http://127.0.0.1:8791/api/jobs"),
  ]);
  const result = {
    home: { status: home.status, hasTitle: (await home.text()).includes("亚马逊服装上架工作台") },
    health: { status: health.status, body: await health.json() },
    settings: { status: settings.status, body: await settings.json() },
    jobs: { status: jobs.status, body: await jobs.json() },
    unauthorized: { status: unauthorized.status, body: await unauthorized.json() },
  };
  if (result.home.status !== 200 || !result.home.hasTitle || result.health.status !== 200 || result.settings.status !== 200 || !result.settings.body.template || result.jobs.status !== 200 || result.unauthorized.status !== 401) throw new Error(JSON.stringify(result));
  console.log(JSON.stringify({ status: "PASS", ...result }, null, 2));
} finally {
  child.kill("SIGTERM");
}
