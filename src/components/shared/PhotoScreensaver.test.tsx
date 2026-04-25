// src/components/shared/PhotoScreensaver.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PhotoScreensaver } from './PhotoScreensaver';

describe('PhotoScreensaver', () => {
  it('renders screensaver when forceIdle is true', () => {
    const photos = [{ id: '1', url: 'https://example.com/a.jpg' }];
    render(<PhotoScreensaver photos={photos} forceIdle={true} />);
    
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/a.jpg');
  });
});
