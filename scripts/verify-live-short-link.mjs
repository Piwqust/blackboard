// Uses a disposable browser and one synthetic note on the deployed service.
// The created link is disabled before the script exits.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const app='https://piwqust.github.io/blackboard/';
const endpoint='https://blackboard-text-shares.pewqust.workers.dev';
const browser=await chromium.launch({channel:'chrome'});
const creator=await browser.newContext({serviceWorkers:'block'});
const recipient=await browser.newContext({serviceWorkers:'block'});
const page=await creator.newPage();
const note='Blackboard short-link deployment check. Synthetic note, no user data.';
const result={app,endpoint,checkedAt:new Date().toISOString(),checks:[]};
try {
  await page.goto(app+'editor.html', {waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#editor[contenteditable=true]').waitFor();
  await page.locator('#editor').fill(note);
  await page.locator('#settingsToggleBtn').click();
  await page.locator('#pageActionsBtn').click();
  await page.getByRole('button',{name:'Share a copy…',exact:true}).click();
  await page.locator('#createShortLinkBtn').waitFor({state:'visible'});
  await page.locator('#createShortLinkBtn').click();
  await page.locator('#shortLinkResult').waitFor({state:'visible',timeout:30000});
  const url=await page.locator('#shortLinkResult').inputValue();
  assert.equal(new URL(url).pathname,'/blackboard/s/');
  assert.ok(url.length<75);
  result.shortLinkLength=url.length;
  result.checks.push('Created short link from live GitHub Pages');
  const reader=await recipient.newPage();await reader.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await reader.locator('#readerContent').filter({hasText:note}).waitFor({timeout:30000});
  assert.equal(await reader.locator('#readerContent').textContent(),note);
  result.checks.push('Fresh recipient context read the exact copy');
  await page.locator('#sharedLinksDetails summary').click();
  await page.getByRole('button',{name:'Disable link',exact:true}).click();
  await page.getByRole('button',{name:'Confirm disable',exact:true}).click();
  await page.locator('.shared-link-row small').filter({hasText:'Disabled'}).waitFor({timeout:30000});
  await reader.reload();
  await reader.locator('#readerStateText').filter({hasText:'unavailable'}).waitFor({timeout:30000});
  result.checks.push('Disabled link no longer opens on live Pages');
  console.log(JSON.stringify(result));
} finally {
  // Best-effort removal even after a failed UI assertion. Never print management keys.
  const records=await page.evaluate(async()=>{
    const {createShareStore}=await import('./src/core/share-store.js');return createShareStore().list();
  }).catch(()=>[]);
  for(const record of records.filter(r=>r.state!=='revoked')) {
    await fetch(endpoint+'/v1/notes/'+record.id,{method:'DELETE',headers:{Authorization:'Bearer '+record.managementKey}});
  }
  await mkdir('docs/short-links',{recursive:true});
  await writeFile('docs/short-links/live-verification.json',JSON.stringify(result,null,2)+'\n');
  await creator.close();await recipient.close();await browser.close();
}
