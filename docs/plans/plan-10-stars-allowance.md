# Plan 10 — Star Rewards + Allowance Tracking

**Group:** A (no dependencies, start immediately)

---

## Problem

Skylight's kid-motivation model uses stars: each chore is worth N stars, kids earn stars and redeem them for rewards (which can carry a real-money allowance value). KidsTasky has XP + level + badges, but no star layer, no star-per-task values, no allowance amounts on rewards, and no parent ledger to track what's owed. The goal is to add stars alongside XP — they coexist, neither replaces the other.

---

## What Already Exists

- `Task.difficulty` + `XP_REWARDS` constant → XP awarded on completion
- `Reward.xpCost` → kids spend XP to claim rewards
- `ClaimedReward` table → tracks redemptions
- `UserProfile.xp`, `UserProfile.level`, `UserProfile.badges`
- `KidDashboard.tsx` — displays XP bar, streak, badge rack
- `RewardManager.tsx` — parent creates/edits rewards with XP cost
- `src/server/modules/rewards/service.ts` — `claimReward(kidId, rewardId)` (deducts XP)
- `src/server/modules/tasks/service.ts` — `completeTask()` (awards XP)

---

## Database

### Migration `017_add_stars.sql`
Create at `src/server/migrations/017_add_stars.sql`:

```sql
ALTER TABLE users       ADD COLUMN earnedStars INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users       ADD COLUMN spentStars  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks       ADD COLUMN starValue   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rewards     ADD COLUMN starCost    INTEGER;
ALTER TABLE rewards     ADD COLUMN allowanceCents INTEGER;

CREATE TABLE IF NOT EXISTS allowance_ledger (
  id            TEXT PRIMARY KEY,
  kidId         TEXT NOT NULL,
  parentId      TEXT NOT NULL,
  rewardId      TEXT NOT NULL,
  rewardTitle   TEXT NOT NULL,
  amountCents   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending',
  claimedAt     TEXT NOT NULL,
  paidAt        TEXT,
  FOREIGN KEY (kidId) REFERENCES users(uid),
  FOREIGN KEY (rewardId) REFERENCES rewards(id)
);
```

---

## Files to Modify

### `src/types.ts`
Extend types:

```ts
export interface UserProfile {
  // ... existing fields ...
  earnedStars?: number;
  spentStars?: number;
}

export interface Task {
  // ... existing fields ...
  starValue?: number; // default 1
}

export interface Reward {
  // ... existing fields ...
  starCost?: number;
  allowanceCents?: number; // e.g. 250 = $2.50
}

export interface AllowanceEntry {
  id: string;
  kidId: string;
  parentId: string;
  rewardId: string;
  rewardTitle: string;
  amountCents: number;
  status: 'pending' | 'paid';
  claimedAt: string;
  paidAt?: string;
}
```

### `src/server/modules/tasks/service.ts`
In `completeTask()`, alongside XP award, also award stars:

```ts
// After awarding XP:
const task = db.prepare('SELECT starValue FROM tasks WHERE id = ?').get(taskId) as { starValue: number };
const stars = task?.starValue ?? 1;
db.prepare('UPDATE users SET earnedStars = earnedStars + ? WHERE uid = ?').run(stars, kidId);
```

Return the stars awarded so the route can include it in the response for animation purposes.

### `src/server/modules/rewards/service.ts`
In `claimReward()`, alongside XP deduction:

```ts
const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(rewardId) as Reward;

// Deduct stars if reward has starCost
if (reward.starCost && reward.starCost > 0) {
  const kid = db.prepare('SELECT earnedStars, spentStars FROM users WHERE uid = ?').get(kidId);
  if (kid.earnedStars - kid.spentStars < reward.starCost) {
    throw new Error('Not enough stars');
  }
  db.prepare('UPDATE users SET spentStars = spentStars + ? WHERE uid = ?').run(reward.starCost, kidId);
}

// If reward has allowance, create a ledger entry
if (reward.allowanceCents && reward.allowanceCents > 0) {
  const entryId = randomUUID();
  db.prepare(`
    INSERT INTO allowance_ledger (id, kidId, parentId, rewardId, rewardTitle, amountCents, status, claimedAt)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(entryId, kidId, reward.parentId, rewardId, reward.title, reward.allowanceCents, new Date().toISOString());
}
```

### `src/server/modules/rewards/routes.ts` (or a new allowance router)
Add allowance endpoints:

```ts
// GET pending allowances for a parent
rewardsRouter.get('/parents/:parentId/allowances', requireAuth, (req, res) => {
  const entries = db.prepare(`
    SELECT al.*, u.name as kidName
    FROM allowance_ledger al
    JOIN users u ON al.kidId = u.uid
    WHERE al.parentId = ? AND al.status = 'pending'
    ORDER BY al.claimedAt DESC
  `).all(req.params.parentId);
  res.json(entries);
});

