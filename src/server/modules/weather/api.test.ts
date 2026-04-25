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
