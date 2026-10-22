// Refreshes the README screenshots from the built PWA.
//
//   npm run build && node scripts/readme-screenshots.mjs
//
// Serves the repository with scripts/serve-test.mjs on 127.0.0.1:4190 (or
// TEST_PORT). A server already listening there is reused, so make sure it
// serves this checkout. Opens dist/pwa in Playwright's Chromium, seeds a
// sample workspace through the app's own backup import, draws a few strokes
// with pointer input in drawing mode and writes:
//
//   screenshots/hero-desktop.png  1440×900, default Blackboard theme
//   screenshots/hero-phone.png    390×844 at 2× device scale
//   screenshots/reader.png        the read-only reader for a full link
//
// Every run uses fresh, throwaway browser contexts and the sample text below;
// no real browser profile is read or written. Run `npx playwright install
// chromium` once if Chromium is missing.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = `http://127.0.0.1:${Number(process.env.TEST_PORT || 4190)}`;
const appUrl = `${origin}/dist/pwa/editor.html`;
const outDir = path.join(root, 'screenshots');

const lines = text => text.split('\n').map(line => (line ? `<div>${line}</div>` : '<div><br></div>')).join('');
const at = iso => new Date(iso).getTime();

// A sample workspace in the same format as an exported .blackboard.json.
// Anything not set in `settings` uses the app's defaults: the dark Blackboard
// palette and Inter Tight.
const sampleWorkspace = (settings = {}) => ({
  format: 'BlackboardTextWorkspace',
  schemaVersion: 1,
  exportedAt: '2026-10-20T08:00:00.000Z',
  appVersion: 'readme-screenshots',
  workspace: {
    settings,
    currentPageId: 'sample-morning',
    pages: [
      {
        id: 'sample-morning',
        emoji: '🌙',
        title: 'Slow mornings',
        createdAt: at('2026-10-14T07:12:00Z'),
        updatedAt: at('2026-10-20T07:48:00Z'),
        content: lines([
          'Thursday, before coffee',
          '',
          'Ideas arrive half-formed. Give them somewhere quiet to land before they leave again.',
          '',
          'Today: finish the reading list, reply to Mira about the cabin weekend, and write down the bread recipe that finally worked.',
          '',
          'A page does not have to be finished to be useful. Most of the good ones never are.'
        ].join('\n')),
        drawings: []
      },
      {
        id: 'sample-reading',
        emoji: '📚',
        title: 'Reading list',
        createdAt: at('2026-10-02T19:30:00Z'),
        updatedAt: at('2026-10-18T21:05:00Z'),
        content: lines('A Pattern Language, a chapter a night\nThe Overstory, halfway\nNotes on walking, borrowed from the library'),
        drawings: []
      },
      {
        id: 'sample-bread',
        emoji: '☕',
        title: 'Bread that worked',
        createdAt: at('2026-10-11T09:00:00Z'),
        updatedAt: at('2026-10-19T09:40:00Z'),
        content: lines('500 g flour, 350 g water, 10 g salt, 2 g yeast.\nMix, rest 30 minutes, fold four times.\nOvernight in the fridge, then 40 minutes at 240 °C.'),
        drawings: []
      },
      {
        id: 'sample-ideas',
        emoji: '💡',
        title: 'Someday',
        createdAt: at('2026-09-28T16:20:00Z'),
        updatedAt: at('2026-10-16T18:10:00Z'),
        content: lines('A walking map of every bakery in the neighbourhood.\nLetters to future me, opened once a year.'),
        drawings: []
      }
    ]
  }
});

