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
  const kidA = unique('Ava');
  const kidB = unique('Ben');
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
    const cadetForm = page.locator('form', { has: page.getByRole('button', { name: /commission cadet/i }) }).first();
    await cadetForm.waitFor({ timeout: 15000 });
    const nameInput = cadetForm.getByPlaceholder('New Cadet Name');
    const pinInput = cadetForm.getByPlaceholder(/4-Digit Identity Key/i);
    await nameInput.fill(kidA);
    await pinInput.fill(kidPin);
    await cadetForm.getByRole('button', { name: /commission cadet/i }).click();
    await page.waitForTimeout(800);
    await nameInput.fill(kidB);
    await pinInput.fill(kidPin);
    await cadetForm.getByRole('button', { name: /commission cadet/i }).click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /new objective/i }).click();
    const assigneeSelect = page.locator('select').first();
    await assigneeSelect.waitFor({ timeout: 10000 });
    const labels = await assigneeSelect.locator('option').allTextContents();
    await page.getByRole('button', { name: /^abort$/i }).click();
    if (!labels.some((text) => text.includes(kidA)) || !labels.some((text) => text.includes(kidB))) {
      throw new Error('Newly added kids are not available in assignee list');
    }
  });

  await step(results, 'Create kid-specific/all tasks', async () => {
    await dismiss(page);
    await page.getByRole('button', { name: /^Tasks$/i }).first().click();
    const createTask = async (title, assignee) => {
      await page.getByRole('button', { name: /new objective/i }).click();
      await page.getByPlaceholder(/Navigation Check/i).fill(title);
      await page.locator('select').first().waitFor({ timeout: 10000 });
      const selectedValue = await page.locator('select').first().evaluate((el, label) => {
        const select = el;
        const options = Array.from(select.options);
        const matched = options.find((opt) => (opt.textContent || '').includes(label));
        return matched?.value || null;
      }, assignee);
      if (!selectedValue) throw new Error(`Assignee option missing: ${assignee}`);
      await page.locator('select').first().selectOption(selectedValue);
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
    await page.getByRole('button', { name: /^all$/i }).first().click().catch(() => {});
    await page.getByRole('button', { name: /^Tasks$/i }).first().click().catch(() => {});
    await page.getByText(new RegExp(taskA)).first().waitFor({ timeout: 15000 });
    await page.getByText(new RegExp(taskAll)).first().waitFor({ timeout: 15000 });
    const seesTaskB = await page.getByText(new RegExp(taskB)).first().isVisible().catch(() => false);
    if (seesTaskB) throw new Error('Kid A can see Kid B task');
    await page.getByRole('button', { name: /settings/i }).first().click().catch(() => {});
    const parentSettingsVisible = await page.getByText(/Family Settings/i).first().isVisible().catch(() => false);
    if (parentSettingsVisible) throw new Error('Kid can access parent settings');
  });

  await step(results, 'Kid completes task for parent review', async () => {
    await dismiss(page);
    await page.getByRole('button', { name: /^Tasks$/i }).first().click().catch(() => {});
    const taskCard = page.locator('div', { hasText: taskA }).first();
    await taskCard.waitFor({ timeout: 10000 });
    await taskCard.locator('button').first().click({ force: true });
    const confirm = page.getByRole('button', { name: /yes!|\+.*xp/i }).last();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    }
    const statusVisible = await Promise.race([
      page.getByText(/Pending Approval/i).first().waitFor({ timeout: 12000 }).then(() => true).catch(() => false),
      page.getByText(/Completed/i).first().waitFor({ timeout: 12000 }).then(() => true).catch(() => false),
    ]);
    if (!statusVisible) {
      throw new Error('Task completion status did not update');
    }
  });

  await step(results, 'Parent sees pending completion', async () => {
    await page.evaluate(() => localStorage.removeItem('kidtasker_token'));
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await loginParent(page, parentEmail, parentPassword);
    await page.getByRole('button', { name: /^Tasks$/i }).first().click();
    await page.waitForTimeout(800);
    const approve = page.getByRole('button', { name: /approve/i }).first();
    await approve.waitFor({ timeout: 15000 });
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
