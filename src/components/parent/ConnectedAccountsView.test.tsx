// src/components/parent/ConnectedAccountsView.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConnectedAccountsView } from './ConnectedAccountsView';

describe('ConnectedAccountsView', () => {
  it('renders connection options', () => {
    // Note: The email is removed in the refactored ui
    render(<ConnectedAccountsView connections={[{ id: '1', provider: 'google' }]} onConnect={() => {}} onDisconnect={() => {}} />);
    
    expect(screen.getByText('Mission Uplinks')).toBeInTheDocument();
    expect(screen.getByText(/Link Active/i)).toBeInTheDocument();
  });

  it('renders discovered calendar toggles', () => {
    const onToggle = vi.fn();
    render(
      <ConnectedAccountsView
        connections={[{ id: 'conn_1', provider: 'google' }]}
        calendars={[{
          id: 'cal_1',
          connectionId: 'conn_1',
          parentId: 'parent_1',
          calendarId: 'shared@example.com',
          name: 'Soccer Schedule',
          enabled: 1,
        }]}
        onConnect={() => {}}
        onDisconnect={() => {}}
        onToggleCalendar={onToggle}
      />
    );

    fireEvent.click(screen.getByLabelText('Disable Soccer Schedule'));

    expect(screen.getByText('Soccer Schedule')).toBeInTheDocument();
    expect(onToggle).toHaveBeenCalledWith('cal_1', false);
  });
});
