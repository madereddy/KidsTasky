import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoManager } from './PhotoManager';

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    getPhotos: vi.fn(),
    uploadPhoto: vi.fn(),
    updateCaption: vi.fn(),
    deletePhoto: vi.fn(),
    getGoogleAlbumMedia: vi.fn(),
  },
}));

vi.mock('../../services/photos', () => ({
  photosClientService: serviceMock,
}));

describe('PhotoManager caption keyboard flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.getPhotos.mockResolvedValue([
      {
        id: 'p1',
        parentId: 'parent-1',
        url: 'https://example.com/photo.jpg',
        uploadedAt: '2026-05-27T00:00:00.000Z',
        caption: 'Original caption',
      },
    ]);
    serviceMock.updateCaption.mockResolvedValue({ success: true });
  });

  it('saves caption on Enter', async () => {
    render(<PhotoManager parentId="parent-1" />);
    await screen.findByText('Original caption');

    fireEvent.click(screen.getByRole('button', { name: 'Original caption' }));
    const input = await screen.findByDisplayValue('Original caption');
    fireEvent.change(input, { target: { value: 'Updated caption' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(serviceMock.updateCaption).toHaveBeenCalledWith('p1', 'Updated caption');
    });
  });

  it('cancels edit on Escape without saving', async () => {
    render(<PhotoManager parentId="parent-1" />);
    await screen.findByText('Original caption');

    fireEvent.click(screen.getByRole('button', { name: 'Original caption' }));
    const input = await screen.findByDisplayValue('Original caption');
    fireEvent.change(input, { target: { value: 'Draft caption' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByDisplayValue('Draft caption')).not.toBeInTheDocument();
    });
    expect(serviceMock.updateCaption).not.toHaveBeenCalled();
  });
});
