// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AddTaskModal } from './AddTaskModal';

const listTemplates = vi.fn();
const upsertTemplate = vi.fn();
const removeTemplate = vi.fn();
const setPinnedTemplate = vi.fn();
const importTemplates = vi.fn();

vi.mock('../../services/proofTemplates', () => ({
  proofTemplatesClientService: {
    list: (...args: any[]) => listTemplates(...args),
    upsert: (...args: any[]) => upsertTemplate(...args),
    remove: (...args: any[]) => removeTemplate(...args),
    setPinned: (...args: any[]) => setPinnedTemplate(...args),
    import: (...args: any[]) => importTemplates(...args),
  },
}));

describe('AddTaskModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTemplates.mockResolvedValue([]);
  });

  it('renders scrollable modal with template controls and allows template apply', async () => {
    render(
      <AddTaskModal
        onClose={() => {}}
        onSubmit={() => {}}
        kids={[{ uid: 'k1', name: 'Kid One', role: 'kid', email: 'k1@test.com' } as any]}
        parentId="p1"
        categories={[]}
        existingTasks={[]}
      />
    );

    expect(await screen.findByText('New Mission')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Launch/i })).toBeInTheDocument();
    expect(screen.getByText(/Template mode:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Room Cleanup/i })).toBeInTheDocument();

    const dialog = screen.getByText('New Mission').closest('div[class*="max-h-"]');
    expect(dialog?.className).toContain('overflow-y-auto');

    fireEvent.click(screen.getByRole('button', { name: /\+ Room Cleanup/i }));
    expect(screen.getByPlaceholderText(/One question per line/i)).toHaveValue(
      'Are all clothes in the hamper?\nIs the floor clean?\nDid you make the bed?'
    );
  });

  it('submits task payload when Launch is clicked', async () => {
    const onSubmit = vi.fn();
    render(
      <AddTaskModal
        onClose={() => {}}
        onSubmit={onSubmit}
        kids={[{ uid: 'k1', name: 'Kid One', role: 'kid', email: 'k1@test.com' } as any]}
        parentId="p1"
        categories={[]}
        existingTasks={[]}
      />
    );

    await screen.findByText('New Mission');
    fireEvent.change(screen.getByPlaceholderText(/Navigation Check/i), { target: { value: 'Clean Room' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ Room Cleanup/i }));
    fireEvent.click(screen.getByRole('button', { name: /Launch/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.title).toBe('Clean Room');
    expect(payload.parentId).toBe('p1');
    expect(payload.completionQuestions).toEqual([
      'Are all clothes in the hamper?',
      'Is the floor clean?',
      'Did you make the bed?',
    ]);
  });
});
