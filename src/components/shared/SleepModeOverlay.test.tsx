// src/components/shared/SleepModeOverlay.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SleepModeOverlay } from './SleepModeOverlay';

describe('SleepModeOverlay', () => {
  it('renders a dark overlay with clock when active', () => {
    // using a fixed string since we bypass dynamic Date() for test stability
    render(<SleepModeOverlay isActive={true} fixedTime="10:00 PM" />);
    expect(screen.getByText('10:00 PM')).toBeInTheDocument();
  });

  it('renders nothing when not active', () => {
    const { container } = render(<SleepModeOverlay isActive={false} fixedTime="10:00 PM" />);
    expect(container.firstChild).toBeNull();
  });
});