// node:http rather than fetch(): 4190 is on the Fetch standard's blocked-port
// list, so Node's fetch refuses to connect to it.
function isServing() {
  return new Promise(resolve => {
    const request = http.request(appUrl, { method: 'HEAD', timeout: 1000 }, response => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on('error', () => resolve(false));
    request.on('timeout', () => request.destroy());
    request.end();
  });
}

async function startServer() {
  if (await isServing()) return null;
  const server = spawn(process.execPath, ['scripts/serve-test.mjs'], { cwd: root, stdio: 'ignore' });
  const deadline = Date.now() + 10000;
  while (!(await isServing())) {
    if (server.exitCode !== null || Date.now() > deadline) {
      server.kill();
      throw new Error(`Could not start scripts/serve-test.mjs on ${origin}.`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return server;
}

async function openSeededEditor(context, settings) {
  const page = await context.newPage();
  page.on('pageerror', error => console.warn(`  page error: ${error.message}`));
  await page.goto(appUrl);
  await page.locator('#editor[contenteditable="true"]').waitFor();
  await page.locator('#importWorkspaceInput').setInputFiles({
    name: 'sample.blackboard.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(sampleWorkspace(settings)))
  });
  await page.locator('#confirmImportBtn').click();
  await page.locator('#editor', { hasText: 'Ideas arrive half-formed' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}

// Box of a phrase in the note, in viewport coordinates, or null when the
// phrase wraps onto a second line.
async function phraseBox(page, phrase) {
  return page.evaluate(phrase => {
    const walker = document.createTreeWalker(document.querySelector('#editor'), NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const index = node.data.indexOf(phrase);
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + phrase.length);
      const rects = range.getClientRects();
      if (rects.length !== 1) return null;
      const { left, top, width, height } = rects[0];
      return { x: left, y: top, width, height };
    }
    throw new Error(`Sample phrase not found: ${phrase}`);
  }, phrase);
}

// Deterministic, slightly uneven paths so strokes look hand-drawn but every
// run produces the same picture.
const wobble = (i, amount) => Math.sin(i * 1.7) * amount + Math.sin(i * 0.45) * amount * 0.6;

function highlightPath(box) {
  const y = box.y + box.height * 0.58;
  return Array.from({ length: 28 }, (_, i) => ({
    x: box.x - 6 + ((box.width + 12) * i) / 27,
    y: y + wobble(i, 1.2)
  }));
}

function underlinePath(box) {
  const y = box.y + box.height + 4;
  return Array.from({ length: 32 }, (_, i) => ({
    x: box.x + (box.width * i) / 31,
    y: y + Math.sin(i * 0.9) * 3 + i * 0.08
  }));
}

function loopPath(box) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rx = box.width / 2 + 10;
  const ry = box.height / 2 + 10;
  return Array.from({ length: 56 }, (_, i) => {
    const t = Math.PI * (0.92 + (2.2 * i) / 55);
    return {
      x: cx + Math.cos(t) * rx * (1 + wobble(i, 0.015)),
      y: cy + Math.sin(t) * ry * (1 + wobble(i, 0.03)) - i * 0.15
    };
  });
}

async function drawStroke(page, points) {
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 2 });
  await page.mouse.up();
}

// Picks a tool, then optionally a chalk colour and one of the six sizes from
// its ink panel. Tapping the active tool opens the panel; tapping it again
// closes it.
async function useTool(page, { tool: selector, color, size }) {
  const tool = page.locator(selector);
  if ((await tool.getAttribute('aria-pressed')) !== 'true') await tool.click();
  if (!color && size === undefined) return;
  await tool.click();
  if (size !== undefined) await page.locator('#drawSizeMarkers button').nth(size).click();
  if (color) await page.locator(`#drawInkColors [aria-label="Use drawing colour ${color}"]`).click();
  await tool.click();
  await page.locator('#drawInkPanel').waitFor({ state: 'hidden' });
}

// Each annotation uses the first of its phrases that sits on one line inside
// the visible writing area, and is skipped when none does.
const ANNOTATIONS = [
  { phrases: ['somewhere quiet to land', 'somewhere quiet'], tool: '#markerToggleBtn', color: '#F5A524', path: highlightPath },
  { phrases: ['bread recipe', 'reading list'], tool: '#drawToggleBtn', size: 1, path: loopPath },
  { phrases: ['never are', 'half-formed', 'quiet to land'], tool: '#drawToggleBtn', color: '#E5484D', path: underlinePath }
];

async function strokeCount(page) {
  return page.evaluate(async () => {
    const store = (await import('./src/core/workspace-store.js')).createWorkspaceStore();
    const workspace = await store.readWorkspace();
    return workspace.pages.find(page => page.id === workspace.currentPageId).drawings.length;
  });
}

async function annotate(page) {
  const toggle = page.locator('#drawingToolbarVisibilityToggleBtn');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await page.locator('#drawingToolbar').waitFor();

  // Keep strokes clear of the toolbar when it sits below the note (phones).
  const viewport = page.viewportSize();
  const bar = await page.locator('#drawingToolbar').boundingBox();
  const bottom = (bar.y > viewport.height / 2 ? bar.y : viewport.height) - 40;

  let drawn = 0;
  for (const { phrases, path: makePath, ...tool } of ANNOTATIONS) {
    for (const phrase of phrases) {
      const box = await phraseBox(page, phrase);
      if (!box || box.y < 24 || box.y + box.height > bottom) continue;
      await useTool(page, tool);
      await drawStroke(page, makePath(box));
      drawn += 1;
      break;
    }
  }
  if (drawn < 2) throw new Error('Too few sample phrases are visible to draw on; adjust ANNOTATIONS.');

  // Wait until the strokes are saved and the import notice has gone, then
  // hide the brush preview circle.
  for (let tries = 0; (await strokeCount(page)) < drawn; tries += 1) {
    if (tries > 50) throw new Error('The sample strokes were not saved.');
    await page.waitForTimeout(100);
  }
  await page.locator('#appStatus').waitFor({ state: 'hidden', timeout: 10000 });
  await page.locator('#drawingLayer').dispatchEvent('pointerleave');
  await page.evaluate(() => {
    document.activeElement?.blur();
    document.body.scrollTop = 0;
  });
}

async function capture(page, file) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, file), animations: 'disabled' });
  console.log(`  screenshots/${file}`);
}

