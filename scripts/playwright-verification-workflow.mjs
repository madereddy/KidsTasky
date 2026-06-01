import 'dotenv/config';
import { chromium, request as playwrightRequest } from 'playwright';

const BASE_URL = process.env.E2E_BASE_URL || process.env.BASE_URL || 'http://localhost:3010';
const EMAIL = process.env.E2E_PARENT_EMAIL || '';
const PASSWORD = process.env.E2E_PARENT_PASSWORD || '';
const PIN = process.env.E2E_PARENT_PIN || '';
const PREFIX = `E2E_AUTOGEN_${Date.now()}`;

if (!EMAIL || !PASSWORD) {
  console.error('Missing E2E credentials: set E2E_PARENT_EMAIL and E2E_PARENT_PASSWORD in .env');
  process.exit(1);
}

function json(res) {
  return res.text().then((t) => {
    try { return JSON.parse(t || '{}'); } catch { return {}; }
  });
}

async function step(results, name, fn) {
  try {
    await fn();
    results.push({ step: name, ok: true });
  } catch (error) {
    results.push({ step: name, ok: false, error: String(error?.message || error) });
  }
}

async function expectOk(res, context) {
  if (!res.ok()) {
    const body = await json(res);
    throw new Error(`${context} failed: ${res.status()} ${JSON.stringify(body)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(apiCtx, method, path, body) {
  const res = await apiCtx.fetch(path, {
    method,
    data: body,
    headers: body ? { 'content-type': 'application/json' } : undefined,
  });
  return res;
}

async function clickIfVisible(page, candidates) {
  for (const locator of candidates) {
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ force: true });
      return true;
    }
  }
  return false;
}

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function cleanupByPrefix(apiCtx, parentId, prefix, kidId) {
  // Events
  const eventsRes = await api(apiCtx, 'GET', `/api/parents/${parentId}/events`);
  if (eventsRes.ok()) {
    const events = await json(eventsRes);
    for (const e of events.filter((x) => String(x.title || '').startsWith(prefix))) {
      await api(apiCtx, 'DELETE', `/api/events/${e.id}?scope=one`);
    }
  }

  // Homework
  const hwRes = await api(apiCtx, 'GET', `/api/parents/${parentId}/homework`);
  if (hwRes.ok()) {
    const rows = await json(hwRes);
    for (const h of rows.filter((x) => String(x.title || '').startsWith(prefix))) {
      await api(apiCtx, 'DELETE', `/api/homework/${h.id}`);
    }
  }

  // Lists
  const listsRes = await api(apiCtx, 'GET', `/api/parents/${parentId}/lists`);
  if (listsRes.ok()) {
    const lists = await json(listsRes);
    for (const l of lists.filter((x) => String(x.title || '').startsWith(prefix))) {
      await api(apiCtx, 'DELETE', `/api/lists/${l.id}`);
    }
  }

  // Recipes
  const recRes = await api(apiCtx, 'GET', `/api/parents/${parentId}/recipes`);
  if (recRes.ok()) {
    const recipes = await json(recRes);
    for (const r of recipes.filter((x) => String(x.name || '').startsWith(prefix))) {
      await api(apiCtx, 'DELETE', `/api/recipes/${r.id}`);
    }
  }

  // Categories
  const catRes = await api(apiCtx, 'GET', `/api/parents/${parentId}/categories`);
  if (catRes.ok()) {
    const cats = await json(catRes);
    for (const c of cats.filter((x) => String(x.name || '').startsWith(prefix))) {
      await api(apiCtx, 'DELETE', `/api/categories/${c.id}`);
    }
  }

  // Tasks (no hard-delete route; archive generated tasks)
  const tasksRes = await api(apiCtx, 'GET', `/api/parents/${parentId}/tasks`);
  if (tasksRes.ok()) {
    const tasks = await json(tasksRes);
    for (const t of tasks.filter((x) => String(x.title || '').startsWith(prefix))) {
      await api(apiCtx, 'PUT', `/api/tasks/${t.id}/archive`);
    }
  }

  // Completions for today on selected kid (best effort)
  if (kidId) {
    const compRes = await api(apiCtx, 'GET', `/api/kids/${kidId}/completions?dateString=${isoDate(0)}`);
    if (compRes.ok()) {
      const comps = await json(compRes);
      for (const c of comps.filter((x) => String(x.taskTitle || '').startsWith(prefix))) {
        await api(apiCtx, 'DELETE', `/api/completions/${c.id}`);
      }
    }
  }
}

async function main() {
  const results = [];
  const cleanupArtifacts = { mealPlanId: null, originalNote: null, originalSettings: null };

  const apiCtx = await playwrightRequest.newContext({ baseURL: BASE_URL });

  const loginRes = await api(apiCtx, 'POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  await expectOk(loginRes, 'auth login');
  const login = await json(loginRes);
  const token = login?.token;
  const user = login?.user;
  if (!token || !user) throw new Error('Auth response missing token/user');

  const parentId = user.parentId || user.uid;
  const authedApi = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { authorization: `Bearer ${token}` },
  });

  const kidsRes = await api(authedApi, 'GET', `/api/parents/${parentId}/kids`);
  await expectOk(kidsRes, 'get kids');
  const kids = await json(kidsRes);
  const firstKidId = Array.isArray(kids) && kids.length > 0 ? kids[0].uid : null;

  try {
    await step(results, 'Auth me + refresh token validity', async () => {
      const meRes = await api(authedApi, 'GET', '/api/auth/me');
      await expectOk(meRes, 'auth me');
      const me = await json(meRes);
      assert(me?.user?.uid === user.uid, 'auth/me uid mismatch');

      const refreshRes = await api(authedApi, 'POST', '/api/auth/refresh');
      await expectOk(refreshRes, 'auth refresh');
      const refreshed = await json(refreshRes);
      assert(typeof refreshed?.token === 'string' && refreshed.token.length > 20, 'refresh token missing');

      const refreshedApi = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: { authorization: `Bearer ${refreshed.token}` },
      });
      const me2Res = await api(refreshedApi, 'GET', '/api/auth/me');
      await expectOk(me2Res, 'auth me with refreshed token');
      await refreshedApi.dispose();
    });

    await step(results, 'Pre-clean generated test data', async () => {
      await cleanupByPrefix(authedApi, parentId, 'E2E_AUTOGEN_', firstKidId);
    });

    await step(results, 'Unlock parent workspace if locked', async () => {
      const settingsRes = await api(authedApi, 'GET', `/api/settings/${parentId}`);
      await expectOk(settingsRes, 'get settings');
      const settings = await json(settingsRes);
      cleanupArtifacts.originalSettings = settings;
      if (settings?.isLocked) {
        if (!PIN) throw new Error('Workspace is locked and E2E_PARENT_PIN is not configured');
        const unlockRes = await api(authedApi, 'POST', `/api/settings/${parentId}/unlock`, { pin: PIN });
        await expectOk(unlockRes, 'unlock settings');
      }
    });

    await step(results, 'Settings roundtrip persists and restores safely', async () => {
      const before = cleanupArtifacts.originalSettings || {};
      const updated = {
        timezone: 'America/New_York',
        temperatureUnit: 'fahrenheit',
        timeFormat: '24h',
        sleepStart: '20:30',
        sleepEnd: '06:30',
      };
      const putRes = await api(authedApi, 'PUT', `/api/settings/${parentId}`, updated);
      await expectOk(putRes, 'update settings');
      const readRes = await api(authedApi, 'GET', `/api/settings/${parentId}`);
      await expectOk(readRes, 'read updated settings');
      const after = await json(readRes);
      assert(String(after?.timezone) === 'America/New_York', 'settings timezone mismatch');
      assert(String(after?.temperatureUnit) === 'fahrenheit', 'settings temperature unit mismatch');
      assert(String(after?.timeFormat) === '24h', 'settings time format mismatch');
    });

    await step(results, 'Lock enforcement blocks mutation and unlock restores writes', async () => {
      const lockRes = await api(authedApi, 'PUT', `/api/settings/${parentId}`, { isLocked: true });
      await expectOk(lockRes, 'persist locked=true');
      try {
        const start = Date.now() + 2 * 60 * 60 * 1000;
        const blockedCreate = await api(authedApi, 'POST', '/api/events', {
          title: `${PREFIX}_LockCheck_Event`,
          startTime: start,
          endTime: start + 30 * 60 * 1000,
          color: 'red',
        });
        assert(!blockedCreate.ok(), `Expected locked mutation failure, got ${blockedCreate.status()}`);
      } finally {
        const unlockRes = await api(authedApi, 'PUT', `/api/settings/${parentId}`, { isLocked: false });
        await expectOk(unlockRes, 'persist locked=false');
      }
    });

    await step(results, 'Family note roundtrip and restore snapshot', async () => {
      const getRes = await api(authedApi, 'GET', `/api/family-notes/${parentId}`);
      await expectOk(getRes, 'get family note');
      const current = await json(getRes);
      cleanupArtifacts.originalNote = current?.content ?? '';

      const content = `${PREFIX} note verification ${new Date().toISOString()}`;
      const putRes = await api(authedApi, 'PUT', `/api/family-notes/${parentId}`, { content });
      await expectOk(putRes, 'set family note');
      const readRes = await api(authedApi, 'GET', `/api/family-notes/${parentId}`);
      await expectOk(readRes, 'read family note');
      const reread = await json(readRes);
      assert(String(reread?.content || '') === content, 'family note mismatch');
    });

    await step(results, 'UI smoke with authenticated Chrome context', async () => {
      let browser;
      try {
        browser = await chromium.launch({ channel: 'chrome', headless: true });
      } catch {
        browser = await chromium.launch({ headless: true });
      }
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      await context.addInitScript((tok) => localStorage.setItem('kidtasker_token', tok), token);
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90000 });

      const navCandidates = ['Home', 'Tasks', 'Calendar', 'Lists', 'Meals'];
      for (const label of navCandidates) {
        await clickIfVisible(page, [
          page.getByRole('button', { name: new RegExp(label, 'i') }).first(),
          page.locator(`button:has-text("${label}")`).first(),
        ]);
      }

      await page.screenshot({ path: 'tmp/e2e-authenticated-ui.png', fullPage: true });
      await browser.close();
    });

    await step(results, 'Category create/update/delete cycle', async () => {
      const createRes = await api(authedApi, 'POST', '/api/categories', {
        name: `${PREFIX}_Category`,
        icon: 'star',
        color: '#22c55e',
        parentId,
      });
      await expectOk(createRes, 'create category');
      const { id } = await json(createRes);
      if (!id) throw new Error('Category create returned no id');

      const updRes = await api(authedApi, 'PUT', `/api/categories/${id}`, {
        name: `${PREFIX}_Category_Updated`,
        icon: 'sparkles',
        color: '#0ea5e9',
        parentId,
      });
      await expectOk(updRes, 'update category');

      const delRes = await api(authedApi, 'DELETE', `/api/categories/${id}`);
      await expectOk(delRes, 'delete category');
    });

    await step(results, 'Event create/delete cycle', async () => {
      const start = Date.now() + 24 * 60 * 60 * 1000;
      const createRes = await api(authedApi, 'POST', '/api/events', {
        title: `${PREFIX}_Event`,
        description: 'e2e generated',
        startTime: start,
        endTime: start + 60 * 60 * 1000,
        color: 'blue',
      });
      await expectOk(createRes, 'create event');
      const body = await json(createRes);
      const id = Array.isArray(body?.ids) ? body.ids[0] : null;
      if (!id) throw new Error('Event create returned no id');

      const delRes = await api(authedApi, 'DELETE', `/api/events/${id}?scope=one`);
      await expectOk(delRes, 'delete event');
    });

    await step(results, 'Task completion approval transitions (pending->approve/reject)', async () => {
      if (!firstKidId) throw new Error('No kid found in family; task flow requires at least one kid');
      const createRes = await api(authedApi, 'POST', '/api/tasks', {
        title: `${PREFIX}_Task`,
        description: 'e2e generated',
        frequency: 'daily',
        assignedKidId: firstKidId,
        requiresApproval: true,
        completionQuestions: ['Was it completed fully?'],
      });
      await expectOk(createRes, 'create task');
      const { id: taskId } = await json(createRes);
      if (!taskId) throw new Error('Task create returned no id');

      const completeRes1 = await api(authedApi, 'POST', '/api/completions', {
        taskId,
        kidId: firstKidId,
        dateString: isoDate(0),
        count: 1,
        proofAnswers: [{ question: 'Was it completed fully?', answer: 'yes' }],
      });
      await expectOk(completeRes1, 'create completion pending #1');
      const comp1 = await json(completeRes1);
      assert(comp1?.approvalStatus === 'pending', 'completion #1 should be pending');

      const pendingRes1 = await api(authedApi, 'GET', `/api/parents/${parentId}/pending-completions`);
      await expectOk(pendingRes1, 'get pending completions #1');
      const pending1 = await json(pendingRes1);
      assert(Array.isArray(pending1) && pending1.some((x) => x.id === comp1.id), 'pending completion #1 not found');

      const approveRes = await api(authedApi, 'PATCH', `/api/completions/${comp1.id}/approve`, {});
      await expectOk(approveRes, 'approve completion #1');

      const kidComps1Res = await api(authedApi, 'GET', `/api/kids/${firstKidId}/completions?dateString=${isoDate(0)}`);
      await expectOk(kidComps1Res, 'get kid completions #1');
      const kidComps1 = await json(kidComps1Res);
      const approved = Array.isArray(kidComps1) ? kidComps1.find((x) => x.id === comp1.id) : null;
      assert(approved?.approvalStatus === 'approved', 'completion #1 not approved');

      const completeRes2 = await api(authedApi, 'POST', '/api/completions', {
        taskId,
        kidId: firstKidId,
        dateString: isoDate(0),
        count: 2,
        proofAnswers: [{ question: 'Was it completed fully?', answer: 'second run' }],
      });
      await expectOk(completeRes2, 'create completion pending #2');
      const comp2 = await json(completeRes2);
      assert(comp2?.approvalStatus === 'pending', 'completion #2 should be pending');

      const rejectRes = await api(authedApi, 'PATCH', `/api/completions/${comp2.id}/reject`, {});
      await expectOk(rejectRes, 'reject completion #2');
      const kidComps2Res = await api(authedApi, 'GET', `/api/kids/${firstKidId}/completions?dateString=${isoDate(0)}`);
      await expectOk(kidComps2Res, 'get kid completions #2');
      const kidComps2 = await json(kidComps2Res);
      const rejected = Array.isArray(kidComps2) ? kidComps2.find((x) => x.id === comp2.id) : null;
      assert(rejected?.approvalStatus === 'rejected', 'completion #2 not rejected');

      const delComp1Res = await api(authedApi, 'DELETE', `/api/completions/${comp1.id}`);
      await expectOk(delComp1Res, 'delete completion #1');
      const delComp2Res = await api(authedApi, 'DELETE', `/api/completions/${comp2.id}`);
      await expectOk(delComp2Res, 'delete completion #2');

      const archiveRes = await api(authedApi, 'PUT', `/api/tasks/${taskId}/archive`);
      await expectOk(archiveRes, 'archive task');
    });

    await step(results, 'Homework create/update/delete cycle', async () => {
      const createRes = await api(authedApi, 'POST', '/api/homework', {
        title: `${PREFIX}_Homework`,
        subject: 'Math',
        notes: 'e2e generated',
        dueDate: isoDate(2),
        assignedToId: firstKidId,
        recurrence: 'none',
        completionQuestions: ['What did you solve?'],
      });
      await expectOk(createRes, 'create homework');
      const created = await json(createRes);
      if (!created?.id) throw new Error('Homework create returned no id');

      const patchRes = await api(authedApi, 'PATCH', `/api/homework/${created.id}`, {
        subject: 'Science',
      });
      await expectOk(patchRes, 'update homework');

      const delRes = await api(authedApi, 'DELETE', `/api/homework/${created.id}`);
      await expectOk(delRes, 'delete homework');
    });

    await step(results, 'Lists + items create/toggle/delete cycle', async () => {
      const createRes = await api(authedApi, 'POST', '/api/lists', { title: `${PREFIX}_List` });
      await expectOk(createRes, 'create list');
      const list = await json(createRes);
      const listId = list?.id;
      if (!listId) throw new Error('List create returned no id');

      const addItemRes = await api(authedApi, 'POST', `/api/lists/${listId}/items`, { text: `${PREFIX}_Item` });
      await expectOk(addItemRes, 'create list item');
      const item = await json(addItemRes);
      if (!item?.id) throw new Error('List item create returned no id');

      const toggleRes = await api(authedApi, 'PUT', `/api/list-items/${item.id}`, { completed: true });
      await expectOk(toggleRes, 'toggle list item');

      const delItemRes = await api(authedApi, 'DELETE', `/api/list-items/${item.id}`);
      await expectOk(delItemRes, 'delete list item');

      const delListRes = await api(authedApi, 'DELETE', `/api/lists/${listId}`);
      await expectOk(delListRes, 'delete list');
    });

    await step(results, 'Meals recipe + meal-plan create/delete cycle', async () => {
      const createRecipeRes = await api(authedApi, 'POST', '/api/recipes', {
        name: `${PREFIX}_Recipe`,
        ingredients: ['eggs', 'milk'],
      });
      await expectOk(createRecipeRes, 'create recipe');
      const recipe = await json(createRecipeRes);
      if (!recipe?.id) throw new Error('Recipe create returned no id');

      const planDate = isoDate(1);
      const setPlanRes = await api(authedApi, 'POST', '/api/meal-plans', {
        date: planDate,
        mealType: 'dinner',
        recipeId: recipe.id,
      });
      await expectOk(setPlanRes, 'create meal plan');

      const plansRes = await api(authedApi, 'GET', `/api/parents/${parentId}/meal-plans?weekStart=${isoDate(0)}`);
      await expectOk(plansRes, 'get meal plans');
      const plans = await json(plansRes);
      const createdPlan = Array.isArray(plans)
        ? plans.find((p) => p.date === planDate && p.mealType === 'dinner' && p.recipeId === recipe.id)
        : null;
      if (!createdPlan?.id) throw new Error('Created meal plan id not found');
      cleanupArtifacts.mealPlanId = createdPlan.id;

      const delPlanRes = await api(authedApi, 'DELETE', `/api/meal-plans/${createdPlan.id}`);
      await expectOk(delPlanRes, 'delete meal plan');
      cleanupArtifacts.mealPlanId = null;

      const delRecipeRes = await api(authedApi, 'DELETE', `/api/recipes/${recipe.id}`);
      await expectOk(delRecipeRes, 'delete recipe');
    });

    await step(results, 'Post-clean generated test data', async () => {
      if (cleanupArtifacts.mealPlanId) {
        await api(authedApi, 'DELETE', `/api/meal-plans/${cleanupArtifacts.mealPlanId}`);
      }
      await cleanupByPrefix(authedApi, parentId, PREFIX, firstKidId);
      if (cleanupArtifacts.originalNote !== null) {
        await api(authedApi, 'PUT', `/api/family-notes/${parentId}`, { content: cleanupArtifacts.originalNote });
      }
      if (cleanupArtifacts.originalSettings) {
        const restore = {
          timezone: cleanupArtifacts.originalSettings.timezone,
          temperatureUnit: cleanupArtifacts.originalSettings.temperatureUnit,
          timeFormat: cleanupArtifacts.originalSettings.timeFormat,
          sleepStart: cleanupArtifacts.originalSettings.sleepStart,
          sleepEnd: cleanupArtifacts.originalSettings.sleepEnd,
          isLocked: false,
        };
        await api(authedApi, 'PUT', `/api/settings/${parentId}`, restore);
        if (cleanupArtifacts.originalSettings.isLocked) {
          await api(authedApi, 'PUT', `/api/settings/${parentId}`, { isLocked: true });
        }
      }
    });
  } finally {
    await authedApi.dispose();
    await apiCtx.dispose();
  }

  const failed = results.filter((r) => !r.ok);
  const payload = {
    ok: failed.length === 0,
    failed: failed.length,
    total: results.length,
    baseUrl: BASE_URL,
    prefix: PREFIX,
    results,
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
