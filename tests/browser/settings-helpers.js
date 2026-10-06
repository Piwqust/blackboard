export async function openSettings(page) {
  if (await page.locator('#settingsToggleBtn').getAttribute('aria-expanded') !== 'true') {
    await page.locator('#settingsToggleBtn').click();
  }
}
export async function openPageActions(page) {
  await openSettings(page);
  await page.locator('#pageActionsBtn').click();
}

export async function openDrawingTools(page) {
  if (await page.locator('#drawingToolbarVisibilityToggleBtn').getAttribute('aria-expanded') !== 'true') {
    await page.locator('#drawingToolbarVisibilityToggleBtn').click();
  }
  if(await page.locator('#drawingMoreBtn').getAttribute('aria-expanded')!=='true')await page.locator('#drawingMoreBtn').click();
}
