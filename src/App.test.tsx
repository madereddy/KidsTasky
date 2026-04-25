// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

// Mock taskService to avoid real API calls during frontend tests
vi.mock('./services/taskService', () => ({
  taskService: {
    getUserProfile: vi.fn().mockResolvedValue(null),
    getCategories: vi.fn().mockResolvedValue([])
  }
}));

describe('App Component', () => {
  it('should render LoginView when not authenticated', async () => {
    render(<App />);

    // Wait until the new placeholder is rendered
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Contact Frequency \(Email\)/i)).toBeInTheDocument();
    });
    
    // Ensure the title is rendered
    expect(screen.getByText('KidTasker')).toBeInTheDocument();
  });
});
