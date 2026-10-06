import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  openPageActions,
  openSettings,
  openDrawingTools,
} from "./settings-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("editor.html");
  await expect(page.locator("#editor")).toHaveAttribute(
    "contenteditable",
    "true",
  );
});
async function workspace(page) {
  return page.evaluate(
    async () =>
      await (await import("./src/core/workspace-store.js"))
        .createWorkspaceStore()
        .readWorkspace(),
  );
}
async function emit(page, events) {
  await page.evaluate((events) => {
    const canvas = document.querySelector("#drawingLayer");
    canvas.setPointerCapture = () => {};
    canvas.releasePointerCapture = () => {};
    for (const data of events) {
      const event = new PointerEvent(data.type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: "mouse",
        ...data,
      });
      if (data.samples) event.getCoalescedEvents = () => data.samples;
      canvas.dispatchEvent(event);
    }
  }, events);
}
async function brush(page) {
  await openDrawingTools(page);
  await page.locator("#drawToggleBtn").click();
}

test("brush records coalesced input and the release point; a second pointer cannot steal it", async ({
  page,
}) => {
  await brush(page);
  await emit(page, [
    { type: "pointerdown", clientX: 100, clientY: 220 },
    {
      type: "pointermove",
      clientX: 160,
      clientY: 250,
      samples: [
        { clientX: 120, clientY: 230 },
        { clientX: 140, clientY: 235 },
      ],
    },
    {
      type: "pointerdown",
      pointerId: 2,
      pointerType: "touch",
      clientX: 200,
      clientY: 200,
    },
    { type: "pointerup", clientX: 180, clientY: 260 },
  ]);
  await expect
    .poll(async () => (await workspace(page)).pages[0].drawings.length)
    .toBe(1);
  const stroke = (await workspace(page)).pages[0].drawings[0];
  expect(stroke.points).toContainEqual({ x: 120, y: 230 });
  expect(stroke.points.at(-1)).toEqual({ x: 180, y: 260 });
  expect(stroke.renderer).toBe("smooth-v1");
  await page.locator("#drawingToolbarVisibilityToggleBtn").click();
  await expect(page.locator("body")).not.toHaveClass(/drawing-mode/);
});

test("scrolling during a stroke uses current board coordinates", async ({
  page,
}) => {
  await page.locator("#editor").fill(Array(100).fill("Long line").join("\n"));
  await page.evaluate(() => (document.body.scrollTop = 0));
  await brush(page);
  await emit(page, [{ type: "pointerdown", clientX: 100, clientY: 220 }]);
  await page.evaluate(() => (document.body.scrollTop = 400));
  await emit(page, [{ type: "pointerup", clientX: 180, clientY: 260 }]);
  await expect
    .poll(
      async () => (await workspace(page)).pages[0].drawings[0]?.points.at(-1).y,
    )
    .toBe(660);
});

