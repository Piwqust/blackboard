import { test, expect } from "@playwright/test";
import { openPageActions } from "./settings-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("editor.html");
  await expect(page.locator("#editor")).toHaveAttribute("contenteditable", "true");
});

async function workspace(page) {
  return page.evaluate(
    async () =>
      await (await import("./src/core/workspace-store.js"))
        .createWorkspaceStore()
        .readWorkspace(),
  );
}

test("Name, emoji and delete stays open after the click that opened it", async ({ page }) => {
  await openPageActions(page);
  await page.getByRole("button", { name: "Name, emoji and delete…", exact: true }).click();
  await expect(page.locator("#emojiPicker")).toHaveClass(/visible/);
  await page.waitForTimeout(300);
  await expect(page.locator("#emojiPicker")).toHaveClass(/visible/);
  await page.locator("#pageTitleInput").fill("Renamed from actions");
  await page.locator("#emojiPickerClose").click();
  await expect.poll(async () => (await workspace(page)).pages[0].title).toBe("Renamed from actions");
});

test("on a phone the page panel rises from the bottom edge", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPageActions(page);
  await page.getByRole("button", { name: "Name, emoji and delete…", exact: true }).click();
  const picker = page.locator("#emojiPicker");
  await expect(picker).toHaveClass(/visible/);
  await expect(picker).toHaveAttribute("data-placement", "sheet");
  const box = await picker.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
});

test("Tab on a multi-line selection indents each line and keeps formatting", async ({ page }) => {
  await page.locator("#editor").evaluate((editor) => {
    editor.innerHTML = "one<div><b>two</b></div><div>three</div>";
  });
  await page.locator("#editor").focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Tab");
  const html = await page.locator("#editor").innerHTML();
  expect(html).toBe("\tone<div><b>\ttwo</b></div><div>\tthree</div>");
  await page.keyboard.press("Shift+Tab");
  expect(await page.locator("#editor").innerHTML()).toBe("one<div><b>two</b></div><div>three</div>");
});

test("exported and searched text keeps the first line separate", async ({ page }) => {
  const text = await page.evaluate(async () => {
    const { pageText, pageFileName } = await import("./src/core/page-tools.js");
    return {
      plain: pageText("Grocery list<div>Buy milk</div><div><br></div><div>Bread</div>"),
      name: pageFileName({ title: "", content: "Grocery list<div>Buy milk</div>" }),
    };
  });
  expect(text.plain).toBe("Grocery list\nBuy milk\n\nBread");
  expect(text.name).toBe("Grocery list");
});

test("an import survives a tab switch while it is being written", async ({ page }) => {
  await page.locator("#editor").fill("Old workspace");
  await expect.poll(async () => (await workspace(page)).pages[0].content).toContain("Old workspace");
  const payload = {
    format: "BlackboardTextWorkspace",
    schemaVersion: 1,
    workspace: {
      currentPageId: "imported-a",
      pages: [
        { id: "imported-a", content: "Imported A" },
        { id: "imported-b", content: "Imported B" },
      ],
      settings: {},
    },
  };
  await page.locator("#importWorkspaceInput").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  // Hide the tab the moment the import starts writing, before the editor
  // has switched to the imported pages.
  await page.evaluate(() => {
    document.getElementById("confirmImportBtn").click();
    window.dispatchEvent(new Event("pagehide"));
  });
  await expect(page.locator("#editor")).toHaveText("Imported A");
  await page.reload();
  await expect(page.locator("#editor")).toHaveAttribute("contenteditable", "true");
  const saved = await workspace(page);
  expect(saved.pages.map((p) => p.id)).toEqual(["imported-a", "imported-b"]);
});

test("pinned pages stay first when a new page is moved", async ({ page }) => {
  await page.locator("#editor").fill("First page");
  await openPageActions(page);
  await page.getByRole("button", { name: "Pin page", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator("#addPageBtn").click();
  await page.locator("#addPageBtn").click();
  const pinnedId = (await workspace(page)).pages[0].id;
  await page.locator(".page-tab").last().focus();
  await page.keyboard.press("Alt+ArrowUp");
  await page.keyboard.press("Alt+ArrowUp");
  await expect(page.locator(".page-tab").first()).toHaveAttribute("data-page-id", pinnedId);
  await expect.poll(async () => (await workspace(page)).pages[0].id).toBe(pinnedId);
});

test("dropping rich content inserts plain text only", async ({ page }) => {
  await page.locator("#editor").evaluate((editor) => {
    const data = new DataTransfer();
    data.setData("text/html", '<img src="https://example.com/x.png"><table><tr><td>Huge</td><td>red</td></tr></table>');
    data.setData("text/plain", "Huge red");
    const rect = editor.getBoundingClientRect();
    editor.dispatchEvent(new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer: data,
      clientX: rect.left + 60,
      clientY: rect.top + 60,
    }));
  });
  await expect(page.locator("#editor")).toHaveText("Huge red");
  expect(await page.locator("#editor img, #editor table").count()).toBe(0);
});

test("Find a page opens the first match with Enter", async ({ page }) => {
  await page.locator("#editor").fill("Alpha page");
  await page.locator("#addPageBtn").click();
  await page.locator("#editor").fill("Bravo page");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("searchbox").fill("alpha");
  await expect(page.locator("#workspaceToolsStatus")).toHaveText("1 page");
  await page.keyboard.press("Enter");
  await expect(page.locator("#editor")).toHaveText("Alpha page");
});

test("Russian interface uses plural forms and keeps data buttons inside Settings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => localStorage.setItem("blackboard-text:language", "ru"));
  await page.reload();
  await expect(page.locator("#editor")).toHaveAttribute("contenteditable", "true");
  await page.locator("#editor").fill("Два слова");
  await expect(page.locator("#wordCount")).toContainText("2 слова");
  await page.locator("#settingsToggleBtn").click();
  const panel = await page.locator(".controls-panel").boundingBox();
  for (const id of ["#exportWorkspaceBtn", "#importWorkspaceBtn"]) {
    await page.locator(id).scrollIntoViewIfNeeded();
    const button = page.locator(id);
    const box = await button.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(panel.x);
    expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width + 0.5);
    expect(await button.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
});

test("the page security policy blocks nothing the app itself uses", async ({ page }) => {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      window.__cspViolations.push(event.violatedDirective + " " + event.blockedURI),
    );
  });
  await page.reload();
  await expect(page.locator("#editor")).toHaveAttribute("contenteditable", "true");
  await page.locator("#editor").fill("Policy check");
  await openPageActions(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG (text and drawings)", exact: true }).click();
  await download;
  await page.getByRole("button", { name: "Share a copy…", exact: true }).click();
  await page.locator("#shareModeFull").check();
  const preview = page.locator("#previewPublishLink");
  await preview.waitFor();
  const href = new URL(await preview.getAttribute("href"), page.url()).href;
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  await page.goto(href);
  await expect(page.locator("#readerContent")).toHaveText("Policy check");
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
});
