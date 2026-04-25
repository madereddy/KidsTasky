# Phase 2 Syncing Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge the application with external data sources by adding third-party calendar syncing and localized weather integration.

**Architecture:** We will introduce a `settings` domain to store family geolocations, a `weather` domain that accesses the free Open-Meteo API, and a `sync` domain for managing OAuth connections and external calendar event ingestion. The schema will be updated to handle external event IDs.

**Tech Stack:** React, Express/SQLite (Backend), Open-Meteo API (Weather), Vitest, Supertest.

---

### Task 1: Add Family Settings & Sync Connection Schema

**Files:**
- Create: `src/server/migrations/004_add_sync_settings.sql`
- Modify: `src/types.ts`
- Create: `src/server/modules/settings/db.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/modules/settings/db.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from '../../db.js';

describe('Settings and Sync Schema', () => {
  it('should insert and retrieve family settings', () => {
    const stmt = db.prepare(`
      INSERT INTO family_settings (parentId, locationLat, locationLon, timezone) 
      VALUES (?, ?, ?, ?)
    `);
    stmt.run('parent_1', 40.7128, -74.0060, 'America/New_York');
    
    const row = db.prepare('SELECT * FROM family_settings WHERE parentId = ?').get('parent_1') as any;
    expect(row.locationLat).toBe(40.7128);
  });

  it('should insert and retrieve sync connections', () => {
    const stmt = db.prepare(`
      INSERT INTO sync_connections (id, parentId, provider, accessToken, refreshToken) 
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run('sync_1', 'parent_1', 'google', 'access_123', 'refresh_123');
    
    const row = db.prepare('SELECT * FROM sync_connections WHERE id = ?').get('sync_1') as any;
    expect(row.provider).toBe('google');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/modules/settings/db.test.ts`
Expected: FAIL with "no such table: family_settings"

- [ ] **Step 3: Write minimal implementation**

```sql
-- src/server/migrations/004_add_sync_settings.sql
CREATE TABLE IF NOT EXISTS family_settings (
  parentId TEXT PRIMARY KEY,
  locationLat REAL,
  locationLon REAL,
  timezone TEXT
);

CREATE TABLE IF NOT EXISTS sync_connections (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  provider TEXT,
  accessToken TEXT,
  refreshToken TEXT
);

-- We also need to add externalId to events to support deduplication
ALTER TABLE events ADD COLUMN externalId TEXT;
ALTER TABLE events ADD COLUMN source TEXT DEFAULT 'local';

UPDATE schema_version SET version = 4;
```

```typescript
// Add to src/types.ts
export interface FamilySettings {
  parentId: string;
  locationLat: number;
  locationLon: number;
  timezone: string;
}

export interface SyncConnection {
  id: string;
  parentId: string;
  provider: string;
  accessToken: string;
  refreshToken: string;
}

// Modify existing CalendarEvent in src/types.ts to include:
// externalId?: string;
// source?: string;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/modules/settings/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/migrations/004_add_sync_settings.sql src/types.ts src/server/modules/settings/db.test.ts
git commit -m "feat: add schema for family settings and sync connections"
```

---

### Task 2: Weather API Service Integration

**Files:**
- Create: `src/server/modules/weather/service.ts`
- Create: `src/server/modules/weather/service.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/modules/weather/service.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { weatherService } from './service.js';

global.fetch = vi.fn();

describe('Weather Service', () => {
  it('should fetch 7-day forecast from Open-Meteo', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        daily: {
          time: ['2026-04-25'],
          temperature_2m_max: [75],
          temperature_2m_min: [55],
          weathercode: [3]
        }
      })
    });

    const forecast = await weatherService.getWeeklyForecast(40.7128, -74.0060);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('open-meteo.com')
    );
    expect(forecast.length).toBe(1);
    expect(forecast[0].maxTemp).toBe(75);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/modules/weather/service.test.ts`
Expected: FAIL due to missing file

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/server/modules/weather/service.ts
export interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
}

export const weatherService = {
  getWeeklyForecast: async (lat: number, lon: number): Promise<DailyForecast[]> => {
    const url = \`https://api.open-meteo.com/v1/forecast?latitude=\${lat}&longitude=\${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto\`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather fetch failed');
    
    const data = await res.json();
    const forecast: DailyForecast[] = [];
    
    for (let i = 0; i < data.daily.time.length; i++) {
        forecast.push({
            date: data.daily.time[i],
            maxTemp: data.daily.temperature_2m_max[i],
            minTemp: data.daily.temperature_2m_min[i],
            weatherCode: data.daily.weathercode[i]
        });
    }
    return forecast;
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/modules/weather/service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/weather/service.ts src/server/modules/weather/service.test.ts
git commit -m "feat: implement Open-Meteo weather service"
```

---

### Task 3: Weather API Route

**Files:**
- Create: `src/server/modules/weather/routes.ts`
- Create: `src/server/modules/weather/api.test.ts`
- Modify: `src/server/routes.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/modules/weather/api.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../../server.js';
import { weatherService } from './service.js';

vi.mock('./service.js', () => ({
  weatherService: {
    getWeeklyForecast: vi.fn().mockResolvedValue([{ date: '2026-04-25', maxTemp: 75, minTemp: 55, weatherCode: 3 }])
  }
}));

describe('Weather API', () => {
  it('should return weekly forecast', async () => {
    const getRes = await request(app).get('/api/weather?lat=40.71&lon=-74.00');
    expect(getRes.status).toBe(200);
    expect(getRes.body.length).toBe(1);
    expect(getRes.body[0].maxTemp).toBe(75);
    expect(weatherService.getWeeklyForecast).toHaveBeenCalledWith(40.71, -74.00);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/modules/weather/api.test.ts`
