// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddHomeworkModal } from './AddHomeworkModal';

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

describe('AddHomeworkModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTemplates.mockResolvedValue([]);
  });

  it('renders scrollable dialog and applies built-in template questions', async () => {
    render(
      <AddHomeworkModal
        kids={[{ uid: 'k1', name: 'Kid One', role: 'kid', email: 'k1@test.com' } as any]}
        onClose={() => {}}
        onSubmit={async () => {}}
      />
    );

    expect(await screen.findByText('Add Homework')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Save$/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Template mode:/i)).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('overflow-y-auto');

    fireEvent.click(screen.getByRole('button', { name: /\+ Workbook/i }));
    expect(screen.getByPlaceholderText(/Optional completion questions/i)).toHaveValue(
      'Which workbook did you use?\nWhat pages did you complete?'
    );
  });

  it('submits homework payload including verification questions', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AddHomeworkModal
        kids={[{ uid: 'k1', name: 'Kid One', role: 'kid', email: 'k1@test.com' } as any]}
        onClose={() => {}}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Workbook Session' } });
    fireEvent.change(screen.getByPlaceholderText('Subject'), { target: { value: 'Math' } });
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-06-10' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ Workbook/i }));
    const saveButtons = screen.getAllByRole('button', { name: /^Save$/i });
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.title).toBe('Workbook Session');
    expect(payload.subject).toBe('Math');
    expect(payload.completionQuestions).toEqual([
      'Which workbook did you use?',
      'What pages did you complete?',
    ]);
  });
});
