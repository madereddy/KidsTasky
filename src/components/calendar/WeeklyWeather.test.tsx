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
