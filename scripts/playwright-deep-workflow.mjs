import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

function unique(prefix) {
  return `${prefix}_${Date.now()}`;
}

async function maybeClick(page, locator) {
  if (await locator.isVisible().catch(() => false)) {
    await locator.click().catch(() => {});
    return true;
  }
  return false;
}

async function runStep(results, name, fn) {
  try {
    await fn();
    results.push({ step: name, ok: true });
  } catch (e) {
    results.push({ step: name, ok: false, error: String(e?.message || e) });
  }
}

async function closeOverlays(page) {
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Escape').catch(() => {});
    const closed =
      (await maybeClick(page, page.getByRole('button', { name: /^Abort$/i }).first())) ||
      (await maybeClick(page, page.getByRole('button', { name: /^Cancel$/i }).first())) ||
      (await maybeClick(page, page.getByRole('button', { name: /^Close$/i }).first()));
    if (!closed) break;
    await page.waitForTimeout(200);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const results = [];

  const email = `${unique('pw_deep')}@example.com`;
  const password = 'pass1234';
  const parentName = 'Deep Workflow Parent';
  const taskTitle = unique('Task');
  const eventTitle = unique('Event');
  const listTitle = unique('Groceries');
  const listItem = unique('Milk');
  const recipeName = unique('Recipe');
  const hwTitle = unique('Homework');

  page.on('pageerror', (err) => {
    results.push({ step: 'pageerror', ok: false, error: err.message });
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });

    await runStep(results, 'Register Parent', async () => {
      await page.getByText(/Need to register/i).first().click();
      await page.getByPlaceholder('Parent Name').fill(parentName);
      await page.getByPlaceholder('Parent Email or Username').fill(email);
      await page.getByPlaceholder('Parent Password (Optional for Kids)').fill(password);
      await page.getByRole('button', { name: /register/i }).click();
    });

    await runStep(results, 'Complete Onboarding If Shown', async () => {
      const ground = page.getByRole('button', { name: /ground control/i }).first();
      if (await ground.isVisible().catch(() => false)) {
        await ground.click();
        await page.getByRole('button', { name: /board station/i }).click();
      }
      await page.getByRole('button', { name: /^Tasks$/i }).first().waitFor({ timeout: 20000 });
    });

    await runStep(results, 'Tasks: Create Task', async () => {
      await closeOverlays(page);
      await page.getByRole('button', { name: /^Tasks$/i }).first().click();
      await page.getByRole('button', { name: /new objective/i }).click();
      await page.getByPlaceholder(/Navigation Check/i).fill(taskTitle);
      await page.getByRole('button', { name: /^launch$/i }).click();
      await page.getByText(taskTitle).first().waitFor({ timeout: 15000 });
    });

    await runStep(results, 'Tasks: Archive Task', async () => {
      await closeOverlays(page);
      const card = page.locator('div', { hasText: taskTitle }).first();
      await card.waitFor({ timeout: 10000 });
      const deleteButton = card.getByRole('button').first();
      await deleteButton.click();
      await page.waitForTimeout(700);
    });

    await runStep(results, 'Calendar: Create Event via Quick Add', async () => {
      await closeOverlays(page);
      await page.getByRole('button', { name: /calendar/i }).first().click();
      await page.getByRole('button', { name: /quick add/i }).first().click();
      await page.getByPlaceholder("What's happening?").fill(eventTitle);
      await page.getByRole('button', { name: /add event/i }).click();
      await page.getByRole('button', { name: /agenda/i }).first().click();
      await page.getByText(eventTitle).first().waitFor({ timeout: 15000 });
    });

    await runStep(results, 'Lists: Create List and Item', async () => {
      await closeOverlays(page);
      await page.getByRole('button', { name: /^Lists$/i }).first().click();
      await page.getByPlaceholder(/New list/i).fill(listTitle);
      await page.locator('form').filter({ has: page.getByPlaceholder(/New list/i) }).getByRole('button').click();
      await page.getByText(listTitle).first().waitFor({ timeout: 10000 });
      await page.getByPlaceholder(/Add item/i).fill(listItem);
      await page.locator('form').filter({ has: page.getByPlaceholder(/Add item/i) }).getByRole('button').click();
      await page.getByText(listItem).first().waitFor({ timeout: 10000 });
    });

    await runStep(results, 'Meals: Create Recipe and Assign Meal', async () => {
      await closeOverlays(page);
      await page.getByRole('button', { name: /meals/i }).first().click();
      await page.getByRole('button', { name: /new/i }).first().click();
      await page.getByPlaceholder(/Spaghetti Bolognese/i).fill(recipeName);
      await page.getByPlaceholder(/Ingredient 1/i).fill('Ingredient A');
      await page.getByRole('button', { name: /save recipe/i }).click();
      await page.getByText(recipeName).first().waitFor({ timeout: 10000 });

      const firstPlus = page.locator('td button').filter({ has: page.locator('svg') }).first();
      await firstPlus.click();
      await page.getByRole('button', { name: recipeName }).first().click();
      await page.waitForTimeout(800);
    });

    await runStep(results, 'Homework: Add and Mark Done', async () => {
      await closeOverlays(page);
      await page.getByRole('button', { name: /^Homework$/i }).first().click();
      await page.getByRole('button', { name: /^Add$/i }).first().click();
      await page.getByPlaceholder(/^Title$/i).fill(hwTitle);
      await page.getByPlaceholder(/^Subject$/i).fill('Math');
      const due = new Date();
      due.setDate(due.getDate() + 2);
      const dueIso = due.toISOString().slice(0, 10);
      await page.locator('input[type="date"]').first().fill(dueIso);
      await page.getByRole('button', { name: /^Save$/i }).first().click();
      await page.getByText(hwTitle).first().waitFor({ timeout: 10000 });
      await page.getByRole('button', { name: /mark done/i }).first().click();
      await page.getByRole('button', { name: /^Done$/i }).first().waitFor({ timeout: 10000 });
    });

    await runStep(results, 'Settings: Open Save Preview', async () => {
      await closeOverlays(page);
      await page.getByRole('button', { name: /settings/i }).first().click();
      await page.getByText(/Family Settings/i).first().waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: /Preview Screensaver/i }).click();
      await page.waitForTimeout(1000);
      await page.keyboard.press('Escape').catch(() => {});
      await maybeClick(page, page.getByRole('button', { name: /Save Settings/i }));
      await page.waitForTimeout(500);
    });

    await page.screenshot({ path: 'tmp/playwright-deep-workflow-final.png', fullPage: true });
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  const payload = {
    ok: failed.length === 0,
    email,
    total: results.length,
    failed: failed.length,
    results,
  };
  console.log(JSON.stringify(payload, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
