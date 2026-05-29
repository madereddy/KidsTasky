// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HomeworkView } from './HomeworkView';

const getHomework = vi.fn();
const createHomework = vi.fn();
const updateHomework = vi.fn();
const deleteHomework = vi.fn();

vi.mock('../../services/homework', () => ({
  homeworkClientService: {
    getHomework: (...args: any[]) => getHomework(...args),
    createHomework: (...args: any[]) => createHomework(...args),
    updateHomework: (...args: any[]) => updateHomework(...args),
    deleteHomework: (...args: any[]) => deleteHomework(...args),
  },
}));

const kids: any[] = [
  { uid: 'k1', name: 'Kid One', role: 'kid', email: 'k1@test.com' },
  { uid: 'k2', name: 'Kid Two', role: 'kid', email: 'k2@test.com' },
];

describe('HomeworkView permissions UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHomework.mockResolvedValue([
      { id: 'h1', parentId: 'p1', title: 'Math', subject: 'Math', dueDate: '2026-06-20', assignedToId: 'k1', status: 'pending', color: '#6366f1', createdAt: Date.now() },
      { id: 'h2', parentId: 'p1', title: 'Sci', subject: 'Science', dueDate: '2026-06-20', assignedToId: 'k2', status: 'pending', color: '#6366f1', createdAt: Date.now() },
    ]);
    updateHomework.mockResolvedValue({ success: true });
    deleteHomework.mockResolvedValue({ success: true });
    createHomework.mockResolvedValue({ success: true });
  });

  it('hides Add/Delete for kid and filters to own homework', async () => {
    render(<HomeworkView parentId="p1" kids={kids} userRole="kid" currentUserId="k1" />);
    expect(await screen.findByText('Math')).toBeInTheDocument();
    expect(screen.queryByText('Sci')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Trash/i })).not.toBeInTheDocument();
  });

  it('shows parent controls and both assignments', async () => {
    render(<HomeworkView parentId="p1" kids={kids} userRole="parent" />);
    await screen.findByText('Math');
    expect(screen.getByText('Sci')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Mark done/i }).length).toBe(2);
  });

  it('calls status update when marking done', async () => {
    render(<HomeworkView parentId="p1" kids={kids} userRole="kid" currentUserId="k1" />);
    await screen.findByText('Math');
    fireEvent.click(screen.getByRole('button', { name: /Mark done/i }));
    await waitFor(() => expect(updateHomework).toHaveBeenCalledWith('h1', { status: 'done', completionResponse: null }));
  });

  it('prompts for follow-up answers when homework has verification questions', async () => {
    getHomework.mockResolvedValueOnce([
      {
        id: 'h3',
        parentId: 'p1',
        title: 'Workbook',
        subject: 'Math',
        dueDate: '2026-06-20',
        assignedToId: 'k1',
        status: 'pending',
        color: '#6366f1',
        completionQuestions: ['Which workbook?', 'What pages?'],
        completionQuestionsKidId: 'k1',
        createdAt: Date.now(),
      },
    ]);
    render(<HomeworkView parentId="p1" kids={kids} userRole="kid" currentUserId="k1" />);
    await screen.findByText('Workbook');
    fireEvent.click(screen.getByRole('button', { name: /Mark done/i }));
    expect(await screen.findByText('Homework Follow-up')).toBeInTheDocument();
    const answers = screen.getAllByPlaceholderText(/Your answer/i);
    fireEvent.change(answers[0], { target: { value: 'Math Workbook A' } });
    fireEvent.change(answers[1], { target: { value: '12-21' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    await waitFor(() =>
      expect(updateHomework).toHaveBeenCalledWith('h3', {
        status: 'done',
        completionResponse: 'Which workbook? Math Workbook A\nWhat pages? 12-21',
      })
    );
  });
});