test("long-page strokes survive shortened text and reload without downsampling the whole board", async ({
  page,
}) => {
  await page.locator("#editor").fill(Array(400).fill("Long line").join("\n"));
  await brush(page);
  await page.evaluate(() => (document.body.scrollTop = 3500));
  await emit(page, [
    { type: "pointerdown", clientX: 100, clientY: 300 },
    { type: "pointerup", clientX: 200, clientY: 330 },
  ]);
  await expect
    .poll(async () => (await workspace(page)).pages[0].drawings.length)
    .toBe(1);
  await page.keyboard.press("Escape");
  await page.locator("#editor").fill("One line");
  await expect
    .poll(async () => (await workspace(page)).pages[0].content)
    .toBe("One line");
  await page.reload();
  await expect(page.locator("#editor")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  const geometry = await page.evaluate(() => {
    const b = document.querySelector("#board"),
      c = document.querySelector("#drawingLayer");
    return {
      board: b.offsetHeight,
      height: parseFloat(c.style.height),
      sharpness: c.width / parseFloat(c.style.width),
      dpr: devicePixelRatio,
    };
  });
  expect(geometry.board).toBeGreaterThan(3700);
  expect(geometry.height).toBeLessThanOrEqual(1028);
  expect(geometry.sharpness).toBeCloseTo(geometry.dpr, 1);
});

test("marker, pressure pen and moved stroke keep metadata through undo and a published copy", async ({
  page,
}) => {
  await openDrawingTools(page);
  await page.locator("#markerToggleBtn").click();
  await emit(page, [
    { type: "pointerdown", clientX: 100, clientY: 300 },
    { type: "pointerup", clientX: 200, clientY: 300 },
  ]);
  await expect
    .poll(async () => (await workspace(page)).pages[0].drawings.length)
    .toBe(1);
  // Pressure is an option of the pen: pick the pen, tap it again for its ink.
  await page.locator("#drawToggleBtn").click();
  await page.locator("#drawToggleBtn").click();
  await page.locator("#pressureToggle").check();
  await emit(page, [
    {
      type: "pointerdown",
      pointerType: "pen",
      clientX: 100,
      clientY: 400,
      pressure: 0.2,
    },
    {
      type: "pointerup",
      pointerType: "pen",
      clientX: 200,
      clientY: 430,
      pressure: 0.8,
    },
  ]);
  await expect
    .poll(async () => (await workspace(page)).pages[0].drawings.length)
    .toBe(2);
  await page.locator("#selectToggleBtn").click();
  await emit(page, [
    { type: "pointerdown", clientX: 150, clientY: 300 },
    { type: "pointermove", clientX: 200, clientY: 330 },
    { type: "pointerup", clientX: 200, clientY: 330 },
  ]);
  await expect
    .poll(async () => (await workspace(page)).pages[0].drawings[0].points[0].x)
    .toBe(150);
  await page.locator("#undoDrawingBtn").click();
  await expect
    .poll(async () => (await workspace(page)).pages[0].drawings[0].points[0].x)
    .toBe(100);
  await page.locator("#drawingMoreBtn").click();
  await page.locator("#redoDrawingBtn").click();
  await expect
    .poll(async () => (await workspace(page)).pages[0].drawings[0].points[0].x)
    .toBe(150);
  const strokes = (await workspace(page)).pages[0].drawings;
  expect(strokes[0].tool).toBe("marker");
  expect(strokes[0].opacity).toBe(0.25);
  expect(strokes[1].points[0].pressure).toBeCloseTo(0.2, 6);
  const decoded = await page.evaluate(async () => {
    const store = (
        await import("./src/core/workspace-store.js")
      ).createWorkspaceStore(),
      ws = await store.readWorkspace(),
      p = await import("./src/core/publish.js");
    return (
      await p.decodePublishedNote(
        await p.encodePublishedNote(
          p.createPublishedNote(ws.pages[0], ws.settings),
        ),
      )
    ).note.drawings;
  });
  expect(decoded[0].tool).toBe("marker");
  expect(decoded[1].points.at(-1).pressure).toBeCloseTo(0.8, 6);
});

test("word attachment follows inserted text and can be selected and detached", async ({
  page,
}) => {
  await page.locator("#editor").fill("hello word");
  await brush(page);
  await page.locator("#followTextToggle").check();
  const point = await page.evaluate(() => {
    const e = document.querySelector("#editor"),
      r = document.createRange();
    r.setStart(e.firstChild, 6);
    r.setEnd(e.firstChild, 10);
    const box = r.getBoundingClientRect();
    return { x: box.x + 10, y: box.bottom + 4 };
  });
  await emit(page, [
    { type: "pointerdown", clientX: point.x, clientY: point.y },
    { type: "pointerup", clientX: point.x + 45, clientY: point.y },
  ]);
  await expect
    .poll(
      async () => (await workspace(page)).pages[0].drawings[0]?.anchor?.text,
    )
    .toBe("word");
  await page.locator("#selectToggleBtn").click();
  await emit(page, [
    { type: "pointerdown", clientX: point.x + 15, clientY: point.y },
    { type: "pointerup", clientX: point.x + 15, clientY: point.y },
  ]);
  await expect
    .poll(
      async () => (await workspace(page)).pages[0].drawings[0]?.anchor?.text,
    )
    .toBe("word");
  await page.keyboard.press("Escape");
  await page.locator("#editor").fill("new hello word");
  await expect
    .poll(
      async () => (await workspace(page)).pages[0].drawings[0]?.anchor?.start,
    )
    .toBe(10);
  await page.locator("#editor").fill("new hello tree");
  await expect
    .poll(async () => (await workspace(page)).pages[0].drawings[0]?.anchor)
    .toBeUndefined();
  await page.keyboard.press("ControlOrMeta+z");
  await expect
    .poll(
      async () => (await workspace(page)).pages[0].drawings[0]?.anchor?.text,
    )
    .toBe("word");
});

test("successful autosave after a transient failure clears the status", async ({
  page,
}) => {
  await page.locator("#editor").fill("Initial");
  await expect(page.locator("#saveIndicator")).toHaveAttribute(
    "aria-label",
    "Saved locally.",
  );
  await page.evaluate(() => {
    window.savedPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Transient quota test", "QuotaExceededError");
    };
  });
  await page.locator("#editor").fill("Failed edit");
  await expect(page.locator("#saveIndicator")).toHaveClass(/error/);
  await page.evaluate(() => (IDBObjectStore.prototype.put = window.savedPut));
  await page.locator("#editor").fill("Saved edit");
  await expect(page.locator("#saveIndicator")).not.toHaveClass(/error/);
  await expect(page.locator("#storageStatus")).toHaveText(
    "Saved on this device",
  );
});

