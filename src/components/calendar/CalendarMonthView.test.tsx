// src/components/calendar/CalendarMonthView.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CalendarMonthView } from './CalendarMonthView';

describe('CalendarMonthView', () => {
  it('renders a calendar UI indicating month view', () => {
    render(<CalendarMonthView events={[]} />);
    // Since we just want the minimal scaffold for now:
    expect(screen.getByText('Month View')).toBeInTheDocument();
  });
});
