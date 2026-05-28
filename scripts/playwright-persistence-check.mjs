import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

async function main() {
  const state = JSON.parse(fs.readFileSync('tmp/family-heavy-state.json', 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('Parent Email or Username').fill(state.parentEmail);
    await page.getByPlaceholder('Parent Password (Optional for Kids)').fill(state.parentPassword);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.getByRole('button', { name: /^Tasks$/i }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: /^Tasks$/i }).first().click();
    await page.getByText(new RegExp(state.kidTaskTitle)).first().waitFor({ timeout: 15000 });
    console.log(JSON.stringify({ ok: true, task: state.kidTaskTitle }, null, 2));
  } finally {
    await browser.close();
  }
}

main();
