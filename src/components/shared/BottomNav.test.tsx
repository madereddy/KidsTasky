// src/components/shared/BottomNav.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
  it('renders buttons and handles clicks', () => {
    const onSelect = vi.fn();
    render(<BottomNav activeTab="calendar" onTabSelect={onSelect} />);
    
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Tasks'));
    expect(onSelect).toHaveBeenCalledWith('tasks');
  });
});
