import {openPageActions} from './settings-helpers.js';
import {test,expect} from '@playwright/test';

// Run against a real workerd/D1 dev server; normal regression runs need no backend.
test.skip(!process.env.SHORT_LINKS_TEST_API, 'Set SHORT_LINKS_TEST_API to a local Wrangler server.');
const endpoint=process.env.SHORT_LINKS_TEST_API;

test('create, open under a Pages subpath, keep immutable copy and disable',async({page,context})=>{
  await context.route('**/src/config.js',route=>route.fulfill({contentType:'text/javascript',body:'export const SHORT_LINKS_API = '+JSON.stringify(endpoint)+';'}));
  // Local emulator only: separate rate-limit actors for the two build targets.
  await context.setExtraHTTPHeaders({'CF-Connecting-IP': '192.0.2.'+Math.ceil(Math.random()*200)});
  await page.goto('editor.html');
  await expect(page.locator('#editor')).toHaveAttribute('contenteditable','true');
  await page.locator('#editor').fill('Original shared copy');
  const puts=[];page.on('request',req=>{if(req.url().startsWith(endpoint)&&req.method()==='PUT')puts.push(req)});
  await openPageActions(page);
  await page.getByRole('button',{name:'Share a copy…',exact:true}).click();
  expect(puts).toHaveLength(0);
  await page.locator('#createShortLinkBtn').click();
  await expect(page.locator('#shortLinkResult')).toBeVisible();
  expect(puts).toHaveLength(1);
  const url=await page.locator('#shortLinkResult').inputValue();
  expect(url.length).toBeLessThan(100);
  expect(new URL(url).pathname).toMatch(/\/dist\/(pwa|edge-extension)\/s\/$/);
  await page.locator('#closePublishBtn').click();
  await page.locator('#editor').fill('Edited private version');
  const reader=await context.newPage();await reader.goto(url);
  await expect(reader.locator('#readerContent')).toHaveText('Original shared copy');
  await openPageActions(page);await page.getByRole('button',{name:'Share a copy…',exact:true}).click();
  await page.locator('#sharedLinksDetails summary').click();
  await page.getByRole('button',{name:'Disable link',exact:true}).click();
  await page.getByRole('button',{name:'Confirm disable',exact:true}).click();
  await expect(page.locator('.shared-link-row small')).toContainText('Disabled');
  await reader.reload();
  await expect(reader.locator('#readerStateText')).toContainText('unavailable');
  await expect(page.locator('#editor')).toHaveText('Edited private version');
});

test('lost response retries the same link, without uploading a second copy',async({page,context})=>{
  await context.route('**/src/config.js',route=>route.fulfill({contentType:'text/javascript',body:'export const SHORT_LINKS_API = '+JSON.stringify(endpoint)+';'}));
  await context.setExtraHTTPHeaders({'CF-Connecting-IP':'198.51.100.'+Math.ceil(Math.random()*200)});
  let interrupted=false;const ids=[];
  await page.route(endpoint+'/v1/notes/*',async route=>{
    if(route.request().method()==='PUT') {
      ids.push(route.request().url());
      if(!interrupted) {interrupted=true;await route.fetch();await route.abort();return;}
    }
    await route.continue();
  });
  await page.goto('editor.html');await expect(page.locator('#editor')).toHaveAttribute('contenteditable','true');
  await page.locator('#editor').fill('Network interruption copy');
  await openPageActions(page);await page.getByRole('button',{name:'Share a copy…',exact:true}).click();
  await page.locator('#createShortLinkBtn').click();
  await expect(page.locator('#shortLinkStatus')).toContainText('Cannot reach');
  await page.locator('#sharedLinksDetails summary').click();
  await page.getByRole('button',{name:'Retry same link',exact:true}).click();
  await expect(page.locator('#shortLinkResult')).toBeVisible();
  expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);
  await page.getByRole('button',{name:'Disable link',exact:true}).click();await page.getByRole('button',{name:'Confirm disable',exact:true}).click();
  await expect(page.locator('.shared-link-row small')).toContainText('Disabled');
});
