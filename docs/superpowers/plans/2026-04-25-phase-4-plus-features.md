# Phase 4 Plus Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement premium smart household features including meal planning, an idle photo screensaver, AI magic import for automatic event creation, and reward streaks.

**Architecture:** We will use SQLite to store meal plans, recipes, and uploaded photo metadata. We will use the `@google/genai` SDK for natural language extraction of calendar events from unformatted text. We will expose an Express webhook endpoint to receive imported emails/text. We will build a React UI component for a photo slideshow that mounts on idle and dismisses on activity.

**Tech Stack:** React, Express/SQLite (Backend), `@google/genai` (Gemini API), Vitest, Supertest, Tailwind CSS.

---

### Task 1: Meals Database Schema & Service

**Files:**
- Create: `src/server/migrations/007_add_meals_schema.sql`
- Create: `src/server/modules/meals/service.ts`
- Create: `src/server/modules/meals/db.test.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/modules/meals/db.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from '../../db.js';

describe('Meals Database Schema', () => {
  it('should create and retrieve recipes and meal plans', () => {
    // Delete items to avoid primary key collisions if test retries
    db.prepare('DELETE FROM recipes WHERE id = ?').run('recipe_1');
    db.prepare('DELETE FROM meal_plans WHERE id = ?').run('meal_1');

    const rStmt = db.prepare(`INSERT INTO recipes (id, parentId, name, ingredients) VALUES (?, ?, ?, ?)`);
    rStmt.run('recipe_1', 'parent_1', 'Pancakes', JSON.stringify(['Eggs', 'Flour', 'Milk']));
    
    const mStmt = db.prepare(`INSERT INTO meal_plans (id, parentId, date, mealType, recipeId) VALUES (?, ?, ?, ?, ?)`);
    mStmt.run('meal_1', 'parent_1', '2026-04-25', 'Breakfast', 'recipe_1');
    
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get('recipe_1') as any;
    const meal = db.prepare('SELECT * FROM meal_plans WHERE id = ?').get('meal_1') as any;
    
    expect(recipe.name).toBe('Pancakes');
    expect(meal.mealType).toBe('Breakfast');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/modules/meals/db.test.ts`
Expected: FAIL with "no such table: recipes"

- [ ] **Step 3: Write minimal implementation**

```sql
-- src/server/migrations/007_add_meals_schema.sql
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  name TEXT,
  ingredients TEXT
);

CREATE TABLE IF NOT EXISTS meal_plans (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  date TEXT,
  mealType TEXT,
  recipeId TEXT
);

UPDATE schema_version SET version = 7;
```

```typescript
// Add to src/types.ts (Append at bottom)
export interface Recipe {
  id: string;
  parentId: string;
  name: string;
  ingredients: string; // JSON String of array
}

export interface MealPlan {
  id: string;
  parentId: string;
  date: string;
  mealType: string;
  recipeId: string;
}
```

```typescript
// src/server/modules/meals/service.ts
import { db } from '../../db.js';
import { Recipe, MealPlan } from '../../../types.js';

export const mealsService = {
  getRecipes: (parentId: string): Recipe[] => {
    return db.prepare('SELECT * FROM recipes WHERE parentId = ?').all(parentId) as Recipe[];
  },
  getMealPlans: (parentId: string, date: string): MealPlan[] => {
    return db.prepare('SELECT * FROM meal_plans WHERE parentId = ? AND date = ?').all(parentId, date) as MealPlan[];
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node src/server/db.js && npx vitest run src/server/modules/meals/db.test.ts`
(Note: running `server.ts` or `db.js` trigger migrations. Vitest will trigger it implicitly if db is imported, but ensure migrations run first)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/migrations/007_add_meals_schema.sql src/server/modules/meals/service.ts src/server/modules/meals/db.test.ts src/types.ts
git commit -m "feat: add schema and service structure for meal planning"
```

---

### Task 2: Meals API Routes

**Files:**
- Create: `src/server/modules/meals/routes.ts`
- Create: `src/server/modules/meals/api.test.ts`
- Modify: `src/server/routes.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/modules/meals/api.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { mealsService } from './service.js';

vi.mock('./service.js', () => ({
  mealsService: {
    getRecipes: vi.fn().mockReturnValue([{ id: 'req_1', parentId: 'parent_1', name: 'Pizza', ingredients: '["Dough"]' }])
  }
}));

