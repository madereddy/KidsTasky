// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EventDetailModal } from './EventDetailModal';

const updateRsvp = vi.fn((..._args: any[]) => Promise.resolve({ success: true }));
const addAttendee = vi.fn((..._args: any[]) => Promise.resolve({ success: true }));
const removeAttendee = vi.fn((..._args: any[]) => Promise.resolve({ success: true }));
const getItems = vi.fn((..._args: any[]) => Promise.resolve([]));
const toggleItem = vi.fn((..._args: any[]) => Promise.resolve());

vi.mock('../../services/events', () => ({
  eventsClientService: {
    updateRsvp: (...args: any[]) => updateRsvp(...args),
    addAttendee: (...args: any[]) => addAttendee(...args),
    removeAttendee: (...args: any[]) => removeAttendee(...args),
    updateEvent: vi.fn(() => Promise.resolve({ success: true })),
    deleteEvent: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

vi.mock('../../services/lists', () => ({
  listsClientService: {
    getItems: (...args: any[]) => getItems(...args),
    toggleItem: (...args: any[]) => toggleItem(...args),
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
    expect(screen.getByText('Add attendee')).toBeInTheDocument();

    rerender(<EventDetailModal event={baseEvent} kids={kids} userRole="kid" onClose={() => {}} onUpdated={() => {}} />);
    expect(screen.queryByText('Add attendee')).not.toBeInTheDocument();
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
    getItems.mockResolvedValueOnce([
      { id: 'item1', listId: 'routine1', text: 'Brush Teeth', completed: 0 },
      { id: 'item2', listId: 'routine1', text: 'Pack Backpack', completed: 1 },
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

    await waitFor(() => expect(toggleItem).toHaveBeenCalledWith('item1', true, 'Brush Teeth', undefined, undefined));
  });
});
