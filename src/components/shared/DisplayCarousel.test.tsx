import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DisplayCarousel } from './DisplayCarousel';

describe('DisplayCarousel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders first slide initially', () => {
    render(
      <DisplayCarousel slides={['chores', 'calendar']} intervalSec={30}>
        {{
          chores: <div data-testid="slide-chores">Chores</div>,
          calendar: <div data-testid="slide-calendar">Calendar</div>,
        }}
      </DisplayCarousel>
    );
    expect(screen.getByTestId('slide-chores')).toBeInTheDocument();
  });

  it('advances slide after interval', () => {
    render(
      <DisplayCarousel slides={['chores', 'calendar']} intervalSec={30}>
        {{
          chores: <div data-testid="slide-chores">Chores</div>,
          calendar: <div data-testid="slide-calendar">Calendar</div>,
        }}
      </DisplayCarousel>
    );
    expect(screen.getByTestId('slide-chores')).toBeInTheDocument();
    expect(screen.queryByTestId('slide-calendar')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByTestId('slide-calendar')).toBeInTheDocument();
    expect(screen.queryByTestId('slide-chores')).not.toBeInTheDocument();
  });

  it('wraps around after last slide', () => {
    render(
      <DisplayCarousel slides={['chores', 'calendar']} intervalSec={30}>
        {{
          chores: <div data-testid="slide-chores">Chores</div>,
          calendar: <div data-testid="slide-calendar">Calendar</div>,
        }}
      </DisplayCarousel>
    );
    act(() => vi.advanceTimersByTime(30_000)); // → calendar
    act(() => vi.advanceTimersByTime(30_000)); // → wraps to chores
    expect(screen.getByTestId('slide-chores')).toBeInTheDocument();
  });
});