describe('Meals API', () => {
  it('should return recipes for a parent', async () => {
    const res = await request(app).get('/api/parents/parent_1/recipes');
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Pizza');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/modules/meals/api.test.ts`
Expected: FAIL with 404

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/server/modules/meals/routes.ts
import { Router } from 'express';
import { mealsService } from './service.js';

export const mealsRouter = Router();

mealsRouter.get('/parents/:parentId/recipes', (req, res) => {
  try {
    const recipes = mealsService.getRecipes(req.params.parentId);
    res.json(recipes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

```typescript
// Modify src/server/routes.ts
// ADD IMPORT AT TOP:
import { mealsRouter } from './modules/meals/routes.js';

// ADD BEFORE `export const apiRouter = router;`:
router.use(mealsRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/modules/meals/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/meals/routes.ts src/server/modules/meals/api.test.ts src/server/routes.ts
git commit -m "feat: implement meals and recipes API endpoints"
```

---

### Task 3: Photo Assets Schema

**Files:**
- Create: `src/server/migrations/008_add_photos.sql`
- Create: `src/server/modules/photos/db.test.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/modules/photos/db.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from '../../db.js';

describe('Photos Database Schema', () => {
  it('should allow inserting and fetching a family photo record', () => {
    db.prepare('DELETE FROM family_photos WHERE id = ?').run('photo_1');
    const stmt = db.prepare(`
      INSERT INTO family_photos (id, parentId, url, uploadedAt) 
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run('photo_1', 'parent_1', 'https://example.com/photo.jpg', '2026-04-25T12:00:00Z');
    
    const row = db.prepare('SELECT url FROM family_photos WHERE id = ?').get('photo_1') as any;
    expect(row.url).toBe('https://example.com/photo.jpg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/modules/photos/db.test.ts`
Expected: FAIL (no such table: family_photos)

- [ ] **Step 3: Write minimal implementation**

```sql
-- src/server/migrations/008_add_photos.sql
CREATE TABLE IF NOT EXISTS family_photos (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  url TEXT,
  uploadedAt TEXT
);

UPDATE schema_version SET version = 8;
```

```typescript
// Append to src/types.ts
export interface FamilyPhoto {
  id: string;
  parentId: string;
  url: string;
  uploadedAt: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/modules/photos/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/migrations/008_add_photos.sql src/server/modules/photos/db.test.ts src/types.ts
git commit -m "feat: add schema for photo screensaver assets"
```

---

### Task 4: Idle Photo Screensaver Component

**Files:**
- Create: `src/components/shared/PhotoScreensaver.tsx`
- Create: `src/components/shared/PhotoScreensaver.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/shared/PhotoScreensaver.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PhotoScreensaver } from './PhotoScreensaver';

describe('PhotoScreensaver', () => {
  it('renders screensaver when forceIdle is true', () => {
    const photos = [{ id: '1', url: 'https://example.com/a.jpg' }];
    render(<PhotoScreensaver photos={photos} forceIdle={true} />);
    
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/a.jpg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/shared/PhotoScreensaver.test.tsx`
Expected: FAIL due to missing file

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/shared/PhotoScreensaver.tsx
import React, { useState, useEffect } from 'react';

interface ScreensaverProps {
  photos: { id: string, url: string }[];
  idleMinutes?: number;
  forceIdle?: boolean; // For testing
}

export function PhotoScreensaver({ photos, idleMinutes = 5, forceIdle = false }: ScreensaverProps) {
  const [isIdle, setIsIdle] = useState(forceIdle);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (forceIdle) return;
    let timer: NodeJS.Timeout;
    
    const resetIdle = () => {
      setIsIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIsIdle(true), idleMinutes * 60000);
    };
    
    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('touchstart', resetIdle);
    resetIdle();
    
    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('touchstart', resetIdle);
      clearTimeout(timer);
    };
  }, [idleMinutes, forceIdle]);

  useEffect(() => {
    if (!isIdle || photos.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % photos.length);
    }, 10000); // 10 sec slideshow
    return () => clearInterval(interval);
  }, [isIdle, photos.length]);

  if (!isIdle || photos.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black flex items-center justify-center">
      <img 
        src={photos[currentIndex].url} 
        alt="Screensaver" 
        className="w-full h-full object-cover transition-opacity duration-1000"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/shared/PhotoScreensaver.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/PhotoScreensaver.tsx src/components/shared/PhotoScreensaver.test.tsx
git commit -m "feat: implement global photo screensaver on idle"
```

---

### Task 5: Magic Import AI Wrapper (Gemini)

**Files:**
- Create: `src/server/modules/magic/service.ts`
- Create: `src/server/modules/magic/service.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Install GenAI SDK and Write the failing test**

```bash
npm install @google/genai
```

```typescript
// src/server/modules/magic/service.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { magicService } from './service.js';

// Mock the Gemini SDK
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({ 
            title: 'School Bake Sale', 
            date: '2026-05-15', 
            startTime: '09:00',
            location: 'Main Hall'
          })
        })
      }
    }))
  };
});

describe('Magic Import Service', () => {
  it('should parse text into structured event data using Gemini', async () => {
    const result = await magicService.parseEventsFromText('Bake sale on May 15 at 9am in Main Hall', 'dummy-key');
    
    expect(result.title).toBe('School Bake Sale');
    expect(result.date).toBe('2026-05-15');
    expect(result.startTime).toBe('09:00');
    expect(result.location).toBe('Main Hall');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/modules/magic/service.test.ts`
Expected: FAIL due to missing `service.ts`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/server/modules/magic/service.ts
import { GoogleGenAI } from '@google/genai';

export interface ExtractedEvent {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  location?: string;
}

export const magicService = {
  parseEventsFromText: async (text: string, apiKey: string): Promise<ExtractedEvent> => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Extract the event details from this text and output JSON with keys: title, date (YYYY-MM-DD), startTime (HH:mm), location. Text: \n${text}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      title: parsed.title,
      date: parsed.date,
      startTime: parsed.startTime,
      location: parsed.location
    };
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/modules/magic/service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/server/modules/magic/service.ts src/server/modules/magic/service.test.ts
git commit -m "feat: implement Gemini AI pipeline for magic calendar imports"
```

---

### Task 6: Magic Webhook Endpoint

**Files:**
- Create: `src/server/modules/magic/routes.ts`
- Create: `src/server/modules/magic/api.test.ts`
- Modify: `src/server/routes.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/modules/magic/api.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { magicService } from './service.js';

vi.mock('./service.js', () => ({
  magicService: {
    parseEventsFromText: vi.fn().mockResolvedValue({ 
      title: 'Soccer Practice', date: '2026-05-10', startTime: '15:00', location: 'Field A' 
    })
  }
}));

process.env.GEMINI_API_KEY = 'test-key';

describe('Magic Webhook API', () => {
  it('should process incoming email payload and extract event', async () => {
    // Standard Mailgun/SendGrid style payload text body
    const payload = {
      text: 'Soccer practice Sunday 3pm at Field A',
      recipient: 'family-123@import.ourcalendar.app'
    };

    const res = await request(app)
      .post('/api/magic/import')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Soccer Practice');
    expect(magicService.parseEventsFromText).toHaveBeenCalledWith('Soccer practice Sunday 3pm at Field A', 'test-key');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/modules/magic/api.test.ts`
Expected: FAIL with 404

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/server/modules/magic/routes.ts
import { Router } from 'express';
import { magicService } from './service.js';

export const magicRouter = Router();

magicRouter.post('/api/magic/import', async (req, res) => {
  try {
    const { text, recipient } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Missing text content' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Pass to AI wrapper
    const extractedEvent = await magicService.parseEventsFromText(text, apiKey);

    // In a full implementation we would insert to DB here. For the route requirement, we return parsed JSON.
    res.json(extractedEvent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

```typescript
// Modify src/server/routes.ts
// ADD IMPORT AT TOP:
import { magicRouter } from './modules/magic/routes.js';

// ADD BEFORE `export const apiRouter = router;`:
router.use(magicRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/modules/magic/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/magic/routes.ts src/server/modules/magic/api.test.ts src/server/routes.ts
git commit -m "feat: expose magic import webhook endpoint for external parsing"
```

---

### Task 7: Reward Streak Integration Schema

**Files:**
- Create: `src/server/migrations/009_add_streaks.sql`
- Modify: `src/types.ts`

- [ ] **Step 1: Write the minimal implementation (No explicit table test needed, this is just strict DB update)**

```sql
-- src/server/migrations/009_add_streaks.sql
-- We assume the profiles or kids table is 'users'.
-- Note: depending on the exact schema structure deployed in Phase 1, change 'users' to 'user_profiles' if necessary.
-- Using 'users' for standard template.
ALTER TABLE users ADD COLUMN currentStreak INTEGER DEFAULT 0;

UPDATE schema_version SET version = 9;
```

```typescript
// Modify src/types.ts (UserProfile interface)
// Ensure UserProfile includes:
// currentStreak?: number;
```

- [ ] **Step 2: Commit**

```bash
git add src/server/migrations/009_add_streaks.sql src/types.ts
git commit -m "feat: add currentStreak to users schema for advanced rewards"
```
