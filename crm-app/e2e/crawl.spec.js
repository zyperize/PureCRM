// Broad crawl across all routes: capture console errors, network failures, screenshots.
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

const ROUTES = [
  ['/', 'dashboard'],
  ['/leads', 'leads'],
  ['/customers', 'customers'],
  ['/map', 'map'],
  ['/calling', 'calling'],
  ['/qualification', 'qualification'],
  ['/tasks', 'tasks'],
  ['/tasks/calendar', 'tasks-calendar'],
  ['/upload-data', 'upload-data'],
  ['/saved-searches', 'saved-searches'],
  ['/reports', 'reports'],
  ['/outreach', 'outreach'],
  ['/follow-up-tasks', 'follow-up-tasks'],
  ['/calling-scripts', 'calling-scripts'],
  ['/settings', 'settings'],
  ['/settings/profile', 'settings-profile'],
  ['/settings/workspace', 'settings-workspace'],
  ['/settings/scripts', 'settings-scripts'],
  ['/settings/tasks', 'settings-tasks'],
];

function attachListeners(page, bucket) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      bucket.consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    bucket.pageErrors.push(err.message);
  });
  page.on('requestfailed', (req) => {
    bucket.requestFailures.push(`${req.method()} ${req.url()} -- ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      bucket.badResponses.push(`${res.status()} ${res.url()}`);
    }
  });
}

for (const [path, name] of ROUTES) {
  test(`crawl desktop: ${path}`, async ({ page }) => {
    const bucket = { consoleErrors: [], pageErrors: [], requestFailures: [], badResponses: [] };
    attachListeners(page, bucket);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `e2e/screenshots/${name}-desktop.png`, fullPage: true }).catch(() => {});
    console.log(`\n=== ${path} (desktop) ===`);
    console.log('consoleErrors:', JSON.stringify(bucket.consoleErrors));
    console.log('pageErrors:', JSON.stringify(bucket.pageErrors));
    console.log('requestFailures:', JSON.stringify(bucket.requestFailures));
    console.log('badResponses:', JSON.stringify(bucket.badResponses));
  });
}

// Mobile viewport for key pages
const MOBILE_ROUTES = ['/', '/leads', '/customers', '/map', '/reports', '/tasks'];
for (const path of MOBILE_ROUTES) {
  test(`crawl mobile 390px: ${path}`, async ({ page }) => {
    const bucket = { consoleErrors: [], pageErrors: [], requestFailures: [], badResponses: [] };
    attachListeners(page, bucket);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const name = path === '/' ? 'dashboard' : path.replace(/\//g, '');
    await page.screenshot({ path: `e2e/screenshots/${name}-mobile390.png`, fullPage: true }).catch(() => {});
    console.log(`\n=== ${path} (mobile 390px) ===`);
    console.log('consoleErrors:', JSON.stringify(bucket.consoleErrors));
    console.log('pageErrors:', JSON.stringify(bucket.pageErrors));
    console.log('requestFailures:', JSON.stringify(bucket.requestFailures));
    console.log('badResponses:', JSON.stringify(bucket.badResponses));
  });
}
