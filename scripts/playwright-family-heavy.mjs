import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

function unique(prefix) {
  return `${prefix}_${Date.now()}`;
}

async function runStep(results, name, fn, timeoutMs = 90000) {
  console.log(`[e2e] start: ${name}`);
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Step timeout after ${timeoutMs}ms`)), timeoutMs)),
    ]);
    results.push({ step: name, ok: true });
    console.log(`[e2e] ok: ${name}`);
  } catch (e) {
    results.push({ step: name, ok: false, error: String(e?.message || e) });
    console.log(`[e2e] fail: ${name}`);
  }
}

async function dismissOverlays(page) {
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.getByRole('button', { name: /^Cancel$|^Abort$|^Close$/i }).first().click({ timeout: 500 }).catch(() => {});
    await page.waitForTimeout(150);
  }
}

async function kidLoginFromEmail(page, parentEmail, kidName, pin) {
  await page.getByPlaceholder('Parent Email or Username').fill(parentEmail);
  await page.getByPlaceholder('Parent Password (Optional for Kids)').fill('');
  await page.getByRole('button', { name: /find my account/i }).click();
  await page.getByRole('button', { name: kidName, exact: true }).first().click();
  for (const digit of pin.split('')) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await page.getByRole('button', { name: /let's go/i }).click();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const results = [];

  const parentEmail = `${unique('family_parent')}@example.com`;
  const parentPassword = 'pass1234';
  const parentName = 'Family Parent';
  const kidName = 'Ava';
  const kidPin = '1234';
  const kidTaskTitle = unique('KidTask');
  const kidHomeworkTitle = unique('KidHomework');

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });

    await runStep(results, 'Register Parent', async () => {
      await page.getByText(/Need to register/i).first().click();
      await page.getByPlaceholder('Parent Name').fill(parentName);
      await page.getByPlaceholder('Parent Email or Username').fill(parentEmail);
      await page.getByPlaceholder('Parent Password (Optional for Kids)').fill(parentPassword);
      await page.getByRole('button', { name: /register/i }).click();
    });

    await runStep(results, 'Parent Onboarding', async () => {
      const ground = page.getByRole('button', { name: /ground control/i }).first();
      if (await ground.isVisible().catch(() => false)) {
        await ground.click();
        await page.getByRole('button', { name: /board station/i }).click();
      }
      await page.getByRole('button', { name: /^Tasks$/i }).first().waitFor({ timeout: 20000 });
    });

    await runStep(results, 'Add Kid Profile', async () => {
      await dismissOverlays(page);
      await page.getByRole('button', { name: /^Tasks$/i }).first().click();
      await page.getByPlaceholder('New Cadet Name').waitFor({ timeout: 15000 });
      await page.getByPlaceholder('New Cadet Name').fill(kidName);
      await page.getByPlaceholder(/4-Digit Identity Key/i).fill(kidPin);
      await page.getByRole('button', { name: /commission cadet/i }).click();
      await page.getByText(kidName, { exact: false }).first().waitFor({ timeout: 15000 });
    });

    await runStep(results, 'Create Task Assigned To Kid', async () => {
      await dismissOverlays(page);
      await page.getByRole('button', { name: /^Tasks$/i }).first().click();
      await page.getByRole('button', { name: /new objective/i }).click();
      await page.getByPlaceholder(/Navigation Check/i).fill(kidTaskTitle);
      await page.locator('select').first().selectOption({ label: kidName });
      await page.getByRole('button', { name: /^launch$/i }).click();
      await page.getByText(kidTaskTitle).first().waitFor({ timeout: 10000 });
    });

    await runStep(results, 'Create Homework For Kid', async () => {
      await dismissOverlays(page);
      await page.getByRole('button', { name: /^Homework$/i }).first().click();
      await page.getByRole('button', { name: /^Add$/i }).first().click();
      await page.getByPlaceholder(/^Title$/i).fill(kidHomeworkTitle);
      await page.getByPlaceholder(/^Subject$/i).fill('Science');
      const due = new Date();
      due.setDate(due.getDate() + 2);
      await page.locator('input[type="date"]').first().fill(due.toISOString().slice(0, 10));
      await page.getByRole('button', { name: /^Save$/i }).first().click();
      await page.getByText(kidHomeworkTitle).first().waitFor({ timeout: 10000 });
    });

    await runStep(results, 'Logout Parent', async () => {
      await dismissOverlays(page);
      await page.getByRole('button', { name: /log out/i }).click();
      await page.getByPlaceholder('Parent Email or Username').waitFor({ timeout: 10000 });
    });

    await runStep(results, 'Login As Kid', async () => {
      await kidLoginFromEmail(page, parentEmail, kidName, kidPin);
      await page.getByText(kidName, { exact: false }).first().waitFor({ timeout: 15000 });
    });

    await runStep(results, 'Kid Completes Assigned Task', async () => {
      await dismissOverlays(page);
      await page.getByRole('button', { name: /^Tasks$/i }).first().click().catch(() => {});
      const taskCard = page.locator('div', { hasText: kidTaskTitle }).first();
      await taskCard.waitFor({ timeout: 15000 });
      await taskCard.getByRole('button').first().click({ force: true });
      const modalVisible = await page.getByText(/All Done\?|Did you complete/i).first().isVisible().catch(() => false);
      if (modalVisible) {
        await page.getByRole('button', { name: /yes!|\+.*xp/i }).last().click();
      }
      await page.getByText(/Pending Approval|Completed/i).first().waitFor({ timeout: 12000 });
      await page.waitForTimeout(1200);
    });

    await runStep(results, 'Kid Completes Homework', async () => {
      await dismissOverlays(page);
      await page.getByRole('button', { name: /^Homework$/i }).first().click();
      await page.getByText(kidHomeworkTitle).first().waitFor({ timeout: 10000 });
      const row = page.locator('div', { hasText: kidHomeworkTitle }).first();
      await row.getByRole('button', { name: /mark done/i }).click();
      await row.getByRole('button', { name: /^Done$/i }).waitFor({ timeout: 10000 });
    });

    await runStep(results, 'Logout Kid', async () => {
      await dismissOverlays(page);
      await page.getByRole('button', { name: /log out/i }).click();
      await page.getByPlaceholder('Parent Email or Username').waitFor({ timeout: 10000 });
    });

    await runStep(results, 'Login Parent Again', async () => {
      await dismissOverlays(page);
      await page.getByPlaceholder('Parent Email or Username').fill(parentEmail);
      await page.getByPlaceholder('Parent Password (Optional for Kids)').fill(parentPassword);
      await page.getByRole('button', { name: /log in/i }).click();
      await page.getByRole('button', { name: /^Tasks$/i }).first().waitFor({ timeout: 15000 });
    });

    await runStep(results, 'Approve Kid Task Completion', async () => {
      await dismissOverlays(page);
      await page.getByRole('button', { name: /^Tasks$/i }).first().click();
      const approve = page.getByRole('button', { name: /approve/i }).first();
      const hasApprove = await approve.isVisible().catch(() => false);
      if (hasApprove) {
        await approve.click();
        await page.waitForTimeout(800);
      }
    });

    await page.screenshot({ path: 'tmp/playwright-family-heavy-final.png', fullPage: true });
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  const payload = {
    ok: failed.length === 0,
    parentEmail,
    kidName,
    total: results.length,
    failed: failed.length,
    results,
  };
  fs.writeFileSync('tmp/family-heavy-state.json', JSON.stringify({
    parentEmail,
    parentPassword,
    kidName,
    kidPin,
    kidTaskTitle,
  }, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
