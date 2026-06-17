// src/components/calendar/CalendarMonthView.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CalendarMonthView } from './CalendarMonthView';

describe('CalendarMonthView', () => {
  it('renders day-of-week headers', () => {
    render(
      <CalendarMonthView
        events={[]}
        currentMonth={new Date('2026-04-01')}
        onDayClick={() => {}}
        onEventClick={() => {}}
        memberColorMap={{}}
        forecast={[]}
        temperatureUnit="celsius"
      />
    );
    expect(screen.getByText('Sun')).toBeInTheDocument();
  });

  it('uses member color when event has assignedToId', () => {
    const events = [{
      id: 'e1', title: 'Soccer', assignedToId: 'kid1', color: '#0000ff',
      parentId: 'p1', description: '',
      startTime: new Date('2026-04-15T10:00:00').getTime(),
      endTime: new Date('2026-04-15T11:00:00').getTime(),
    }];
    render(
      <CalendarMonthView
        events={events as any}
        currentMonth={new Date('2026-04-15T12:00:00')}
        onDayClick={() => {}}
        onEventClick={() => {}}
        memberColorMap={{ kid1: '#ff0000' }}
        forecast={[]}
        temperatureUnit="celsius"
      />
    );
    const chip = screen.getByText('Soccer').closest('div');
    // member color (#ff0000) should override event color (#0000ff)
    expect(chip?.style.backgroundColor).not.toBe('');
    expect(chip?.style.backgroundColor).not.toBe('rgb(0, 0, 255)'); // not the event's own color
  });

  it('opens attached routine directly from the event chip affordance', () => {
    const onRoutineClick = vi.fn();
    const events = [{
      id: 'e1', title: 'Soccer', assignedToId: 'kid1', color: '#0000ff', routineListId: 'routine_1',
      parentId: 'p1', description: '',
      startTime: new Date('2026-04-15T10:00:00').getTime(),
      endTime: new Date('2026-04-15T11:00:00').getTime(),
    }];

    render(
      <CalendarMonthView
        events={events as any}
        currentMonth={new Date('2026-04-15T12:00:00')}
        onDayClick={() => {}}
        onEventClick={() => {}}
        onRoutineClick={onRoutineClick}
        memberColorMap={{ kid1: '#ff0000' }}
        forecast={[]}
        temperatureUnit="celsius"
      />
    );

    fireEvent.click(screen.getByText('R'));

    expect(onRoutineClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1', routineListId: 'routine_1' }));
  });
});
