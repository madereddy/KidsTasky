import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.E2E_BASE_URL || 'https://kids.madereddy.com';
const EMAIL = process.env.E2E_PARENT_EMAIL;
const PASSWORD = process.env.E2E_PARENT_PASSWORD;
const KID_PIN = process.env.E2E_KID_PIN;

if (!EMAIL || !PASSWORD) {
  console.error('Missing E2E credentials in .env');
  process.exit(1);
}

const REPORT_DIR = './tmp/loading-audit';
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

async function auditSection(page, sectionName, navButtonSelector, contentSelector, timeout = 15000) {
  console.log(`Auditing section: ${sectionName}...`);

  const navBtn = page.locator(navButtonSelector);
  console.log(`  - Clicking ${sectionName} button...`);
  await navBtn.click();

  const startTime = Date.now();

  try {
    const skeleton = page.locator('.animate-pulse, [class*="Skeleton"]');
    await skeleton.waitFor({ state: 'visible', timeout: 1000 }).catch(() => {});
    if (await skeleton.isVisible()) {
      console.log(`  - Skeleton detected for ${sectionName}`);
      await page.screenshot({ path: path.join(REPORT_DIR, `${sectionName}-loading.png`) });
    } else {
      console.log('  - No skeleton detected (fast load)');
    }
  } catch {}

  console.log(`  - Waiting for content selector: ${contentSelector} (timeout: ${timeout}ms)`);
  try {
    await page.waitForSelector(contentSelector, { timeout });
  } catch (error) {
    console.warn(`  - Timeout waiting for ${contentSelector} in ${sectionName}. Taking error screenshot.`);
    const mainHtml = await page.innerHTML('main');
    console.log(`  - Main element HTML: ${mainHtml.slice(0, 1000)}...`);
    const bodyText = await page.innerText('body');
    console.log(`  - Body text snippet: ${bodyText.slice(0, 500)}...`);
    await page.screenshot({ path: path.join(REPORT_DIR, `${sectionName}-timeout-error.png`), fullPage: true });
    await page.screenshot({ path: path.join(REPORT_DIR, `${sectionName}-viewport-error.png`) });
    throw error;
  }

  const loadTime = Date.now() - startTime;
  console.log(`  - ${sectionName} loaded in ${loadTime}ms`);
  await page.screenshot({ path: path.join(REPORT_DIR, `${sectionName}-loaded.png`), fullPage: true });

  return loadTime;
}

async function runAudit() {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    browser = await chromium.launch({ headless: true });
  }
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    console.error(`BROWSER ERROR: ${err.message}`);
  });

  console.log(`Navigating to ${BASE_URL}...`);
  await page.goto(`${BASE_URL}?t=${Date.now()}`);

  console.log('Logging in...');
  await page.fill('input[placeholder*="Email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button:has-text("Log In")');

  await page.waitForSelector('header', { timeout: 10000 });
  console.log('Login successful.');

  const results = [];
  const navPrefix = 'header nav ';

  results.push({
    section: 'Home',
    time: await auditSection(
      page,
      'Home',
      `${navPrefix}button:has-text("Home")`,
      'main [data-testid="wall-clock"], main button:has-text("Manage family"), main button:has-text("Manage family members & settings")',
    ),
  });

  results.push({
    section: 'Tasks',
    time: await auditSection(
      page,
      'Tasks',
      `${navPrefix}button:has-text("Tasks")`,
      'text="Tasks & Achievements", button:has-text("New Objective"), text="Pending Approval"',
      30000,
    ),
  });

  results.push({
    section: 'Lists',
    time: await auditSection(
      page,
      'Lists',
      `${navPrefix}button:has-text("Lists")`,
      'text="My Lists"',
    ),
  });

  results.push({
    section: 'Meals',
    time: await auditSection(
      page,
      'Meals',
      `${navPrefix}button:has-text("Meals")`,
      'text="Recipe Library"',
    ),
  });

  results.push({
    section: 'Calendar',
    time: await auditSection(
      page,
      'Calendar',
      `${navPrefix}button:has-text("Calendar")`,
      'button:has-text("Quick Add"), button:has-text("Today"), :has-text("View only")',
      60000,
    ),
  });

  if (KID_PIN) {
    console.log('Auditing profile switch to kid...');
    await page.getByRole('button', { name: /switch profile/i }).click();
    const kidButton = page.locator('button').filter({ hasText: /Kid$/i }).first();
    await kidButton.waitFor({ timeout: 10000 });
    await kidButton.click();
    await page.getByText(/Enter kid Access Key/i).waitFor({ timeout: 10000 });
    await page.getByPlaceholder('4-digit PIN').fill(KID_PIN);
    await page.getByRole('button', { name: /^Switch$/i }).click();
    await page.waitForLoadState('networkidle');
    const kidBodyText = await page.innerText('body');
    console.log(`Kid switch visible content: ${kidBodyText.slice(0, 300)}...`);
    await page.screenshot({ path: path.join(REPORT_DIR, 'kid-switch-loaded.png'), fullPage: true });
  }

  const buildInfo = await page.evaluate(async () => {
    const res = await fetch('/api/health/build');
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    const body = await res.json();
    return {
      ok: true,
      gitSha: body?.gitSha || null,
      buildTime: body?.buildTime || null,
      processStartedAt: body?.processStartedAt || null,
    };
  });

  console.log('\nBuild Info:');
  console.log(JSON.stringify(buildInfo, null, 2));

  console.log('\n--- Loading Audit Summary ---');
  results.forEach((result) => {
    console.log(`${result.section.padEnd(10)}: ${result.time}ms`);
  });

  await browser.close();
}

runAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
