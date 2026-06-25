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

  it('displays correct weekday name for date string (no UTC off-by-one)', () => {
    // 2026-04-25 is Saturday. Parsing as UTC midnight shifts to Friday in UTC-offset timezones.
    const forecast = [{ date: '2026-04-25', maxTemp: 80, minTemp: 60, weatherCode: 0 }];
    render(<WeeklyWeather forecast={forecast} />);
    expect(screen.getByText('Sat')).toBeInTheDocument();
  });
});
