import { test, expect } from "@playwright/test";

// The landing page ships with the website only; the extension opens the
// editor directly.
test.beforeEach(async ({ browserName }, testInfo) => {
  test.skip(testInfo.project.name !== "pwa");
});

test("landing page links to the editor and loads nothing from elsewhere", async ({ page }, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL).origin;
  const foreign = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(origin)) foreign.push(request.url());
  });
  await page.goto("./");
  await expect(page.getByRole("link", { name: "Open Blackboard Text" })).toHaveAttribute("href", "editor.html");
  await expect(page.locator("text=__APP_VERSION__")).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  expect(foreign).toEqual([]);
});

test("an installed window or ?app goes straight to the editor", async ({ page, browser }) => {
  await page.goto("./?app");
  await expect(page).toHaveURL(/\/editor\.html$/);

  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const installed = await context.newPage();
    await installed.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query) =>
        query === "(display-mode: standalone)" ? { matches: true, media: query } : original(query);
    });
    await installed.goto("./");
    await expect(installed).toHaveURL(/\/editor\.html$/);
  } finally {
    await context.close();
  }
});

test("language follows the browser and the toggle is remembered", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: "ru-RU" });
  try {
    const page = await context.newPage();
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("link", { name: "Открыть Blackboard Text" })).toBeVisible();

    await page.getByRole("button", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("link", { name: "Open Blackboard Text" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("install button appears only when the browser offers a prompt", async ({ page }) => {
  await page.goto("./");
  const install = page.locator("#installButton");
  await expect(install).toBeHidden();
  await expect(page.locator("#installHint")).toBeVisible();

  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = () => { window.__prompted = true; return Promise.resolve(); };
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
  await expect(install).toBeVisible();
  await expect(page.locator("#installHint")).toBeHidden();
  await install.click();
  await expect(page.locator("#installDone")).toBeVisible();
  expect(await page.evaluate(() => window.__prompted)).toBe(true);
});
