// src/components/parent/ConnectedAccountsView.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConnectedAccountsView } from './ConnectedAccountsView';

describe('ConnectedAccountsView', () => {
  it('renders connection options', () => {
    render(<ConnectedAccountsView connections={[{ id: '1', provider: 'google', email: 'test@gmail.com' }]} onConnect={() => {}} onDisconnect={() => {}} />);
    
    expect(screen.getByText('Connected Accounts')).toBeInTheDocument();
    expect(screen.getByText('test@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });
});
