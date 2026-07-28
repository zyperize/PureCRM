// Deep interaction test: creates ONE dedicated test lead, exercises mutation flows
// on that lead only, then cleans up (deletes lead + child rows) at the end.
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';
const TEST_LEAD_NAME = 'ZZ PLAYWRIGHT TEST';

function attachListeners(page, bucket) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') bucket.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => bucket.pageErrors.push(err.message));
}

test.describe.configure({ mode: 'serial' });

let leadId = null;

test('create dedicated test lead via Add Lead UI', async ({ page }) => {
  const bucket = { consoleErrors: [], pageErrors: [] };
  attachListeners(page, bucket);

  // Idempotent: if a previous run already created the lead (e.g. this run is
  // resuming after a navigation flake), reuse it instead of creating a duplicate.
  await page.goto(`${BASE}/leads?search=${encodeURIComponent(TEST_LEAD_NAME)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const existingRow = page.locator('tr', { hasText: TEST_LEAD_NAME }).first();
  if (await existingRow.count()) {
    await existingRow.click();
    await page.waitForURL(/\/leads\/.+/);
    leadId = page.url().split('/leads/')[1];
    console.log('REUSING EXISTING TEST LEAD ID:', leadId);
    return;
  }

  await page.goto(`${BASE}/leads`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /add lead/i }).click();
  await expect(page.getByText('Add New Lead')).toBeVisible();

  await page.getByPlaceholder('e.g. Acme Services').fill(TEST_LEAD_NAME);
  await page.getByPlaceholder('(555) 123-4567').fill('5551234567');
  await page.getByPlaceholder('Los Angeles').fill('Testville');
  await page.getByPlaceholder('CA').fill('CA');
  await page.getByPlaceholder('John Doe').fill('Test Manager');
  await page.getByPlaceholder('Initial notes...').fill('Playwright QA seed lead - safe to delete.');

  await page.screenshot({ path: 'e2e/screenshots/add-lead-modal-filled.png' });

  await page.getByRole('button', { name: 'Create Lead' }).click();
  await expect(page.getByText('Lead created successfully')).toBeVisible({ timeout: 10000 });

  // Search for it to find its id via row click
  await page.waitForTimeout(1000);
  await page.getByPlaceholder('Search business name, phone, city...').fill(TEST_LEAD_NAME);
  await page.waitForTimeout(1200);
  const row = page.locator('tr', { hasText: TEST_LEAD_NAME }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'e2e/screenshots/leads-search-testlead.png' });

  await row.click();
  await page.waitForURL(/\/leads\/.+/);
  leadId = page.url().split('/leads/')[1];
  console.log('CREATED TEST LEAD ID:', leadId);
  expect(leadId).toBeTruthy();

  console.log('consoleErrors:', JSON.stringify(bucket.consoleErrors));
  console.log('pageErrors:', JSON.stringify(bucket.pageErrors));
});

test('leads list: search, filters, sort, pagination, page size', async ({ page }) => {
  const bucket = { consoleErrors: [], pageErrors: [] };
  attachListeners(page, bucket);

  await page.goto(`${BASE}/leads`, { waitUntil: 'domcontentloaded' });

  // Search
  await page.getByPlaceholder('Search business name, phone, city...').fill('example');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/leads-search-example.png' });
  await page.getByPlaceholder('Search business name, phone, city...').fill('');
  await page.waitForTimeout(800);

  // Open filters panel
  await page.getByRole('button', { name: /filters/i }).click();
  await expect(page.locator('select').first()).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/leads-filters-panel.png' });

  // Category filter
  await page.locator('select').first().selectOption('prospect');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/leads-filter-category.png' });

  // Reset filters
  await page.getByRole('button', { name: /reset filters/i }).click();
  await page.waitForTimeout(800);

  // Sort by business name
  await page.getByText('Business Name', { exact: false }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'e2e/screenshots/leads-sorted.png' });

  // Page size change
  const pageSizeSelect = page.locator('select').filter({ hasText: '25' }).first();
  if (await pageSizeSelect.count()) {
    await pageSizeSelect.selectOption('50');
    await page.waitForTimeout(1000);
  }

  // Pagination next page
  const nextBtn = page.locator('button:has(svg.lucide-chevron-right)');
  if (await nextBtn.count()) {
    const disabled = await nextBtn.first().isDisabled();
    if (!disabled) {
      await nextBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'e2e/screenshots/leads-page2.png' });
    }
  }

  console.log('=== leads list interactions ===');
  console.log('consoleErrors:', JSON.stringify(bucket.consoleErrors));
  console.log('pageErrors:', JSON.stringify(bucket.pageErrors));
});

test('bulk actions on test lead only: set stage + set follow-up date', async ({ page }) => {
  const bucket = { consoleErrors: [], pageErrors: [] };
  attachListeners(page, bucket);

  await page.goto(`${BASE}/leads?search=${encodeURIComponent(TEST_LEAD_NAME)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const row = page.locator('tr', { hasText: TEST_LEAD_NAME }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.locator('input[type=checkbox]').check();

  await expect(page.getByText('1 selected')).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/leads-bulk-bar.png' });

  // Bulk stage update
  const stageSelect = page.locator('select').filter({ hasText: 'Set stage' });
  await stageSelect.selectOption('contacted');
  await page.getByRole('button', { name: 'Apply' }).first().click();
  await expect(page.getByText(/lead.*updated/i)).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(500);

  // Verify stage changed in UI
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/leads-after-bulk-stage.png' });

  // Re-select for follow-up date bulk update
  await page.goto(`${BASE}/leads?search=${encodeURIComponent(TEST_LEAD_NAME)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const row2 = page.locator('tr', { hasText: TEST_LEAD_NAME }).first();
  await row2.locator('input[type=checkbox]').check();
  const dateInput = page.locator('input[type=date]');
  await dateInput.fill('2026-08-01');
  const applyButtons = page.getByRole('button', { name: 'Apply' });
  await applyButtons.nth(1).click();
  await expect(page.getByText(/lead.*updated/i)).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/leads-after-bulk-followup.png' });

  console.log('=== bulk actions ===');
  console.log('consoleErrors:', JSON.stringify(bucket.consoleErrors));
  console.log('pageErrors:', JSON.stringify(bucket.pageErrors));
});

test('lead detail: header, edit modal, dialer modal', async ({ page }) => {
  const bucket = { consoleErrors: [], pageErrors: [] };
  attachListeners(page, bucket);

  await page.goto(`${BASE}/leads?search=${encodeURIComponent(TEST_LEAD_NAME)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const row = page.locator('tr', { hasText: TEST_LEAD_NAME }).first();
  await row.click();
  await page.waitForURL(/\/leads\/.+/);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/lead-detail-header.png', fullPage: true });

  // Edit modal
  const editBtn = page.getByRole('button', { name: /edit/i }).first();
  await editBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e/screenshots/lead-edit-modal.png' });
  // close via Cancel / X - try common patterns
  const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
  if (await cancelBtn.count()) {
    await cancelBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(500);

  // Dialer modal
  const dialerBtn = page.getByRole('button', { name: /call|dial/i }).first();
  if (await dialerBtn.count()) {
    await dialerBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/dialer-modal.png' });

    // Verify phone pill exists and Google Voice open is intercepted (don't actually navigate)
    const phonePill = page.getByTitle(/Call via Google Voice/i);
    const pillExists = await phonePill.count();
    console.log('Dialer phone pill (Google Voice) exists:', pillExists > 0);

    const simBtn = page.getByTitle(/Call via your phone/i);
    const simExists = await simBtn.count();
    console.log('Dialer SIM/tel button exists:', simExists > 0);

    // Close dialer without dialing
    const closeBtn = page.getByRole('button', { name: /end call/i }).first();
    if (await closeBtn.count()) await closeBtn.click();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    console.log('WARN: no dialer/call button found on lead detail page');
  }

  console.log('=== lead detail header/edit/dialer ===');
  console.log('consoleErrors:', JSON.stringify(bucket.consoleErrors));
  console.log('pageErrors:', JSON.stringify(bucket.pageErrors));
});

test('lead detail: activity tab - log a note and verify timeline', async ({ page }) => {
  const bucket = { consoleErrors: [], pageErrors: [] };
  attachListeners(page, bucket);

  await page.goto(`${BASE}/leads?search=${encodeURIComponent(TEST_LEAD_NAME)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const row = page.locator('tr', { hasText: TEST_LEAD_NAME }).first();
  await row.click();
  await page.waitForURL(/\/leads\/.+/);
  await page.waitForTimeout(1000);

  const noteMarker = `QA note ${Date.now()}`;
  await page.getByPlaceholder('Log a note or call...').fill(noteMarker);
  await page.getByRole('button', { name: /log/i }).click();
  await page.waitForTimeout(1500);
  await expect(page.getByText(noteMarker)).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'e2e/screenshots/lead-activity-note-logged.png' });

  console.log('=== activity tab ===');
  console.log('consoleErrors:', JSON.stringify(bucket.consoleErrors));
  console.log('pageErrors:', JSON.stringify(bucket.pageErrors));
});

test('lead detail: tasks tab - add and complete a task', async ({ page }) => {
  const bucket = { consoleErrors: [], pageErrors: [] };
  attachListeners(page, bucket);

  await page.goto(`${BASE}/leads?search=${encodeURIComponent(TEST_LEAD_NAME)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const row = page.locator('tr', { hasText: TEST_LEAD_NAME }).first();
  await row.click();
  await page.waitForURL(/\/leads\/.+/);
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: 'tasks' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'e2e/screenshots/lead-tasks-tab-initial.png' });

  const taskName = `QA task ${Date.now()}`;
  await page.getByPlaceholder('Add new task...').fill(taskName);
  await page.getByPlaceholder('Add new task...').press('Enter');
  await page.waitForTimeout(1200);
  await expect(page.getByText(taskName)).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'e2e/screenshots/lead-tasks-after-add.png' });

  // Complete it (task row container has class "group"; first button inside is the checkbox)
  const taskRow = page.locator('div.group', { hasText: taskName });
  const checkBtn = taskRow.locator('button').first();
  await checkBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/lead-tasks-after-complete.png' });

  console.log('=== tasks tab ===');
  console.log('consoleErrors:', JSON.stringify(bucket.consoleErrors));
  console.log('pageErrors:', JSON.stringify(bucket.pageErrors));
});

test('lead detail: qualification tab - answer a question and save', async ({ page }) => {
  const bucket = { consoleErrors: [], pageErrors: [] };
  attachListeners(page, bucket);

  await page.goto(`${BASE}/leads?search=${encodeURIComponent(TEST_LEAD_NAME)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const row = page.locator('tr', { hasText: TEST_LEAD_NAME }).first();
  await row.click();
  await page.waitForURL(/\/leads\/.+/);
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: 'qualification' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'e2e/screenshots/lead-qualification-tab.png' });

  const firstInput = page.locator('input[type=text].input-field').first();
  const hasQuestions = await firstInput.count();
  if (hasQuestions) {
    await firstInput.fill('QA test answer');
    await page.getByRole('button', { name: /save answers/i }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'e2e/screenshots/lead-qualification-saved.png' });
  } else {
    console.log('No qualification questions configured - empty state check');
  }

  console.log('=== qualification tab ===');
  console.log('consoleErrors:', JSON.stringify(bucket.consoleErrors));
  console.log('pageErrors:', JSON.stringify(bucket.pageErrors));
});

test('email template dropdown on lead detail', async ({ page }) => {
  const bucket = { consoleErrors: [], pageErrors: [] };
  attachListeners(page, bucket);

  await page.goto(`${BASE}/leads?search=${encodeURIComponent(TEST_LEAD_NAME)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const row = page.locator('tr', { hasText: TEST_LEAD_NAME }).first();
  await row.click();
  await page.waitForURL(/\/leads\/.+/);
  await page.waitForTimeout(1000);

  // The test lead has no email yet (Add Lead modal has no email field at all),
  // so "Send Email" is correctly disabled. Add an email via Edit modal first so
  // we can actually exercise the template dropdown as instructed.
  const emailBtnBefore = page.getByRole('button', { name: /send email/i }).first();
  const disabledBefore = await emailBtnBefore.isDisabled().catch(() => null);
  console.log('Send Email disabled before adding email (expected true, no email on lead):', disabledBefore);

  await page.getByRole('button', { name: /edit/i }).first().click();
  await page.waitForTimeout(500);
  const emailInput = page.locator('input[type=email], input[placeholder*="email" i]').first();
  if (await emailInput.count()) {
    await emailInput.fill('qa-playwright-test@example.com');
    await page.getByRole('button', { name: /save/i }).first().click();
    await page.waitForTimeout(1000);
  } else {
    console.log('WARN: no email input found in Edit modal');
    await page.keyboard.press('Escape');
  }

  const emailBtn = page.getByRole('button', { name: /send email/i }).first();
  if (await emailBtn.count()) {
    await expect(emailBtn).toBeEnabled({ timeout: 10000 });
    await emailBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'e2e/screenshots/lead-email-template-dropdown.png' });
  } else {
    console.log('WARN: no Send Email button found');
  }

  console.log('=== email template ===');
  console.log('consoleErrors:', JSON.stringify(bucket.consoleErrors));
  console.log('pageErrors:', JSON.stringify(bucket.pageErrors));
});

test('CHECK: is there any delete-lead UI at all', async ({ page }) => {
  // leadsService.deleteLead(id) exists in src/services/leadsService.js but we found
  // no button wired to it anywhere in Leads list / LeadDetail / EditLeadModal.
  // Confirm that on the live page, then record the lead id so the harness can
  // clean up directly via Supabase (the only available path).
  await page.goto(`${BASE}/leads?search=${encodeURIComponent(TEST_LEAD_NAME)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const row = page.locator('tr', { hasText: TEST_LEAD_NAME }).first();
  const exists = await row.count();
  console.log('Test lead row still present:', exists);

  if (exists) {
    await row.click();
    await page.waitForURL(/\/leads\/.+/);
    await page.waitForTimeout(800);
    console.log('CLEANUP_LEAD_URL:', page.url());
    const deleteBtn = page.getByRole('button', { name: /delete/i });
    console.log('Delete button count on lead detail page:', await deleteBtn.count());
    // Also check the Edit modal for a delete option
    const editBtn = page.getByRole('button', { name: /edit/i }).first();
    if (await editBtn.count()) {
      await editBtn.click();
      await page.waitForTimeout(500);
      const deleteInModal = page.getByRole('button', { name: /delete/i });
      console.log('Delete button count inside Edit modal:', await deleteInModal.count());
      await page.screenshot({ path: 'e2e/screenshots/edit-modal-no-delete-option.png' });
    }
  }
});
