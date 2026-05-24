# Plan 06 — Weather on Calendar Events

**Group:** C (requires Plans 01 and 03)
**Blocked by:** Plan 01 (calendar views must exist), Plan 03 (settings provides lat/lon)

---

## Problem

`weatherService` hits the Open-Meteo API and returns a 7-day forecast. The backend route `GET /weather?lat=&lon=` works. `WeeklyWeather.tsx` renders forecast chips with hi/lo temps. None of this is wired to the frontend application — no component fetches weather, no calendar view displays it, and there is no weather icon mapping for WMO codes.

---

## What Already Exists

- `src/server/modules/weather/service.ts` — `getWeeklyForecast(lat, lon)` returning `DailyForecast[]`
- `src/server/modules/weather/routes.ts` — `GET /weather?lat=&lon=` (no auth required)
- `src/components/calendar/WeeklyWeather.tsx` — renders forecast chips (hi/lo only, no icons)
- `DailyForecast` interface: `{ date: string, maxTemp: number, minTemp: number, weatherCode: number }`
- `FamilySettings.locationLat` and `FamilySettings.locationLon` (stored after Plan 03)

---

## Files to Create

### `src/services/weather.ts`

```ts
import { fetchAPI } from './http';

export interface DailyForecast {
  date: string;      // YYYY-MM-DD
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
}

export const weatherClientService = {
  getForecast: (lat: number, lon: number): Promise<DailyForecast[]> =>
    fetchAPI(`/weather?lat=${lat}&lon=${lon}`),
};
```

---

## Files to Modify

### `src/constants.ts`
Add WMO weather code → emoji/description mapping:

```ts
export const WMO_WEATHER: Record<number, { icon: string; label: string }> = {
  0:  { icon: '☀️',  label: 'Clear' },
  1:  { icon: '🌤️', label: 'Mostly Clear' },
  2:  { icon: '⛅',  label: 'Partly Cloudy' },
  3:  { icon: '☁️',  label: 'Overcast' },
  45: { icon: '🌫️', label: 'Fog' },
  48: { icon: '🌫️', label: 'Icy Fog' },
  51: { icon: '🌦️', label: 'Light Drizzle' },
  53: { icon: '🌦️', label: 'Drizzle' },
  55: { icon: '🌧️', label: 'Heavy Drizzle' },
  61: { icon: '🌧️', label: 'Light Rain' },
  63: { icon: '🌧️', label: 'Rain' },
  65: { icon: '🌧️', label: 'Heavy Rain' },
  71: { icon: '🌨️', label: 'Light Snow' },
  73: { icon: '❄️',  label: 'Snow' },
  75: { icon: '❄️',  label: 'Heavy Snow' },
  80: { icon: '🌦️', label: 'Showers' },
  81: { icon: '🌧️', label: 'Rain Showers' },
  82: { icon: '⛈️',  label: 'Violent Showers' },
  85: { icon: '🌨️', label: 'Snow Showers' },
  95: { icon: '⛈️',  label: 'Thunderstorm' },
  99: { icon: '⛈️',  label: 'Thunderstorm w/ Hail' },
};

export function getWeatherInfo(code: number) {
  // WMO codes are not all defined — find closest match
  return WMO_WEATHER[code] ?? WMO_WEATHER[Math.floor(code / 10) * 10] ?? { icon: '🌡️', label: 'Weather' };
}
```

### `src/components/calendar/WeeklyWeather.tsx`
Add weather icon using `getWeatherInfo`:

```tsx
import { getWeatherInfo } from '../../constants';

// In each day chip:
const weather = getWeatherInfo(day.weatherCode);
<span className="text-xl">{weather.icon}</span>
<span className="text-[10px] text-gray-400">{weather.label}</span>
```

Also add a `today` prop for a larger "today" callout at the start of the strip.

### `src/components/calendar/CalendarView.tsx` (from Plan 01)
- Fetch family settings on mount: `settingsClientService.getSettings(parentId)`
- If `locationLat` and `locationLon` are set, fetch 7-day forecast: `weatherClientService.getForecast(lat, lon)`
- Store `forecast: DailyForecast[]` in state
- Pass `forecast` to sub-views

**Utility function** (inline in CalendarView or in `src/lib/utils.ts`):
```ts
export function getForecastForDate(forecast: DailyForecast[], date: Date): DailyForecast | undefined {
  const dateStr = date.toISOString().slice(0, 10);
  return forecast.find(f => f.date === dateStr);
}
```

### `src/components/calendar/CalendarMonthView.tsx` (from Plan 01)
Add `forecast?: DailyForecast[]` prop.

Render `<WeeklyWeather forecast={forecast} />` in the header row above the day-of-week labels.

### `src/components/calendar/CalendarWeekView.tsx` (from Plan 01)
Add `forecast?: DailyForecast[]` prop.

For each day column header, show the weather icon and hi/lo:
```tsx
const dayForecast = getForecastForDate(forecast, day);
{dayForecast && (
  <span className="text-sm">{getWeatherInfo(dayForecast.weatherCode).icon}</span>
)}
```

### `src/components/calendar/CalendarDayView.tsx` (from Plan 01)
Add `weatherEntry?: DailyForecast` prop (single day's forecast).

Show a weather card at the top of the day:
```tsx
{weatherEntry && (
  <div className="flex items-center gap-3 p-3 bg-sky-50 rounded-xl border border-sky-100 mb-4">
    <span className="text-3xl">{getWeatherInfo(weatherEntry.weatherCode).icon}</span>
    <div>
      <p className="font-semibold text-sky-800">{getWeatherInfo(weatherEntry.weatherCode).label}</p>
      <p className="text-sm text-sky-600">
        {Math.round(weatherEntry.maxTemp)}° / {Math.round(weatherEntry.minTemp)}°
      </p>
    </div>
  </div>
)}
```

### Event chips in calendar views
For each event chip, look up its date in the forecast and show a tiny weather icon:
```tsx
const eventDate = new Date(event.startTime);
const eventForecast = getForecastForDate(forecast ?? [], eventDate);
{eventForecast && (
  <span className="ml-1 text-[10px]">{getWeatherInfo(eventForecast.weatherCode).icon}</span>
)}
```

---

## Error Handling

- If settings have no lat/lon (first-time user before Plan 03 is used): skip weather fetch silently, render `WeeklyWeather` as hidden (it already returns `null` when `forecast.length === 0`)
- If weather API call fails: catch and set `forecast = []`, no crash

---

## Acceptance Criteria

- [ ] `WeeklyWeather` strip appears above the month and week calendar grids
- [ ] Each forecast day shows weather icon + hi/lo temperature
- [ ] Day view shows a weather card for the viewed day
- [ ] Weather icons match the WMO code categories
- [ ] If location is not set, weather section is hidden gracefully
- [ ] Weather refreshes when the page loads (cached for the session, no re-fetch on view switch)