Expected: FAIL with 404

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/server/modules/weather/routes.ts
import { Router } from 'express';
import { weatherService } from './service.js';

export const weatherRouter = Router();

weatherRouter.get('/api/weather', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Valid lat and lon required' });
    }
    const forecast = await weatherService.getWeeklyForecast(lat, lon);
    res.json(forecast);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

*(You must insert the following export into `src/server/routes.ts`)*
```typescript
// src/server/routes.ts
// ADD IMPORT AT TOP:
import { weatherRouter } from './modules/weather/routes.js';

// ADD BEFORE `export const apiRouter = router;`:
router.use(weatherRouter);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/modules/weather/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/weather/routes.ts src/server/modules/weather/api.test.ts src/server/routes.ts
git commit -m "feat: complete weather api routes"
```

---

### Task 4: UI Weekly Weather Component

**Files:**
- Create: `src/components/calendar/WeeklyWeather.tsx`
- Create: `src/components/calendar/WeeklyWeather.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/calendar/WeeklyWeather.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WeeklyWeather } from './WeeklyWeather';

describe('WeeklyWeather', () => {
  it('renders forecast items', () => {
    const forecast = [{ date: '2026-04-25', maxTemp: 75, minTemp: 55, weatherCode: 3 }];
    render(<WeeklyWeather forecast={forecast} />);
    
    expect(screen.getByText('75°')).toBeInTheDocument();
    expect(screen.getByText('55°')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/calendar/WeeklyWeather.test.tsx`
Expected: FAIL due to missing file

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/calendar/WeeklyWeather.tsx
import React from 'react';

// Using the same interface as from service, mapped locally for UI
interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
}

export function WeeklyWeather({ forecast = [] }: { forecast: DailyForecast[] }) {
  if (forecast.length === 0) return null;
  
  return (
    <div className="flex gap-2 p-2 bg-white rounded-lg shadow-sm overflow-x-auto">
      {forecast.map(day => (
        <div key={day.date} className="flex flex-col items-center min-w-[60px] p-2 border-r last:border-r-0">
          <span className="text-xs font-medium text-gray-500">
            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
          <div className="flex flex-col mt-1 font-semibold text-center">
            <span className="text-orange-500 text-sm">{Math.round(day.maxTemp)}°</span>
            <span className="text-blue-500 text-xs">{Math.round(day.minTemp)}°</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/calendar/WeeklyWeather.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/WeeklyWeather.tsx src/components/calendar/WeeklyWeather.test.tsx
git commit -m "feat: create WeeklyWeather UI component"
```

---

### Task 5: UI Connected Accounts Settings Component

**Files:**
- Create: `src/components/parent/ConnectedAccountsView.tsx`
- Create: `src/components/parent/ConnectedAccountsView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/parent/ConnectedAccountsView.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConnectedAccountsView } from './ConnectedAccountsView';

describe('ConnectedAccountsView', () => {
  it('renders connection options', () => {
    render(<ConnectedAccountsView connections={[{ id: '1', provider: 'google', email: 'test@gmail.com' }]} onConnect={() => {}} onDisconnect={() => {}} />);
    
    expect(screen.getByText('Connected Accounts')).toBeInTheDocument();
    expect(screen.getByText('test@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/parent/ConnectedAccountsView.test.tsx`
Expected: FAIL due to missing file

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/parent/ConnectedAccountsView.tsx
import React from 'react';

interface Connection {
  id: string;
  provider: string;
  email: string; // We'll assume the sync model returns the email for display
}

interface Props {
  connections: Connection[];
  onConnect: (provider: string) => void;
  onDisconnect: (connectionId: string) => void;
}

export function ConnectedAccountsView({ connections, onConnect, onDisconnect }: Props) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-bold mb-4">Connected Accounts</h2>
      
      <div className="space-y-4">
        {connections.map(conn => (
          <div key={conn.id} className="flex justify-between items-center p-3 border rounded">
            <div>
              <span className="font-medium capitalize">{conn.provider}</span>
              <p className="text-sm text-gray-500">{conn.email}</p>
            </div>
            <button 
              onClick={() => onDisconnect(conn.id)}
              className="text-red-600 text-sm font-medium hover:bg-red-50 px-3 py-1 rounded"
            >
              Disconnect
            </button>
          </div>
        ))}

        <div className="pt-4 border-t">
          <h3 className="font-medium mb-2">Connect New Account</h3>
          <button 
            onClick={() => onConnect('google')}
            className="flex items-center gap-2 px-4 py-2 bg-white border shadow-sm rounded-md font-medium text-gray-700 hover:bg-gray-50"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            Connect Google Calendar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/parent/ConnectedAccountsView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/parent/ConnectedAccountsView.tsx src/components/parent/ConnectedAccountsView.test.tsx
git commit -m "feat: create ConnectedAccountsView UI component"
```
