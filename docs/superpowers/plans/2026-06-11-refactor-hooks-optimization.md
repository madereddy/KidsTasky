# Centralize Next-Up Logic and Optimize Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `calculateNextUp` to a shared utility, parallelize data fetching in controllers, and optimize hook dependencies and state management.

**Architecture:** 
- Move domain logic (`calculateNextUp`) to `src/lib/dateTimePrefs.ts`.
- Refactor `useMissionTodayController.ts` and `useWallHomeController.ts` to use `Promise.all` for waterfalls.
- Use `useMemo` for derived state (`nextUp`) instead of `useEffect` + `useState`.
- Optimize `useEffect` dependencies by using stable primitives (length or joined IDs) instead of `JSON.stringify`.

**Tech Stack:** React, TypeScript, date-fns

---

### Task 1: Centralize `calculateNextUp`

**Files:**
- Modify: `src/lib/dateTimePrefs.ts`
- Modify: `src/hooks/useMissionTodayController.ts`
- Modify: `src/hooks/useWallHomeController.ts`

- [ ] **Step 1: Add `calculateNextUp` to `src/lib/dateTimePrefs.ts`**

```typescript
import { CalendarEvent, UserProfile, NextUpEvent } from '../types';

export const calculateNextUp = (allEvents: CalendarEvent[], familyKids: UserProfile[]): NextUpEvent | null => {
  const now = Date.now();
  // Filter for events that haven't ended yet and are starting soon
  const upcoming = allEvents
    .filter(e => e.endTime > now)
    .sort((a, b) => a.startTime - b.startTime);

  if (upcoming.length === 0) return null;

  const event = upcoming[0];
  const assignedKid = familyKids.find(k => k.uid === event.assignedToId);

  return {
    title: event.title,
    startTime: event.startTime,
    memberName: assignedKid ? assignedKid.name : 'Family',
    memberColor: assignedKid ? (assignedKid.color || '#4F46E5') : (event.color || '#4F46E5')
  };
};
```

- [ ] **Step 2: Update `src/hooks/useMissionTodayController.ts` to use the shared function**
- [ ] **Step 3: Update `src/hooks/useWallHomeController.ts` to use the shared function**
- [ ] **Step 4: Commit**
```bash
git add src/lib/dateTimePrefs.ts src/hooks/useMissionTodayController.ts src/hooks/useWallHomeController.ts
git commit -m "refactor(utils): centralize calculateNextUp logic"
```

### Task 2: Refactor `useMissionTodayController.ts`

**Files:**
- Modify: `src/hooks/useMissionTodayController.ts`

- [ ] **Step 1: Parallelize fetches and remove `nextUp` state/effect**

```typescript
// Inside useMissionTodayController
  const [frequentItems, setFrequentItems] = useState<string[]>([]);
  const [mealData, setMealData] = useState<DailyIntelligence['meal']>(null);

  // ...
  useEffect(() => {
    if (!parentId) return;

    const fetchExtraData = async () => {
      try {
        const [frequent, mealPlans] = await Promise.all([
          listsClientService.getFrequentItems(parentId).catch(() => []),
          mealsClientService.getMealPlans(parentId, today).catch(() => [])
        ]);

        setFrequentItems(frequent);

        const todayMealPlan = mealPlans.find(mp => mp.date === today);
        if (todayMealPlan?.recipeId) {
          const recipes = await mealsClientService.getRecipes(parentId).catch(() => []);
          const recipe = recipes.find(r => r.id === todayMealPlan.recipeId);
          if (recipe) {
             // ... extract mealData logic ...
             setMealData(mealData);
          }
        }
      } catch (error) {
        console.error('Failed to fetch mission today intelligence', error);
      }
    };

    fetchExtraData();
  }, [parentId, today]);

  const nextUp = useMemo(() => calculateNextUp(events, kids), [events, kids]);

  const intelligence = useMemo(() => ({
    nextUp,
    meal: mealData
  }), [nextUp, mealData]);
```

- [ ] **Step 2: Commit**
```bash
git commit -am "refactor(hooks): optimize useMissionTodayController with useMemo and parallel fetches"
```

### Task 3: Refactor `useWallHomeController.ts`

**Files:**
- Modify: `src/hooks/useWallHomeController.ts`

- [ ] **Step 1: Optimize dependencies and parallelize fetches**
- [ ] **Step 2: Commit**
```bash
git commit -am "refactor(hooks): optimize useWallHomeController dependencies and parallelize fetches"
```

### Task 4: Verification

- [ ] **Step 1: Run tests**
Run: `npm test`
- [ ] **Step 2: Verify `calculateNextUp` with a new unit test if none exists**
