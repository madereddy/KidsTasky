// src/components/parent/ConnectedAccountsView.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConnectedAccountsView } from './ConnectedAccountsView';

describe('ConnectedAccountsView', () => {
  it('renders connection options', () => {
    // Note: The email is removed in the refactored ui
    render(<ConnectedAccountsView connections={[{ id: '1', provider: 'google' }]} onConnect={() => {}} onDisconnect={() => {}} />);
    
    expect(screen.getByText('Mission Uplinks')).toBeInTheDocument();
    expect(screen.getByText(/Link Active/i)).toBeInTheDocument();
  });
});