async function fullLinkFor(page) {
  await page.locator('#settingsToggleBtn').click();
  await page.locator('#pageActionsBtn').click();
  await page.getByRole('button', { name: 'Share a copy…', exact: true }).click();
  await page.locator('#shareModeFull').check();
  const preview = page.locator('#previewPublishLink');
  await preview.waitFor();
  const href = await preview.getAttribute('href');
  await page.locator('#closePublishBtn').click();
  return new URL(href, page.url()).href;
}

try {
  await access(path.join(root, 'dist/pwa/editor.html'));
} catch {
  console.error('dist/pwa is missing. Run `npm run build` first.');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
const server = await startServer();
const browser = await chromium.launch();
const contextOptions = { serviceWorkers: 'block', locale: 'en-US', colorScheme: 'dark' };

try {
  console.log('Writing README screenshots:');

  const desktop = await browser.newContext({ ...contextOptions, viewport: { width: 1440, height: 900 } });
  const editor = await openSeededEditor(desktop);
  await annotate(editor);
  await capture(editor, 'hero-desktop.png');

  const reader = await desktop.newPage();
  await reader.goto(await fullLinkFor(editor));
  await reader.locator('#readerContent', { hasText: 'Ideas arrive half-formed' }).waitFor();
  await reader.evaluate(() => document.fonts.ready);
  await capture(reader, 'reader.png');
  await desktop.close();

  const phone = await browser.newContext({
    ...contextOptions,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  // The 40 px default fits about three words per line on a phone, so the phone
  // shot uses a smaller text size, as someone writing on a phone would.
  const phoneEditor = await openSeededEditor(phone, { fontSize: 26 });
  await annotate(phoneEditor);
  // On phones the open toolbar covers the last lines of the note; fold it away.
  await phoneEditor.locator('#drawingToolbarVisibilityToggleBtn').click();
  await phoneEditor.locator('#drawingToolbar').waitFor({ state: 'hidden' });
  await capture(phoneEditor, 'hero-phone.png');
  await phone.close();
} finally {
  await browser.close();
  server?.kill();
}
