import { chromium } from "../ui-smoke/node_modules/playwright-core/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = "https://rosetta.banjo-tint.ts.net:40888";
const results = [];
await mkdir(new URL("./screenshots/", import.meta.url), { recursive: true });
const browser = await chromium.launch({
  executablePath: "/home/ubuntu/.local/share/mise/installs/http-chrome-for-testing/149.0.7827.54/chrome",
  headless: true, args: ["--no-sandbox"],
});
try {
  for (const profile of [{ width: 390, colorScheme: "dark" }, { width: 1280, colorScheme: "light" }]) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: 900 }, colorScheme: profile.colorScheme });
    for (const id of ["analytics", "machine-monitor", "thread-manager"]) {
      const page = await context.newPage();
      const errors = [], badResponses = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("response", response => {
        if (response.status() >= 400 && response.url().startsWith(base)) badResponses.push({ status: response.status(), path: new URL(response.url()).pathname });
      });
      await page.goto(`${base}/plugins/${id}/${id}`, { waitUntil: "domcontentloaded" });
      await page.locator("main").first().waitFor();
      await page.waitForTimeout(900);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
      await page.screenshot({ path: new URL(`./screenshots/${id}-${profile.width}.png`, import.meta.url).pathname });
      results.push({ id, ...profile, overflow, errors, badResponses,
        coverage: badResponses.some(response => response.status === 401) ? "auth-required; shell only" : "rendered read-only page" });
      await page.close();
    }
    await context.close();
  }
  await writeFile(new URL("./browser-results.json", import.meta.url), JSON.stringify(results, null, 2) + "\n");
  assert.ok(results.every(result => !result.overflow && result.errors.length === 0 && result.badResponses.every(response => response.status < 500)), JSON.stringify(results));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