test("pinning, match-centred search and durable page history preserve current notes", async ({
  page,
}) => {
  await page.locator("#editor").fill("Earlier note");
  await expect(page.locator("#saveIndicator")).toHaveAttribute(
    "aria-label",
    "Saved locally.",
  );
  await page.reload();
  await expect(page.locator("#editor")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await page
    .locator("#editor")
    .fill("Later note " + "prefix ".repeat(60) + "needle near the end");
  await expect
    .poll(async () => (await workspace(page)).pages[0].content)
    .toContain("needle");
  await openPageActions(page);
  await page.getByRole("button", { name: "Pin page", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unpin page", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("searchbox").fill("needle");
  await expect(page.locator(".workspace-results small")).toContainText(
    "needle",
  );
  await page.keyboard.press("Escape");
  await openPageActions(page);
  await page
    .getByRole("button", { name: "Page history…", exact: true })
    .click();
  await page.locator("#workspaceToolsContent summary").first().click();
  await page
    .getByRole("button", { name: "Recover as new page", exact: true })
    .first()
    .click();
  await expect(page.locator(".page-tab")).toHaveCount(2);
  expect(
    (await workspace(page)).pages.some((p) => p.content.includes("needle")),
  ).toBe(true);
});

test("PNG and PDF exports contain the page and drawings", async ({
  page,
}, testInfo) => {
  await page
    .locator("#editor")
    .fill("Blackboard Text\nРусские заметки\nText and drawing export");
  await brush(page);
  await emit(page, [
    { type: "pointerdown", clientX: 100, clientY: 300 },
    { type: "pointerup", clientX: 320, clientY: 340 },
  ]);
  await expect
    .poll(async () => (await workspace(page)).pages[0].drawings.length)
    .toBe(1);
  await page.keyboard.press("Escape");
  await openPageActions(page);
  const folder = path.resolve("docs/updates/2.4.0/evidence");
  await mkdir(folder, { recursive: true });
  for (const format of ["PNG", "PDF"]) {
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Export " + format + " (text and drawings)",
        exact: true,
      })
      .click();
    const file = await downloaded;
    expect(file.suggestedFilename()).toMatch(
      new RegExp("\\." + format.toLowerCase() + "$"),
    );
    await file.saveAs(
      path.join(
        folder,
        "export-" + testInfo.project.name + "." + format.toLowerCase(),
      ),
    );
  }
});

test("Russian interface never translates note text and switches back cleanly", async ({
  page,
}) => {
  const text = "Settings\nPage actions\nSaved on this device";
  await page.locator("#editor").fill(text);
  const original = await page.locator("#editor").innerHTML();
  await openSettings(page);
  await page.locator("#interfaceLanguage").selectOption("ru");
  await expect(page.locator("#findPagesBtn")).toContainText("Найти страницу");
  expect(await page.locator("#editor").innerHTML()).toBe(original);
  await page.locator("#interfaceLanguage").selectOption("en");
  await expect(page.locator("#findPagesBtn")).toContainText("Find a page");
  expect(await page.locator("#editor").innerHTML()).toBe(original);
});

test("compact tools stay beside page navigation and inside the viewport", async ({
  page,
}) => {
  await page.locator('#editor').fill('Текст остаётся на месте.\nИнструменты рядом со страницами.');
  await mkdir('docs/updates/2.4.1/evidence',{recursive:true});
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await openDrawingTools(page);
    await expect
      .poll(() =>
        page.locator("#drawingToolbar").evaluate((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            r.right <= innerWidth &&
            r.left >= 0
          );
        }),
      )
      .toBe(true);
    const targets = await page
      .locator("#drawingToolbar button")
      .evaluateAll((nodes) =>
        nodes.map((n) => ({
          w: n.getBoundingClientRect().width,
          h: n.getBoundingClientRect().height,
        })),
      );
    const minimum = width <= 768 ? 44 : 34;
    expect(targets.every((r) => r.w >= minimum && r.h >= minimum)).toBe(true);
    expect(await page.locator("#drawingToolbar button").count()).toBe(6);
    const placement = await page.evaluate(() => {
      const tools = document
          .querySelector("#drawingToolbar")
          .getBoundingClientRect(),
        toggle = document
          .querySelector("#drawingToolbarVisibilityToggleBtn")
          .getBoundingClientRect();
      return {
        nearDesktop:
          Math.abs(tools.right - toggle.left) <= 14 &&
          Math.abs(tools.top - toggle.top) <= 4,
        nearMobile:
          tools.bottom <= toggle.top && toggle.top - tools.bottom <= 24,
      };
    });
    expect(width > 768 ? placement.nearDesktop : placement.nearMobile).toBe(
      true,
    );
    if([1440,390,320].includes(width))await page.screenshot({path:'docs/updates/2.4.1/evidence/tools-'+width+'.png'});
    if (width <= 768) {
      await expect(page.locator('#wordCount')).toHaveCSS('opacity','0');
      await expect(page.locator("#mobilePagesBtn")).toBeVisible();
      expect(
        await page.locator("#editor").evaluate((el) => el.clientWidth),
      ).toBe(width);
    }
    await page.locator("#drawingToolbarVisibilityToggleBtn").click();
  }
});

