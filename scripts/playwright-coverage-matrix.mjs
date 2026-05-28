import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

function unique(prefix) {
  return `${prefix}_${Date.now()}`;
}

async function step(results, name, fn) {
  try {
    await fn();
    results.push({ step: name, ok: true });
  } catch (e) {
    results.push({ step: name, ok: false, error: String(e?.message || e) });
  }
}

async function dismiss(page) {
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.getByRole('button', { name: /^Cancel$|^Abort$|^Close$/i }).first().click({ timeout: 500 }).catch(() => {});
    await page.waitForTimeout(120);
  }
}

async function loginParent(page, email, password) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('Parent Email or Username').fill(email);
  await page.getByPlaceholder('Parent Password (Optional for Kids)').fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await page.getByRole('button', { name: /^Tasks$/i }).first().waitFor({ timeout: 20000 });
}

async function kidLogin(page, parentEmail, kidName, pin) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('Parent Email or Username').fill(parentEmail);
  await page.getByRole('button', { name: /find my account/i }).click();
  await page.getByRole('button', { name: new RegExp(kidName, 'i') }).first().click();
  for (const d of pin.split('')) {
    await page.getByRole('button', { name: new RegExp(`^${d}$`) }).click();
  }
  await page.getByRole('button', { name: /let's go/i }).click();
}

async function setPinAndLock(page, pin) {
  await page.getByRole('button', { name: /settings/i }).first().click();
  await page.getByText(/Family Settings/i).first().waitFor();
  await page.getByRole('button', { name: /change pin/i }).click();
  await page.locator('input[placeholder="4-digit PIN"]').fill(pin);
  await page.getByRole('button', { name: /save settings/i }).click();
  await page.getByRole('button', { name: /settings/i }).first().click();
  await page.getByRole('button', { name: /lock display now/i }).click();
  await page.getByText(/Display Locked/i).waitFor({ timeout: 10000 });
}

async function enterOverlayPin(page, pin) {
  for (const d of pin.split('')) {
    await page.getByRole('button', { name: new RegExp(`^${d}$`) }).click();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const results = [];

  const parentEmail = `${unique('cov_parent')}@example.com`;
  const parentPassword = 'pass1234';
  const kidA = 'Ava';
  const kidB = 'Ben';
  const kidPin = '1234';
  const taskA = unique('TaskA');
  const taskB = unique('TaskB');
  const taskAll = unique('TaskAll');
  const pin = '2468';

  await step(results, 'Register parent', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByText(/Need to register/i).first().click();
    await page.getByPlaceholder('Parent Name').fill('Coverage Parent');
    await page.getByPlaceholder('Parent Email or Username').fill(parentEmail);
    await page.getByPlaceholder('Parent Password (Optional for Kids)').fill(parentPassword);
    await page.getByRole('button', { name: /register/i }).click();
    const ground = page.getByRole('button', { name: /ground control/i }).first();
    if (await ground.isVisible().catch(() => false)) {
      await ground.click();
      await page.getByRole('button', { name: /board station/i }).click();
    }
    await page.getByRole('button', { name: /^Tasks$/i }).first().waitFor({ timeout: 20000 });
  });

  await step(results, 'Add two kids', async () => {
    await dismiss(page);
    await page.getByRole('button', { name: /^Tasks$/i }).first().click();
    await page.getByPlaceholder('New Cadet Name').fill(kidA);
    await page.getByPlaceholder(/4-Digit Identity Key/i).fill(kidPin);
    await page.getByRole('button', { name: /commission cadet/i }).click();
    await page.getByPlaceholder('New Cadet Name').fill(kidB);
    await page.getByPlaceholder(/4-Digit Identity Key/i).fill(kidPin);
    await page.getByRole('button', { name: /commission cadet/i }).click();
    await page.getByText(new RegExp(kidA, 'i')).first().waitFor();
    await page.getByText(new RegExp(kidB, 'i')).first().waitFor();
  });

  await step(results, 'Create kid-specific/all tasks', async () => {
    await dismiss(page);
    await page.getByRole('button', { name: /^Tasks$/i }).first().click();
    const createTask = async (title, assignee) => {
      await page.getByRole('button', { name: /new objective/i }).click();
      await page.getByPlaceholder(/Navigation Check/i).fill(title);
      await page.locator('select').first().selectOption({ label: assignee });
      await page.getByRole('button', { name: /^launch$/i }).click();
      await page.getByText(title).first().waitFor({ timeout: 10000 });
    };
    await createTask(taskA, kidA);
    await createTask(taskB, kidB);
    await createTask(taskAll, 'Up for Grabs (All Kids)');
  });

  await step(results, 'Lock/unlock wrong+correct PIN', async () => {
    await dismiss(page);
    await setPinAndLock(page, pin);
    await enterOverlayPin(page, '0000');
    await page.getByText(/Incorrect PIN/i).waitFor({ timeout: 10000 });
    await enterOverlayPin(page, pin);
    await page.getByText(/Display Locked/i).waitFor({ state: 'hidden', timeout: 10000 });
  });

  await step(results, 'Kid permissions and visibility', async () => {
    await page.getByRole('button', { name: /log out/i }).click();
    await kidLogin(page, parentEmail, kidA, kidPin);
    await dismiss(page);
    await page.getByRole('button', { name: /^Tasks$/i }).first().click().catch(() => {});
    await page.getByText(new RegExp(taskA)).first().waitFor({ timeout: 15000 });
    await page.getByText(new RegExp(taskAll)).first().waitFor({ timeout: 15000 });
    const seesTaskB = await page.getByText(new RegExp(taskB)).first().isVisible().catch(() => false);
    if (seesTaskB) throw new Error('Kid A can see Kid B task');
    const hasSettings = await page.getByRole('button', { name: /settings/i }).first().isVisible().catch(() => false);
    if (hasSettings) throw new Error('Kid can access parent settings');
  });

  await step(results, 'Kid completes task for parent review', async () => {
    await dismiss(page);
    await page.getByRole('button', { name: /^Tasks$/i }).first().click().catch(() => {});
    const taskCard = page.locator('div', { hasText: taskA }).first();
    await taskCard.waitFor({ timeout: 10000 });
    await taskCard.getByRole('button').first().click({ force: true });
  });

  await step(results, 'Parent sees pending completion', async () => {
    await dismiss(page);
    await page.getByRole('button', { name: /log out/i }).click();
    await loginParent(page, parentEmail, parentPassword);
    const approve = page.getByRole('button', { name: /approve/i }).first();
    const visible = await approve.isVisible().catch(() => false);
    if (!visible) throw new Error('No pending completion visible for parent');
  });

  await page.screenshot({ path: 'tmp/playwright-coverage-matrix-final.png', fullPage: true });
  await browser.close();

  const payload = { ok: results.every((r) => r.ok), parentEmail, parentPassword, kidPin, taskA, results };
  fs.writeFileSync('tmp/coverage-matrix-state.json', JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(payload.ok ? 0 : 1);
}

main();
