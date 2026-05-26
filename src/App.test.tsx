// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Component', () => {
  it('renders LoginView when not authenticated', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Parent Email or Username/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Family Hub')).toBeInTheDocument();
  });
});
