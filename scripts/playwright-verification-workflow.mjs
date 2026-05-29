import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

function unique(prefix) {
  return `${prefix}_${Date.now()}`;
}

async function step(results, name, fn) {
  try {
    await fn();
    results.push({ step: name, ok: true });
  } catch (error) {
    results.push({ step: name, ok: false, error: String(error?.message || error) });
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const results = [];

  const email = `${unique('pw_verify')}@example.com`;
  const password = 'pass1234';
  const taskTitle = unique('VerifyTask');
  const homeworkTitle = unique('VerifyHomework');

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });

    await step(results, 'Register parent', async () => {
      await page.getByText('Need to register?').first().click();
      await page.getByPlaceholder('Parent Name').fill('Verification Parent');
      await page.getByPlaceholder('Parent Email or Username').fill(email);
      await page.getByPlaceholder('Parent Password (Optional for Kids)').fill(password);
      await page.getByRole('button', { name: 'Register Parent' }).click();
    });

    await step(results, 'Bypass onboarding if shown', async () => {
      const ground = page.getByRole('button', { name: 'Ground Control' }).first();
      if (await ground.isVisible().catch(() => false)) {
        await ground.click();
        await page.getByRole('button', { name: 'Board Station' }).click();
      }
      await page.getByRole('button', { name: 'Tasks' }).first().waitFor({ timeout: 20000 });
    });

    await step(results, 'Task modal supports template and save on mobile', async () => {
      await page.getByRole('button', { name: 'Tasks' }).first().click();
      await page.getByRole('button', { name: 'NEW OBJECTIVE' }).click();
      await page.getByPlaceholder('e.g. Navigation Check').fill(taskTitle);
      await page.getByRole('button', { name: '+ Room Cleanup' }).click();
      const taskQuestions = page.getByPlaceholder('One question per line.\nExample:\nAre clothes in the hamper?\nIs the floor clean?');
      await taskQuestions.waitFor({ timeout: 10000 });
      const text = await taskQuestions.inputValue();
      if (!text.includes('Are all clothes in the hamper?')) throw new Error('Task template text missing');

      await page.locator('.max-h-\\[90vh\\]').evaluate((node) => { node.scrollTop = node.scrollHeight; });
      await page.getByRole('button', { name: 'Launch' }).click();
      await page.getByText(taskTitle).first().waitFor({ timeout: 15000 });
    });

    await step(results, 'Homework modal supports template and save on mobile', async () => {
      await page.getByRole('button', { name: 'Homework' }).first().click();
      await page.getByRole('button', { name: 'Add' }).first().click();
      await page.getByPlaceholder('Title').fill(homeworkTitle);
      await page.getByPlaceholder('Subject').fill('Math');
      const due = new Date();
      due.setDate(due.getDate() + 2);
      await page.locator('input[type="date"]').first().fill(due.toISOString().slice(0, 10));
      await page.getByRole('button', { name: '+ Workbook' }).click();
      const homeworkQuestions = page.getByPlaceholder('Optional completion questions (one per line)\nExample: Which workbook did you use?\nWhat pages did you complete?');
      const hwText = await homeworkQuestions.inputValue();
      if (!hwText.includes('Which workbook did you use?')) throw new Error('Homework template text missing');

      await page.getByRole('dialog').evaluate((node) => { node.scrollTop = node.scrollHeight; });
      await page.getByRole('button', { name: 'Save' }).first().click();
      await page.getByText(homeworkTitle).first().waitFor({ timeout: 15000 });
    });

    await page.screenshot({ path: 'tmp/playwright-verification-workflow-final.png', fullPage: true });
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  const payload = { ok: failed.length === 0, failed: failed.length, total: results.length, results };
  console.log(JSON.stringify(payload, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
