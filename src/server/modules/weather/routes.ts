// src/server/modules/weather/routes.ts
import { Router } from 'express';
import { weatherService } from './service.js';

export const weatherRouter = Router();

weatherRouter.get('/weather', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Valid lat and lon required' });
    }
    const forecast = await weatherService.getWeeklyForecast(lat, lon);
    return res.json(forecast);
  } catch {
    // Graceful degradation: open-meteo unavailable or timed out — return empty rather than 500.
    // 500s trigger client retries which compound slow-network conditions.
    return res.json({ daily: [], hourlyToday: [] });
  }
});
