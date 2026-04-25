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
    res.json(forecast);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
