import { openPageActions } from "./settings-helpers.js";
import { test, expect } from "@playwright/test";

// Run against a real workerd/D1 dev server; normal regression runs need no backend.
test.skip(
  !process.env.SHORT_LINKS_TEST_API,
  "Set SHORT_LINKS_TEST_API to a local Wrangler server.",
);
const endpoint = process.env.SHORT_LINKS_TEST_API;
if (
  endpoint &&
  !["localhost", "127.0.0.1"].includes(new URL(endpoint).hostname)
)
  throw new Error("Short-link tests only support a local service.");

test("create, open under a Pages subpath, keep immutable copy and disable", async ({
  page,
  context,
}) => {
  await context.route("**/src/config.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const SHORT_LINKS_API = " + JSON.stringify(endpoint) + ";",
    }),
  );
  // Local emulator only: separate rate-limit actors for the two build targets.
  await context.setExtraHTTPHeaders({
    "CF-Connecting-IP": "192.0.2." + Math.ceil(Math.random() * 200),
  });
  await page.goto("editor.html");
  await expect(page.locator("#editor")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await page.locator("#editor").fill("Original shared copy");
  const puts = [];
  page.on("request", (req) => {
    if (req.url().startsWith(endpoint) && req.method() === "PUT")
      puts.push(req);
  });
  await openPageActions(page);
  await page
    .getByRole("button", { name: "Share a copy…", exact: true })
    .click();
  expect(puts).toHaveLength(0);
  await page.locator("#createShortLinkBtn").click();
  await expect(page.locator("#shortLinkResult")).toBeVisible();
  expect(puts).toHaveLength(1);
  const url = await page.locator("#shortLinkResult").inputValue();
  expect(url.length).toBeLessThan(100);
  expect(new URL(url).pathname).toMatch(/\/dist\/(pwa|edge-extension)\/s\/$/);
  await page.locator("#closePublishBtn").click();
  await page.locator("#editor").fill("Edited private version");
  const reader = await context.newPage();
  await reader.goto(url);
  await expect(reader.locator("#readerContent")).toHaveText(
    "Original shared copy",
  );
  await openPageActions(page);
  await page
    .getByRole("button", { name: "Share a copy…", exact: true })
    .click();
  await page.locator("#sharedLinksDetails summary").click();
  await page.getByRole("button", { name: "Disable link", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm disable", exact: true })
    .click();
  await expect(page.locator(".shared-link-row small")).toContainText(
    "Disabled",
  );
  await reader.reload();
  await expect(reader.locator("#readerStateText")).toContainText("unavailable");
  await expect(page.locator("#editor")).toHaveText("Edited private version");
});

test("lost response retries the same link, without uploading a second copy", async ({
  page,
  context,
}) => {
  await context.route("**/src/config.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const SHORT_LINKS_API = " + JSON.stringify(endpoint) + ";",
    }),
  );
  await context.setExtraHTTPHeaders({
    "CF-Connecting-IP": "198.51.100." + Math.ceil(Math.random() * 200),
  });
  let interrupted = false;
  const ids = [];
  await page.route(endpoint + "/v1/notes/*", async (route) => {
    if (route.request().method() === "PUT") {
      ids.push(route.request().url());
      if (!interrupted) {
        interrupted = true;
        await route.fetch();
        await route.abort();
        return;
      }
    }
    await route.continue();
  });
  await page.goto("editor.html");
  await expect(page.locator("#editor")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await page.locator("#editor").fill("Network interruption copy");
  await openPageActions(page);
  await page
    .getByRole("button", { name: "Share a copy…", exact: true })
    .click();
  await page.locator("#createShortLinkBtn").click();
  await expect(page.locator("#shortLinkStatus")).toContainText("Cannot reach");
  await page.locator("#sharedLinksDetails summary").click();
  await page
    .getByRole("button", { name: "Retry same link", exact: true })
    .click();
  await expect(page.locator("#shortLinkResult")).toBeVisible();
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  await page.getByRole("button", { name: "Disable link", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm disable", exact: true })
    .click();
  await expect(page.locator(".shared-link-row small")).toContainText(
    "Disabled",
  );
});

test("encrypted keys restore management in another isolated browser profile", async ({
  page,
  context,
  browser,
}, testInfo) => {
  await context.route("**/src/config.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const SHORT_LINKS_API = " + JSON.stringify(endpoint) + ";",
    }),
  );
  await context.setExtraHTTPHeaders({
    "CF-Connecting-IP": "203.0.113." + Math.ceil(Math.random() * 200),
  });
  await page.goto("editor.html");
  await expect(page.locator("#editor")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await page.locator("#editor").fill("Synthetic key recovery copy");
  await openPageActions(page);
  await page
    .getByRole("button", { name: "Share a copy…", exact: true })
    .click();
  await page.locator("#createShortLinkBtn").click();
  await expect(page.locator("#shortLinkResult")).toBeVisible();
  const link = await page.locator("#shortLinkResult").inputValue();
  await page.locator("#closePublishBtn").click();
  await page.locator("#settingsToggleBtn").click();
  await page.locator("#linkKeyBackupBtn").click();
  await page.locator("#linkKeyPassphrase").fill("test recovery passphrase");
  const event = page.waitForEvent("download");
  await page.locator("#exportLinkKeysBtn").click();
  const file = await event,
    stream = await file.createReadStream();
  let encrypted = "";
  for await (const chunk of stream) encrypted += chunk;
  expect(encrypted).not.toContain("Synthetic key recovery copy");
  expect(JSON.parse(encrypted).format).toBe("BlackboardTextLinkKeys");
  const recovered = await browser.newContext({ serviceWorkers: "block" });
  try {
    await recovered.route("**/src/config.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body:
          "export const SHORT_LINKS_API = " + JSON.stringify(endpoint) + ";",
      }),
    );
    await recovered.setExtraHTTPHeaders({
      "CF-Connecting-IP": "192.0.2." + Math.ceil(Math.random() * 200),
    });
    const other = await recovered.newPage();
    await other.goto(testInfo.project.use.baseURL + "editor.html");
    await expect(other.locator("#editor")).toHaveAttribute(
      "contenteditable",
      "true",
    );
    await other.locator("#settingsToggleBtn").click();
    await other.locator("#linkKeyBackupBtn").click();
    await other.locator("#linkKeyPassphrase").fill("test recovery passphrase");
    const mutations = [];
    other.on("request", (request) => {
      if (
        request.url().startsWith(endpoint) &&
        ["PUT", "DELETE"].includes(request.method())
      )
        mutations.push(request.method());
    });
    await other.locator("#importLinkKeysFile").setInputFiles({
      name: "keys.blackboard-keys.json",
      mimeType: "application/json",
      buffer: Buffer.from(encrypted),
    });
    await expect(other.locator("#linkKeyBackupStatus")).toContainText(
      "1 link controls restored",
    );
    expect(mutations).toHaveLength(0);
    await other.locator("#closeLinkKeysBtn").click();
    await other.locator("#settingsCloseBtn").click();
    await openPageActions(other);
    await other
      .getByRole("button", { name: "Share a copy…", exact: true })
      .click();
    await other.locator("#sharedLinksDetails summary").click();
    await other
      .getByRole("button", { name: "Disable link", exact: true })
      .click();
    await other
      .getByRole("button", { name: "Confirm disable", exact: true })
      .click();
    await expect(other.locator(".shared-link-row small")).toContainText(
      "Disabled",
    );
    expect(mutations).toEqual(["DELETE"]);
    const reader = await recovered.newPage();
    await reader.goto(link);
    await expect(reader.locator("#readerStateText")).toContainText(
      "unavailable",
    );
  } finally {
    await recovered.close().catch(() => {});
  }
});
