import { describe, it, expect } from 'vitest';
import { positionEvents } from './calendarLayout';
import { CalendarEvent } from '../types';

const baseEvent = (id: string, start: string, end: string): CalendarEvent => ({
  id,
  parentId: 'p1',
  title: id,
  description: '',
  startTime: new Date(`2026-06-16T${start}:00`).getTime(),
  endTime: new Date(`2026-06-16T${end}:00`).getTime(),
  color: '#6366f1',
});

describe('calendarLayout', () => {
  it('handles no overlap', () => {
    const events = [
      baseEvent('e1', '10:00', '11:00'),
      baseEvent('e2', '11:00', '12:00'),
    ];
    const result = positionEvents(events);
    expect(result.find(r => r.id === 'e1')?.left).toBe(0);
    expect(result.find(r => r.id === 'e1')?.width).toBe(100);
    expect(result.find(r => r.id === 'e2')?.left).toBe(0);
    expect(result.find(r => r.id === 'e2')?.width).toBe(100);
  });

  it('handles simple overlap', () => {
    const events = [
      baseEvent('e1', '10:00', '11:00'),
      baseEvent('e2', '10:30', '11:30'),
    ];
    const result = positionEvents(events);
    expect(result.find(r => r.id === 'e1')?.left).toBe(0);
    expect(result.find(r => r.id === 'e1')?.width).toBe(50);
    expect(result.find(r => r.id === 'e2')?.left).toBe(50);
    expect(result.find(r => r.id === 'e2')?.width).toBe(50);
  });

  it('handles 3-way overlap', () => {
    const events = [
      baseEvent('e1', '10:00', '11:00'),
      baseEvent('e2', '10:15', '11:15'),
      baseEvent('e3', '10:30', '11:30'),
    ];
    const result = positionEvents(events);
    expect(result.find(r => r.id === 'e1')?.width).toBeCloseTo(33.33, 1);
    expect(result.find(r => r.id === 'e2')?.width).toBeCloseTo(33.33, 1);
    expect(result.find(r => r.id === 'e3')?.width).toBeCloseTo(33.33, 1);
  });

  it('handles mixed overlap', () => {
    const events = [
      baseEvent('e1', '10:00', '11:00'),
      baseEvent('e2', '10:30', '11:00'),
      baseEvent('e3', '11:00', '12:00'),
    ];
    const result = positionEvents(events);
    expect(result.find(r => r.id === 'e1')?.width).toBe(50);
    expect(result.find(r => r.id === 'e2')?.width).toBe(50);
    expect(result.find(r => r.id === 'e3')?.width).toBe(100);
  });
});
