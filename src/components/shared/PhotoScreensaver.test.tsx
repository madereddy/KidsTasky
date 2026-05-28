// src/components/shared/PhotoScreensaver.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhotoScreensaver } from './PhotoScreensaver';
import { photosClientService } from '../../services/photos';

vi.mock('../../services/photos', () => ({
  photosClientService: {
    getPhotos: vi.fn(),
  },
}));

describe('PhotoScreensaver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (photosClientService.getPhotos as any).mockResolvedValue([]);
  });

  it('renders screensaver when forceIdle is true', () => {
    const photos = [{ id: '1', url: 'https://example.com/a.jpg' }];
    render(<PhotoScreensaver photos={photos} forceIdle={true} />);
    
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/a.jpg');
  });

  it('dismisses preview on click via onDismiss', () => {
    const onDismiss = vi.fn();
    const photos = [{ id: '1', url: 'https://example.com/a.jpg' }];
    render(<PhotoScreensaver photos={photos} forceIdle={true} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('img'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not fetch photos before idle when not forced', () => {
    render(<PhotoScreensaver parentId="p1" forceIdle={false} />);
    expect(photosClientService.getPhotos).not.toHaveBeenCalled();
  });
});
