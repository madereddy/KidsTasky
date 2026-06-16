import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarWallView } from './CalendarWallView';
import { CalendarEvent } from '../../types';

vi.mock('./EventDetailModal', () => ({ EventDetailModal: () => <div /> }));
vi.mock('../shared/PhotoScreensaver', () => ({ PhotoScreensaver: () => <div /> }));
vi.mock('../shared/ParentalLockOverlay', () => ({ ParentalLockOverlay: () => <div /> }));

const baseEvent = (overrides: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'evt_1',
  parentId: 'p1',
  title: 'Event',
  description: '',
  startTime: new Date('2026-06-16T10:00:00').getTime(),
  endTime: new Date('2026-06-16T11:00:00').getTime(),
  color: '#6366f1',
  ...overrides,
});

const renderWall = (events: CalendarEvent[]) => render(
  <CalendarWallView
    parentId="p1"
    kids={[]}
    memberColorMap={{}}
    events={events}
    forecast={[]}
    todaysMeals={[]}
    wallKidProgress={[]}
    listsSummary={[]}
    wallPhotos={[]}
    temperatureUnit="celsius"
    timeFormat="12h"
    lastRefreshedAt={new Date()}
    isKioskMode={false}
    isCalSleeping={false}
    wallFilter="today"
    setWallFilter={vi.fn()}
    setIsWallMode={vi.fn()}
    setIsKioskMode={vi.fn()}
    setIsCalSleeping={vi.fn()}
    toggleFullscreen={vi.fn()}
    resetIdleTimers={vi.fn()}
    fetchEvents={vi.fn().mockResolvedValue(undefined)}
    setSelectedEvent={vi.fn()}
    selectedEvent={null}
  />
);

describe('CalendarWallView', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps current events visible after their start time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-16T10:30:00'));

    renderWall([
      baseEvent({ title: 'Piano lesson' }),
      baseEvent({
        id: 'evt_2',
        title: 'Old appointment',
        startTime: new Date('2026-06-16T08:00:00').getTime(),
        endTime: new Date('2026-06-16T09:00:00').getTime(),
      }),
    ]);

    expect(screen.getByText('Piano lesson')).toBeInTheDocument();
    expect(screen.queryByText('Old appointment')).not.toBeInTheDocument();
  });
});
