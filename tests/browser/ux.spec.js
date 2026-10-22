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

test("first-run tips show on an empty workspace and leave for good once you type", async ({ page }) => {
  await expect(page.locator("#firstRunHint")).toBeVisible();
  await page.locator("#editor").fill("Hello");
  await expect(page.locator("#firstRunHint")).toBeHidden();
  await page.locator("#editor").fill("");
  await page.reload();
  await expect(page.locator("#editor")).toHaveAttribute("contenteditable", "true");
  await expect(page.locator("#firstRunHint")).toBeHidden();
});

test("a deleted page comes back with Undo", async ({ page }) => {
  await page.locator("#editor").fill("Keep me");
  await page.locator("#addPageBtn").click();
  await page.locator("#editor").fill("Second");
  await page.locator(".page-tab").first().click();
  await expect(page.locator("#editor")).toHaveText("Keep me");
  await page.locator(".page-tab").first().click();
  await page.locator("#emojiPickerDelete").click();
  await page.locator("#confirmDeletePageBtn").click();
  await expect(page.locator(".page-tab")).toHaveCount(1);
  await page.locator(".app-status-action").click();
  await expect(page.locator(".page-tab")).toHaveCount(2);
  await expect(page.locator("#editor")).toHaveText("Keep me");
  await expect.poll(async () => (await workspace(page)).pages.map((p) => p.content).join("|")).toContain("Keep me");
});

test("desktop Settings leaves the page rail uncovered", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (let i = 0; i < 6; i++) await page.locator("#addPageBtn").click();
  await page.locator("#settingsToggleBtn").click();
  await expect(page.locator(".controls-container")).toHaveClass(/open/);
  const panel = await page.locator(".controls-panel").boundingBox();
  const add = await page.locator("#addPageBtn").boundingBox();
  expect(panel.x + panel.width).toBeLessThanOrEqual(add.x);
  await page.locator("#addPageBtn").click({ trial: true });
});

test("the phone page button shows the current page and opens the page list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const emoji = await page.locator(".page-tab.active .page-tab-emoji").textContent();
  await expect(page.locator("#mobilePagesBtn .mobile-pages-emoji")).toHaveText(emoji);
  await page.locator("#mobilePagesBtn").click();
  await expect(page.getByRole("searchbox")).toBeVisible();
});

test("drawing tools open from a pen button", async ({ page }) => {
  const toggle = page.locator("#drawingToolbarVisibilityToggleBtn");
  await expect(toggle.locator(".rail-collapse-pen")).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#drawingToolbar")).toBeVisible();
});

test("page actions are grouped and ? opens keyboard help", async ({ page }) => {
  await openPageActions(page);
  await expect(page.locator(".workspace-group-label")).toHaveText(["This page", "Export", "History", "Help"]);
  await expect(page.getByRole("button", { name: "Redo drawing", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator("#settingsToggleBtn").focus();
  await page.keyboard.press("?");
  await expect(page.locator("#workspaceToolsTitle")).toHaveText("Keyboard help");
});

test("an earlier version of a deleted page can be recovered", async ({ page }) => {
  await page.locator("#editor").fill("Doomed draft");
  await page.locator("#addPageBtn").click();
  await page.locator("#editor").fill("Survivor");
  // Seed a stored version for the first page, as autosave would after 30 s.
  const doomedId = (await workspace(page)).pages[0].id;
  await page.evaluate(async (pageId) => {
    const request = indexedDB.open("blackboard-text");
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction("revisions", "readwrite");
    tx.objectStore("revisions").put({ id: "seeded-revision", pageId, createdAt: new Date().toISOString(), bytes: 40, page: { id: pageId, title: "", emoji: "📝", content: "Doomed draft", drawings: [] } });
    await new Promise((resolve) => { tx.oncomplete = resolve; });
    db.close();
  }, doomedId);
  await page.locator(".page-tab").first().click();
  await page.locator(".page-tab").first().click();
  await page.locator("#emojiPickerDelete").click();
  await page.locator("#confirmDeletePageBtn").click();
  await expect(page.locator(".page-tab")).toHaveCount(1);
  await openPageActions(page);
  await page.getByRole("button", { name: "Recovery history…", exact: true }).click();
  await expect(page.locator(".workspace-group-label")).toHaveText("Deleted pages");
  await page.locator(".recovery-page-name").first().click();
  await page.getByRole("button", { name: "Recover as new page", exact: true }).last().click();
  await expect(page.locator(".page-tab")).toHaveCount(2);
  await expect(page.locator("#editor")).toHaveText("Doomed draft");
});

test("anchored strokes resolve the same boxes with the shared text index", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { anchorBox, createTextIndex } = await import("./src/ui/text-anchors.js");
    const editor = document.getElementById("editor");
    editor.innerHTML = Array.from({ length: 40 }, (_, i) => `<div>line ${i} with <b>bold</b> and some words</div>`).join("");
    const board = document.getElementById("board") || editor.parentElement;
    const text = editor.textContent;
    const frame = { index: createTextIndex(editor), origin: board.getBoundingClientRect() };
    const mismatches = [];
    for (const word of ["line 0", "bold", "words", "line 39", "some"]) {
      let from = 0;
      for (;;) {
        const start = text.indexOf(word, from);
        if (start < 0) break;
        const anchor = { start, end: start + word.length, text: word };
        const a = JSON.stringify(anchorBox(editor, board, anchor));
        const b = JSON.stringify(anchorBox(editor, board, anchor, frame));
        if (a !== b) mismatches.push(word + "@" + start);
        from = start + 1;
      }
    }
    return mismatches;
  });
  expect(result).toEqual([]);
});
