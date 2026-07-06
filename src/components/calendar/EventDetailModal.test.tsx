// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EventDetailModal } from './EventDetailModal';

const updateRsvp = vi.fn((..._args: any[]) => Promise.resolve({ success: true }));
const addAttendee = vi.fn((..._args: any[]) => Promise.resolve({ success: true }));
const removeAttendee = vi.fn((..._args: any[]) => Promise.resolve({ success: true }));
const updateEvent = vi.fn((..._args: any[]) => Promise.resolve({ success: true }));
const getRoutineItems = vi.fn((..._args: any[]): Promise<any> => Promise.resolve([]));
const setRoutineItemCompleted = vi.fn((..._args: any[]) => Promise.resolve());

vi.mock('../../services/events', () => ({
  eventsClientService: {
    updateRsvp: (...args: any[]) => updateRsvp(...args),
    addAttendee: (...args: any[]) => addAttendee(...args),
    removeAttendee: (...args: any[]) => removeAttendee(...args),
    updateEvent: (...args: any[]) => updateEvent(...args),
    deleteEvent: vi.fn(() => Promise.resolve({ success: true })),
    getRoutineItems: (...args: any[]) => getRoutineItems(...args),
    setRoutineItemCompleted: (...args: any[]) => setRoutineItemCompleted(...args),
  },
}));

const baseEvent: any = {
  id: 'evt_1',
  parentId: 'p1',
  title: 'Birthday',
  description: '',
  startTime: Date.now(),
  endTime: Date.now() + 3600000,
  color: '#6366f1',
  attendees: [{ id: 'att_1', eventId: 'evt_1', userId: 'k1', rsvp: 'pending', name: 'Kid One' }],
};

const kids: any[] = [
  { uid: 'k1', name: 'Kid One', role: 'kid', email: 'k1@test.com' },
  { uid: 'k2', name: 'Kid Two', role: 'kid', email: 'k2@test.com' },
];

describe('EventDetailModal permissions UX', () => {
  it('shows attendee add controls for parent and not for kid', () => {
    const { rerender } = render(
      <EventDetailModal event={baseEvent} kids={kids} userRole="parent" onClose={() => {}} onUpdated={() => {}} />
    );
    expect(screen.getByText('Assign / add attendee')).toBeInTheDocument();

    rerender(<EventDetailModal event={baseEvent} kids={kids} userRole="kid" onClose={() => {}} onUpdated={() => {}} />);
    expect(screen.queryByText('Assign / add attendee')).not.toBeInTheDocument();
  });

  it('disables RSVP buttons while saving', async () => {
    let release!: () => void;
    updateRsvp.mockImplementationOnce(
      () => new Promise((resolve) => { release = () => resolve({ success: true }); })
    );

    render(<EventDetailModal event={baseEvent} kids={kids} userRole="kid" onClose={() => {}} onUpdated={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Yes/i }));
    expect(screen.getByRole('button', { name: /Saving/i })).toBeDisabled();
    release();
    await waitFor(() => expect(updateRsvp).toHaveBeenCalled());
  });

  it('shows attached routine items and toggles them', async () => {
    getRoutineItems.mockResolvedValueOnce([
      { id: 'item1', eventId: 'evt_1', listId: 'routine1', text: 'Brush Teeth', completed: 0 },
      { id: 'item2', eventId: 'evt_1', listId: 'routine1', text: 'Pack Backpack', completed: 1 },
    ]);

    render(
      <EventDetailModal
        event={{ ...baseEvent, routineListId: 'routine1' }}
        kids={kids}
        routineLists={[{ id: 'routine1', parentId: 'p1', title: 'Morning Routine', category: 'routine', isRoutine: 1, createdAt: '', updatedAt: '' }]}
        userRole="kid"
        onClose={() => {}}
        onUpdated={() => {}}
      />
    );

    expect(await screen.findByText('Attached routine: Morning Routine')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Brush Teeth'));

    await waitFor(() => expect(setRoutineItemCompleted).toHaveBeenCalledWith('evt_1', 'item1', true));
    expect(getRoutineItems).toHaveBeenCalledWith('evt_1');
  });

  it('hides the current routine immediately when parent selects no attached routine', async () => {
    getRoutineItems.mockResolvedValueOnce([
      { id: 'item1', eventId: 'evt_1', listId: 'routine1', text: 'Brush Teeth', completed: 0 },
    ]);

    render(
      <EventDetailModal
        event={{ ...baseEvent, routineListId: 'routine1' }}
        kids={kids}
        routineLists={[{ id: 'routine1', parentId: 'p1', title: 'Morning Routine', category: 'routine', isRoutine: 1, createdAt: '', updatedAt: '' }]}
        userRole="parent"
        onClose={() => {}}
        onUpdated={() => {}}
      />
    );

    expect(await screen.findByText('Attached routine: Morning Routine')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    fireEvent.change(screen.getByDisplayValue('Morning Routine'), { target: { value: '' } });

    expect(screen.queryByText('Attached routine: Morning Routine')).not.toBeInTheDocument();
    expect(screen.queryByText('Brush Teeth')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => expect(updateEvent).toHaveBeenCalledWith('evt_1', expect.objectContaining({ routineListId: null }), 'one'));
  });
});
