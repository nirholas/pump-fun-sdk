import { chromium } from "playwright";
import fs from "fs";

const TARGET = "https://sectbot.com/app";
const LOG_FILE = "sectbot-output.log";
const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
};

async function scrape() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  // Remove webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
  const page = await context.newPage();

  // Collect any API/XHR responses
  const apiResponses = [];
  page.on("response", async (res) => {
    const ct = res.headers()["content-type"] || "";
    if (ct.includes("json")) {
      try {
        const url = res.url();
        const body = await res.json();
        apiResponses.push({ url, body });
      } catch {
        // Non-JSON body on a json content-type. Not a response we care about.
      }
    }
  });

  console.log(`Navigating to ${TARGET} ...`);
  await page.goto(TARGET, { waitUntil: "networkidle", timeout: 60000 });

  // Wait a bit for Cloudflare challenge to resolve
  console.log("Waiting for Cloudflare challenge...");
  await page.waitForTimeout(10000);

  // Check if we're still on the challenge page
  const title = await page.title();
  console.log(`Page title: ${title}`);

  if (title === "Just a moment...") {
    console.log("Still on Cloudflare challenge — waiting longer...");
    await page.waitForTimeout(15000);
  }

  const finalTitle = await page.title();
  console.log(`Final title: ${finalTitle}`);

  // Grab the full HTML
  const html = await page.content();
  console.log(`\n--- HTML length: ${html.length} chars ---`);
  console.log(html.slice(0, 3000));
  console.log("\n... (truncated) ...\n");

  // Print visible text
  const text = await page.evaluate(() => document.body.innerText);
  console.log("--- Visible text ---");
  console.log(text.slice(0, 2000));

  // Print captured API calls
  if (apiResponses.length > 0) {
    console.log(`\n--- Captured ${apiResponses.length} JSON API responses ---`);
    for (const r of apiResponses) {
      console.log(`\nURL: ${r.url}`);
      console.log(JSON.stringify(r.body, null, 2).slice(0, 1000));
    }
  } else {
    console.log("\n--- No JSON API responses captured ---");
  }

  // Take a screenshot for visual inspection
  await page.screenshot({ path: "sectbot-screenshot.png", fullPage: true });
  console.log("\nScreenshot saved to sectbot-screenshot.png");

  await browser.close();
}

scrape().catch((err) => {
  console.error("Scrape failed:", err.message);
  process.exit(1);
});
