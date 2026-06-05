// src/components/shared/BottomNav.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
  it('renders parent buttons and handles clicks', () => {
    const onSelect = vi.fn();
    render(<BottomNav activeTab="calendar" onTabSelect={onSelect} role="parent" />);
    
    expect(screen.getByText('Cal')).toBeInTheDocument();
    expect(screen.getByText('Shop')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Shop'));
    expect(onSelect).toHaveBeenCalledWith('shopping');
  });

  it('renders kid buttons and handles clicks', () => {
    const onSelect = vi.fn();
    render(<BottomNav activeTab="home" onTabSelect={onSelect} role="kid" />);

    expect(screen.getByText('Tasks')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tasks'));
    expect(onSelect).toHaveBeenCalledWith('tasks');
  });
});
