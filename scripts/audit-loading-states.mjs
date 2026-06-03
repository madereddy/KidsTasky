import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.E2E_BASE_URL || 'https://kids.madereddy.com';
const EMAIL = process.env.E2E_PARENT_EMAIL;
const PASSWORD = process.env.E2E_PARENT_PASSWORD;
const PIN = process.env.E2E_PARENT_PIN;

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
  
  // Try to catch the skeleton loader
  try {
    const skeleton = page.locator('.animate-pulse, [class*="Skeleton"]');
    await skeleton.waitFor({ state: 'visible', timeout: 1000 }).catch(() => {});
    if (await skeleton.isVisible()) {
      console.log(`  - Skeleton detected for ${sectionName}`);
      await page.screenshot({ path: path.join(REPORT_DIR, `${sectionName}-loading.png`) });
    } else {
      console.log(`  - No skeleton detected (fast load)`);
    }
  } catch (e) {}

  // Wait for content to appear
  console.log(`  - Waiting for content selector: ${contentSelector} (timeout: ${timeout}ms)`);
  try {
    await page.waitForSelector(contentSelector, { timeout });
  } catch (e) {
    console.warn(`  - Timeout waiting for ${contentSelector} in ${sectionName}. Taking error screenshot.`);
    const mainHtml = await page.innerHTML('main');
    console.log(`  - Main element HTML: ${mainHtml.slice(0, 1000)}...`);
    const bodyText = await page.innerText('body');
    console.log(`  - Body text snippet: ${bodyText.slice(0, 500)}...`);
    await page.screenshot({ path: path.join(REPORT_DIR, `${sectionName}-timeout-error.png`), fullPage: true });
    await page.screenshot({ path: path.join(REPORT_DIR, `${sectionName}-viewport-error.png`) });
    throw e;
  }

  const loadTime = Date.now() - startTime;
  console.log(`  - ${sectionName} loaded in ${loadTime}ms`);
  await page.screenshot({ path: path.join(REPORT_DIR, `${sectionName}-loaded.png`), fullPage: true });
  
  return loadTime;
}

async function runAudit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    console.error(`BROWSER ERROR: ${err.message}`);
  });

  console.log(`Navigating to ${BASE_URL}...`);
  await page.goto(`${BASE_URL}?t=${Date.now()}`);

  // Login
  console.log('Logging in...');
  await page.fill('input[placeholder*="Email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button:has-text("Log In")');

  // Wait for initial dashboard load
  await page.waitForSelector('header', { timeout: 10000 });
  console.log('Login successful.');

  const results = [];
  const navPrefix = 'header nav ';

  // Home
  results.push({
    section: 'Home',
    time: await auditSection(page, 'Home', navPrefix + 'button:has-text("Home")', 'main h2, .grid') 
  });

  // Tasks
  results.push({
    section: 'Tasks',
    time: await auditSection(page, 'Tasks', navPrefix + 'button:has-text("Tasks")', '.space-y-6, .grid')
  });

  // Lists
  results.push({
    section: 'Lists',
    time: await auditSection(page, 'Lists', navPrefix + 'button:has-text("Lists")', '.grid-cols-1.md\\:grid-cols-2')
  });

  // Meals
  results.push({
    section: 'Meals',
    time: await auditSection(page, 'Meals', navPrefix + 'button:has-text("Meals")', '.grid-cols-1.lg\\:grid-cols-3')
  });

  // Calendar
  results.push({
    section: 'Calendar',
    time: await auditSection(page, 'Calendar', navPrefix + 'button:has-text("Calendar")', 'button:has-text("Quick Add"), button:has-text("Today"), :has-text("View only")', 60000)
  });

  // Check footer version
  const version = await page.locator('footer p.font-mono').innerText();
  console.log(`\nBuild Version: ${version}`);
  
  const EXPECTED_VERSION = '405265a';
  if (version.includes(EXPECTED_VERSION)) {
    console.log('✅ Verified: Running against the latest deployment.');
  } else {
    console.warn(`⚠️ Warning: Version mismatch. Expected ${EXPECTED_VERSION}, got ${version}. Wait for deployment?`);
  }

  console.log('\n--- Loading Audit Summary ---');
  results.forEach(r => {
    console.log(`${r.section.padEnd(10)}: ${r.time}ms`);
  });

  await browser.close();
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
