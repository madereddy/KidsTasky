// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskCard } from './TaskCard';

const baseTask: any = { id: 't1', title: 'Make bed', frequency: 'daily', difficulty: 'easy' };

function renderCard(approvalStatus?: string, onToggle = vi.fn()) {
  render(
    <TaskCard
      task={baseTask}
      isDone={true}
      isLocked={false}
      urgency="none"
      onToggle={onToggle}
      completion={approvalStatus ? ({ approvalStatus } as any) : ({} as any)}
    />
  );
  return onToggle;
}

describe('TaskCard done-state footers by approvalStatus', () => {
  it('rejected shows "Not Approved" + a "Try Again" action, never "Completed!"', () => {
    renderCard('rejected');
    expect(screen.getByText(/Not Approved/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    expect(screen.queryByText(/Completed!/i)).not.toBeInTheDocument();
  });

  it('pending shows "Waiting for Approval", not an XP-earned footer', () => {
    renderCard('pending');
    expect(screen.getByText(/Waiting for Approval/i)).toBeInTheDocument();
    expect(screen.queryByText(/Completed!/i)).not.toBeInTheDocument();
  });

  it('skipped shows "Skipped" with an Undo action', () => {
    renderCard('skipped');
    expect(screen.getAllByText(/Skipped/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^Undo$/i })).toBeInTheDocument();
  });

  it('approved/none keeps the "Completed!" success footer', () => {
    renderCard(undefined);
    expect(screen.getByText(/Completed!/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Undo Completion/i })).toBeInTheDocument();
  });

  it('"Try Again" triggers onToggle (undo → re-do path)', () => {
    const onToggle = renderCard('rejected');
    fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
    expect(onToggle).toHaveBeenCalled();
  });
});
