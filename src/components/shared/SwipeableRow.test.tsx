// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SwipeableRow } from './SwipeableRow';
import React from 'react';

// Mock framer-motion/motion/react to avoid issues with MotionValue in JSDOM
// Though we want to test if it renders correctly.
// We'll use the real one first and see.

describe('SwipeableRow', () => {
  it('renders children and labels', () => {
    const onSwipeRight = vi.fn();
    const onSwipeLeft = vi.fn();
    
    render(
      <SwipeableRow 
        onSwipeRight={onSwipeRight} 
        onSwipeLeft={onSwipeLeft}
        rightLabel="Done"
        leftLabel="Dismiss"
      >
        <div>Test Content</div>
      </SwipeableRow>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });
});
