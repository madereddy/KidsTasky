// src/components/parent/PinPad.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PinPad } from './PinPad';

describe('PinPad', () => {
  it('calls onComplete with entered pin', () => {
    const onComplete = vi.fn();
    render(<PinPad onComplete={onComplete} />);
    
    // the pinpad should have digit buttons
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('4'));
    
    expect(onComplete).toHaveBeenCalledWith('1234');
  });
});
