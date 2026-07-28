import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))

test('fresh browser creates a local CRM and keeps imported leads after reload', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await new Promise((resolve) => {
      const request = window.indexedDB.deleteDatabase('cleancrm')
      request.onsuccess = resolve
      request.onerror = resolve
      request.onblocked = resolve
    })
  })
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Make PureCRM yours' })).toBeVisible()
  await expect(page.getByText('No account, database, or coding required')).toBeVisible()

  await page.getByLabel('Business or workspace name').fill('Example Company')
  await page.getByLabel(/Owner or team/).fill('Sales Team')
  await page.getByLabel(/Industry/).fill('Professional Services')
  const lightMode = page.getByRole('button', { name: 'light', exact: true })
  const darkMode = page.getByRole('button', { name: 'dark', exact: true })
  await lightMode.click()
  await expect(lightMode).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.waitForTimeout(250)
  await page.screenshot({ path: 'test-results/purecrm-setup-light.png', fullPage: true })
  await darkMode.click()
  await expect(darkMode).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.waitForTimeout(250)
  await page.screenshot({ path: 'test-results/purecrm-setup-dark.png', fullPage: true })
  await page.getByRole('button', { name: 'Blue' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue')
  await lightMode.click()
  await expect(lightMode).toHaveAttribute('aria-pressed', 'true')
  await Promise.all([
    page.waitForURL('**/upload-data'),
    page.getByRole('button', { name: 'Create PureCRM' }).click(),
  ])

  await expect(page.getByText('Example Company CRM')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Import/Export Data' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Import Data' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('link', { name: 'Dashboard' }).click()
  const totalLeadsTile = page.getByText('Total leads', { exact: true }).locator('..').locator('..')
  await expect(totalLeadsTile).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  const dashboardLink = page.getByRole('link', { name: 'Dashboard' })
  await expect(dashboardLink).toHaveCSS('color', 'rgb(30, 64, 175)')

  const leadsLink = page.getByRole('link', { name: 'Leads', exact: true })
  const leadsTooltip = page.getByRole('tooltip', { name: 'Leads' })
  await leadsLink.hover()
  await expect(leadsTooltip).toBeHidden()
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await leadsLink.hover()
  await expect(leadsTooltip).toBeVisible()
  const [linkBox, tooltipBox] = await Promise.all([leadsLink.boundingBox(), leadsTooltip.boundingBox()])
  expect(linkBox).not.toBeNull()
  expect(tooltipBox).not.toBeNull()
  expect(tooltipBox.x).toBeGreaterThanOrEqual(linkBox.x + linkBox.width)
  await page.screenshot({ path: 'test-results/purecrm-sidebar-collapsed.png', fullPage: true })
  await page.getByRole('button', { name: 'Expand sidebar' }).click()

  await page.screenshot({ path: 'test-results/purecrm-dashboard-light.png', fullPage: true })
  await page.getByRole('link', { name: 'Import Data' }).click()
  await page.locator('input[type="file"]').setInputFiles(
    path.join(currentDirectory, 'fixtures', 'leads.xlsx')
  )

  await expect(page.getByText('Northwind Studio')).toBeVisible()
  await page.getByRole('button', { name: 'Import 2 Leads' }).click()
  await expect(page.getByText('Import Successful!')).toBeVisible()

  await page.reload()
  await page.goto('/leads')
  await expect(page.getByRole('cell', { name: 'Northwind Studio', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'solo@example.com', exact: true })).toBeVisible()

  const leadSearch = page.getByPlaceholder('Search business name, phone, city...')
  await leadSearch.fill('solo@example.com')
  await expect(page.getByRole('cell', { name: 'solo@example.com', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Northwind Studio', exact: true })).toBeHidden()
  await leadSearch.clear()

  await page.getByRole('cell', { name: 'Northwind Studio', exact: true }).click()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByText('Business Name *', { exact: true }).locator('..').locator('input').fill('Northwind Studio Updated')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByRole('heading', { name: 'Northwind Studio Updated' })).toBeVisible()

  await page.goto('/settings')
  await expect(page.getByRole('link', { name: /Import & Export/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Workspace & Database/ })).toBeVisible()
  await page.getByRole('link', { name: /Workspace & Database/ }).click()
  await expect(page.getByRole('heading', { name: 'Workspace & Database' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Import Excel or CSV leads/ })).toBeVisible()
  await page.getByRole('button', { name: 'light' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: /Connect Team Database/ }).click()
  await expect(page.getByLabel('Supabase Project URL')).toBeVisible()
  await page.getByRole('button', { name: /Local database/ }).click()
  const settingsReload = page.waitForEvent('load')
  await page.getByRole('button', { name: 'Save workspace' }).click()
  await settingsReload
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download backup' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^purecrm-backup-.*\.json$/)
  const backupPath = await download.path()
  page.once('dialog', (dialog) => dialog.accept())
  const restoreNavigation = page.waitForURL('**/')
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(backupPath)
  await restoreNavigation
  await page.goto('/leads')
  await expect(page.getByRole('cell', { name: 'Northwind Studio Updated', exact: true })).toBeVisible()
})
