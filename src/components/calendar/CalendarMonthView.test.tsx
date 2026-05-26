// src/components/calendar/CalendarMonthView.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CalendarMonthView } from './CalendarMonthView';

describe('CalendarMonthView', () => {
  it('renders day-of-week headers', () => {
    render(
      <CalendarMonthView
        events={[]}
        currentMonth={new Date('2026-04-01')}
        onDayClick={() => {}}
        memberColorMap={{}}
        forecast={[]}
      />
    );
    expect(screen.getByText('Sun')).toBeInTheDocument();
  });
});