test("one whole-stroke eraser gesture undoes as one action", async ({
  page,
}) => {
  await brush(page);
  for (const y of [260, 330])
    await emit(page, [
      { type: "pointerdown", clientX: 100, clientY: y },
      { type: "pointerup", clientX: 220, clientY: y },
    ]);
  await expect
    .poll(async () => (await workspace(page)).pages[0].drawings.length)
    .toBe(2);
  await page.locator("#eraseToggleBtn").click();
  await page.locator("#eraseToggleBtn").click();
  await page.locator("#eraseWholeToggle").check();
  await emit(page, [
    { type: "pointerdown", clientX: 150, clientY: 260 },
    { type: "pointermove", clientX: 150, clientY: 330 },
    { type: "pointerup", clientX: 150, clientY: 330 },
  ]);
  await expect
    .poll(async () => (await workspace(page)).pages[0].drawings.length)
    .toBe(0);
  await page.locator("#undoDrawingBtn").click();
  await expect
    .poll(async () => (await workspace(page)).pages[0].drawings.length)
    .toBe(2);
});

test("painting tools retain separate sizes after reload", async ({ page }) => {
  await brush(page);
  await page.locator("#drawSize").evaluate((el) => {
    el.value = "0.3";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#markerToggleBtn").click();
  await page.locator("#drawSize").evaluate((el) => {
    el.value = "0.9";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#followTextToggle").check();
  await expect
    .poll(async () => (await workspace(page)).settings.drawTools?.marker?.size)
    .toBe(0.9);
  await page.reload();
  await expect(page.locator("#editor")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await openDrawingTools(page);
  await expect(page.locator("#followTextToggle")).toBeChecked();
  await page.locator("#drawToggleBtn").click();
  await expect(page.locator("#drawSize")).toHaveValue("0.3");
  await page.locator("#markerToggleBtn").click();
  await expect(page.locator("#drawSize")).toHaveValue("0.9");
});

test("opening controls does not claim an unsaved note is saved", async ({
  page,
}) => {
  await page.locator("#editor").fill("Not durable yet");
  await page.locator("#drawingToolbarVisibilityToggleBtn").click();
  await expect(page.locator("#storageStatus")).toHaveText("Saving…");
  await expect
    .poll(async () => (await workspace(page)).pages[0].content)
    .toBe("Not durable yet");
  await expect(page.locator("#storageStatus")).toHaveText(
    "Saved on this device",
  );
});

test("eraser export preserves the exact text layer", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { preparePageExport } = await import("./src/ui/page-export.js"),
      { DEFAULT_WORKSPACE_SETTINGS } = await import("./src/core/schema.js");
    const stroke = {
      id: "ink",
      tool: "brush",
      color: "#FF0000",
      width: 0.2,
      referenceFontSize: 40,
      points: [
        { x: 48, y: 80 },
        { x: 320, y: 80 },
      ],
    };
    const baseline = await preparePageExport(
      { content: "Text stays here", drawings: [] },
      DEFAULT_WORKSPACE_SETTINGS,
      { boardWidth: 500 },
    );
    const drawing = await preparePageExport(
      {
        content: "Text stays here",
        drawings: [
          stroke,
          { ...stroke, id: "erase", tool: "eraser", width: 0.8 },
        ],
      },
      DEFAULT_WORKSPACE_SETTINGS,
      { boardWidth: 500 },
    );
    try {
      const a = await baseline.tile(0, baseline.height),
        b = await drawing.tile(0, drawing.height),
        before = a.getContext("2d").getImageData(0, 0, a.width, a.height).data,
        after = b.getContext("2d").getImageData(0, 0, b.width, b.height).data;
      return {
        same: before.every((value, index) => value === after[index]),
        opaque: after
          .filter((_, index) => index % 4 === 3)
          .every((value) => value === 255),
      };
    } finally {
      baseline.release();
      drawing.release();
    }
  });
  expect(result).toEqual({ same: true, opaque: true });
});

test("Russian reader preserves author titles and drawing descriptions", async ({
  page,
}) => {
  const url = await page.evaluate(async () => {
    localStorage.setItem("blackboard-text:language", "ru");
    const p = await import("./src/core/publish.js");
    return p.buildPublishedNoteUrl(
      location.href,
      await p.encodePublishedNote(
        p.createPublishedNote(
          {
            id: "sample",
            title: "Settings",
            content: "Page actions",
            drawingDescription: "Settings",
          },
          {},
        ),
      ),
    );
  });
  await page.goto(url);
  await expect(page.locator("#readerBoardMode")).toHaveText(
    "Исходная страница",
  );
  await expect(page.locator("#readerTitle")).toHaveText("Settings");
  await expect(page.locator("#readerContent")).toHaveText("Page actions");
  await expect(page.locator("#readerDrawings")).toHaveAttribute(
    "aria-label",
    "Settings",
  );
  await page.locator("#readerDrawingDescription summary").click();
  await expect(page.locator("#readerDrawingDescriptionText")).toHaveText(
    "Settings",
  );
});

test("export keeps the same text wrapping as the chosen writing width", async ({
  page,
}) => {
  const measurement = await page.evaluate(async () => {
    const { preparePageExport } = await import("./src/ui/page-export.js"),
      { DEFAULT_WORKSPACE_SETTINGS } = await import("./src/core/schema.js");
    const exportNote = await preparePageExport(
      { content: "A longer paragraph ".repeat(25), drawings: [] },
      { ...DEFAULT_WORKSPACE_SETTINGS, maxWidth: 400 },
      { boardWidth: 1200 },
    );
    try {
      return {
        boardWidth: exportNote.width,
        textWidth: document
          .querySelector(".export-note-content")
          .getBoundingClientRect().width,
        height: exportNote.height,
      };
    } finally {
      exportNote.release();
    }
  });
  expect(measurement.boardWidth).toBe(1200);
  expect(measurement.textWidth).toBe(400);
  expect(measurement.height).toBeGreaterThan(400);
});

test("opening tools and their settings never reflows text, drawings or scroll", async ({
  page,
}) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page
      .locator("#editor")
      .fill(
        Array(90)
          .fill("Текст остаётся на месте. A stable writing layout.")
          .join("\n"),
      );
    await page.evaluate(async () => {
      const { createWorkspaceStore } =
          await import("./src/core/workspace-store.js"),
        store = createWorkspaceStore(),
        ws = await store.readWorkspace();
      ws.pages[0].content = document.querySelector("#editor").innerHTML;
      ws.pages[0].drawings = [
        {
          id: "geometry-test",
          tool: "brush",
          color: "#DDDAD2",
          width: 0.2,
          referenceFontSize: 40,
          points: [
            { x: 48, y: 480 },
            { x: 140, y: 500 },
          ],
        },
      ];
      await store.saveWorkspace(ws);
    });
    await page.reload();
    await expect(page.locator("#editor")).toHaveAttribute(
      "contenteditable",
      "true",
    );
    for (const scroll of [0, 500]) {
      await page.locator('#editor').press('Escape');
      await page.evaluate(async (scroll) => {
        document.body.scrollTop = scroll;
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      }, scroll);
      const measure = () =>
        page.evaluate(async () => {
          const e = document.querySelector("#editor"),
            r = document.createRange();
          r.selectNodeContents(e);
          const rects = [...r.getClientRects()]
            .slice(0, 3)
            .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
          const b = document.querySelector("#board"),
            { strokePoints } = await import("./src/core/drawing-renderer.js"),
            { createWorkspaceStore } =
              await import("./src/core/workspace-store.js"),
            ws = await createWorkspaceStore().readWorkspace(),
            style = getComputedStyle(e);
          return {
            scroll: document.body.scrollTop,
            padding: style.padding,
            textWidth: e.clientWidth,
            rects,
            boardHeight: b.offsetHeight,
            stroke: strokePoints(ws.pages[0].drawings[0], {
              fontSize: 40,
              lineHeight: 1.6,
              paddingX: parseFloat(style.paddingLeft),
              paddingY: parseFloat(style.paddingTop),
            }),
          };
        });
      const before = await measure();
      await page.locator("#drawingToolbarVisibilityToggleBtn").click();
      await expect(page.locator("#drawingToolbar")).toBeVisible();
      expect(await measure()).toEqual(before);
      await page.locator("#drawingMoreBtn").click();
      await expect(page.locator("#drawingAdvancedPanel")).toBeVisible();
      expect(await measure()).toEqual(before);
      const menu = await page.locator("#drawingAdvancedPanel").boundingBox();
      expect(menu.height).toBeLessThan(320);
      expect(menu.width).toBeLessThanOrEqual(224);
      await page.locator("#drawingToolbarVisibilityToggleBtn").click();
      await expect(page.locator("#drawingToolbar")).toBeHidden();
      expect(await measure()).toEqual(before);
    }
  }
});