// Mark an allowance as paid
rewardsRouter.put('/allowances/:id/pay', requireAuth, (req, res) => {
  db.prepare("UPDATE allowance_ledger SET status = 'paid', paidAt = ? WHERE id = ?")
    .run(new Date().toISOString(), req.params.id);
  res.json({ success: true });
});
```

### `src/components/parent/AddTaskModal.tsx`
Add star value input:

```tsx
<div>
  <label className="block text-sm font-semibold mb-1">⭐ Star Value</label>
  <div className="flex gap-2">
    {[1, 2, 3, 4, 5].map(n => (
      <button
        key={n}
        type="button"
        onClick={() => setStarValue(n)}
        className={cn(
          'w-10 h-10 rounded-full font-bold text-sm border-2 transition-all',
          starValue === n ? 'bg-amber-400 border-amber-500 text-white' : 'bg-white border-gray-200 text-gray-500'
        )}
      >
        {n}
      </button>
    ))}
  </div>
  <p className="text-xs text-gray-400 mt-1">Stars kids earn for completing this task</p>
</div>
```

### `src/components/parent/RewardManager.tsx`
Add star cost and allowance fields to the reward creation form:

```tsx
// Star cost
<input
  type="number"
  min={0}
  value={starCost}
  onChange={e => setStarCost(Number(e.target.value))}
  placeholder="Stars to redeem (0 = XP only)"
/>

// Allowance amount
<div className="flex items-center gap-2">
  <span className="text-gray-500">$</span>
  <input
    type="number"
    min={0}
    step={0.25}
    value={allowanceDollars}
    onChange={e => setAllowanceDollars(Number(e.target.value))}
    placeholder="0.00"
  />
</div>
<p className="text-xs text-gray-400">Leave blank for no allowance</p>
```

On submit: convert `allowanceDollars` to cents (`Math.round(allowanceDollars * 100)`) before sending to API.

### `src/components/kid/KidDashboard.tsx`
Add star counter to the stats bar:

```tsx
// Alongside the XP display
<div className="flex items-center gap-1">
  <span className="text-amber-400 text-lg">⭐</span>
  <span className="font-bold">{availableStars}</span>
  <span className="text-xs text-gray-400">stars</span>
</div>
```

Where `availableStars = (profile.earnedStars ?? 0) - (profile.spentStars ?? 0)`.

**Star burst animation on task completion:**
When a task is completed and `starsAwarded > 0`, trigger a brief animation:
```tsx
// Use motion/framer AnimatePresence
<AnimatePresence>
  {showStarBurst && (
    <motion.div
      initial={{ opacity: 1, scale: 0.5, y: 0 }}
      animate={{ opacity: 0, scale: 1.5, y: -40 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="absolute text-3xl pointer-events-none"
    >
      ⭐ +{starsAwarded}
    </motion.div>
  )}
</AnimatePresence>
```

---

## Files to Create

### `src/services/allowances.ts`

```ts
import { fetchAPI } from './http';
import { AllowanceEntry } from '../types';

export const allowanceClientService = {
  getPendingAllowances: (parentId: string): Promise<AllowanceEntry[]> =>
    fetchAPI(`/parents/${parentId}/allowances`),
  markPaid: (id: string): Promise<void> =>
    fetchAPI(`/allowances/${id}/pay`, { method: 'PUT' }),
};
```

### `src/components/parent/AllowanceLedger.tsx`
Allowance tracking table for parents. Rendered in `ParentDashboard`.

**Layout:**
- Section header: "Allowances Owed"
- Table rows: kid name | reward redeemed | amount | date claimed | "Mark Paid" button
- Empty state: "No allowances pending"
- Running total: "Total owed: $X.XX" (sum of all pending `amountCents / 100`)
- Paid entries collapse away with a checkmark animation

**Props:** `parentId: string`

On mount: fetch from `allowanceClientService.getPendingAllowances(parentId)`.

---

## Services to Update

### `src/services/rewards.ts`
Ensure `claimReward` sends `starCost` deduction. The backend handles this — no frontend change needed beyond ensuring the response includes updated star counts.

---

## Acceptance Criteria

- [ ] Task creation form has a star value picker (1–5 stars)
- [ ] Kid earns stars when completing a task (alongside XP)
- [ ] Star count displays on kid dashboard
- [ ] Star burst animation plays on task completion
- [ ] Rewards can have a star cost and optional allowance amount
- [ ] Kid can redeem a reward using stars (if configured with `starCost`)
- [ ] Redeeming an allowance reward creates a pending ledger entry
- [ ] Parent sees pending allowances in a ledger with "Mark Paid" per row
- [ ] Total owed is calculated and displayed
- [ ] Stars and XP coexist — XP system is unchanged
