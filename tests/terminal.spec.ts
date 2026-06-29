import { test, expect } from '@playwright/test'
import path from 'path'

const SCREENSHOTS = path.join(__dirname, '../screenshots')

test.describe('Terminal portfolio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('input[autofocus]')
    await page.waitForTimeout(500)
  })

  test('initial render — boot banner and prompt visible', async ({ page }) => {
    // Banner shows callumdeas.dev in the ASCII header area
    await expect(page.getByText('callumdeas.dev', { exact: true })).toBeVisible()
    await expect(page.getByText('—  Personal Terminal')).toBeVisible()
    // Prompt shows callum@callumdeas.dev
    await expect(page.getByText('@callumdeas.dev').first()).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOTS}/01-initial.png`, fullPage: false })
  })

  test('help command', async ({ page }) => {
    await page.locator('input').fill('help')
    await page.keyboard.press('Enter')
    await expect(page.getByText('Available commands', { exact: true })).toBeVisible()
    await expect(page.getByText('Keyboard shortcuts', { exact: true })).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOTS}/03-help.png`, fullPage: false })
  })

  test('ls command — lists home directory', async ({ page }) => {
    await page.locator('input').fill('ls')
    await page.keyboard.press('Enter')
    // Use first() since boot banner also has "ls projects/" in the hint text
    await expect(page.getByText('projects/', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('about.md', { exact: true }).first()).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOTS}/04-ls.png`, fullPage: false })
  })

  test('cat about.md — renders markdown with colors', async ({ page }) => {
    await page.locator('input').fill('cat about.md')
    await page.keyboard.press('Enter')
    await expect(page.getByText('Callum Deas', { exact: true })).toBeVisible()
    await expect(page.getByText('Scotland')).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOTS}/05-cat-about.png`, fullPage: false })
  })

  test('cd into projects then ls', async ({ page }) => {
    await page.locator('input').fill('cd projects')
    await page.keyboard.press('Enter')
    // Prompt should update to show ~/projects
    await expect(page.locator('span', { hasText: '~/projects' }).first()).toBeVisible()

    await page.locator('input').fill('ls')
    await page.keyboard.press('Enter')
    await expect(page.getByText('name-game/', { exact: true })).toBeVisible()
    await expect(page.getByText('recipes/', { exact: true })).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOTS}/06-cd-projects-ls.png`, fullPage: false })
  })

  test('cat projects/name-game/README.md — shows project info', async ({ page }) => {
    await page.locator('input').fill('cat projects/name-game/README.md')
    await page.keyboard.press('Enter')
    // "Name Game" header appears as a bold heading
    await expect(page.getByText('Name Game', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('namegame.callumdeas.dev')).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOTS}/07-namegame-readme.png`, fullPage: false })
  })

  test('whoami command', async ({ page }) => {
    await page.locator('input').fill('whoami')
    await page.keyboard.press('Enter')
    await expect(page.getByText('callum', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Scotland', { exact: true })).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOTS}/08-whoami.png`, fullPage: false })
  })

  test('clear command resets terminal history', async ({ page }) => {
    await page.locator('input').fill('ls')
    await page.keyboard.press('Enter')
    // Confirm ls output appeared before clearing
    await expect(page.getByText('about.md', { exact: true }).first()).toBeVisible()

    await page.locator('input').fill('clear')
    await page.keyboard.press('Enter')
    // ls output should be gone; only the fresh prompt should remain
    await expect(page.getByText('about.md', { exact: true })).not.toBeVisible()
    await page.screenshot({ path: `${SCREENSHOTS}/09-clear.png`, fullPage: false })
  })

  test('command history — arrow up recalls previous command', async ({ page }) => {
    await page.locator('input').fill('ls')
    await page.keyboard.press('Enter')
    await page.locator('input').fill('pwd')
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowUp')
    const val = await page.locator('input').inputValue()
    expect(val).toBe('pwd')
    await page.screenshot({ path: `${SCREENSHOTS}/10-history.png`, fullPage: false })
  })

  test('unknown command shows error', async ({ page }) => {
    await page.locator('input').fill('foobar')
    await page.keyboard.press('Enter')
    await expect(page.getByText('command not found')).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOTS}/11-unknown-cmd.png`, fullPage: false })
  })

  test('full session — multiple commands build up terminal', async ({ page }) => {
    const cmds = ['whoami', 'ls', 'cd projects', 'ls', 'cat name-game/README.md']
    for (const cmd of cmds) {
      await page.locator('input').fill(cmd)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(100)
    }
    await expect(page.getByText('Name Game', { exact: true }).first()).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOTS}/12-full-session.png`, fullPage: false })
  })
})
