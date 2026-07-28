import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';
const CSV_FILE = {
  name: 'qa-test-upload.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from([
    'business_name,phone,email,city,state,category',
    '"QA Example One","555-0101","one@example.com","Austin","TX","prospect"',
    '"QA Example Two","555-0102","two@example.com","Denver","CO","inbound"',
  ].join('\n')),
};

test('upload-data: CSV preview + duplicate-check flow (cancel, no real import)', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(`${BASE}/upload-data`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/upload-data-initial.png', fullPage: true });

  const fileInput = page.locator('input[type=file]');
  await fileInput.setInputFiles(CSV_FILE);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/upload-data-preview.png', fullPage: true });

  await expect(page.getByText(/Loaded 2 rows/i).first()).toBeVisible({ timeout: 10000 });

  // Trigger the duplicate check by clicking Import (this only checks for dupes
  // client-side and shows a modal before ever writing to Supabase since one row
  // may show a duplicate modal before writing to Supabase).
  await page.getByRole('button', { name: /import 2 leads/i }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'e2e/screenshots/upload-data-duplicate-modal.png', fullPage: true });

  const dupModalVisible = await page.getByText(/Duplicate Leads Detected/i).isVisible().catch(() => false);
  console.log('Duplicate warning modal appeared:', dupModalVisible);

  if (dupModalVisible) {
    // Cancel out - do NOT import anything into the real DB
    await page.getByRole('button', { name: /^cancel$/i }).click();
    await page.waitForTimeout(500);
  } else {
    console.log('No duplicate modal appeared for the isolated QA rows');
  }

  await page.screenshot({ path: 'e2e/screenshots/upload-data-after-cancel.png', fullPage: true });

  console.log('=== upload-data ===');
  console.log('consoleErrors:', JSON.stringify(consoleErrors));
  console.log('pageErrors:', JSON.stringify(pageErrors));
});
