import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RewardsShop } from './RewardsShop';
import type { Reward, ClaimedReward } from '../../types';

const mockRewards: Reward[] = [
  { id: 'r1', parentId: 'p1', title: 'Extra Screen Time', description: '30 min extra', xpCost: 100, starCost: 100 },
  { id: 'r2', parentId: 'p1', title: 'Choose Dinner', description: 'Pick tonights dinner', xpCost: 50 },
];

const mockClaimed: ClaimedReward[] = [];

describe('RewardsShop', () => {
  it('renders reward cards with title and cost', () => {
    render(<RewardsShop rewards={mockRewards} claimedRewards={mockClaimed} kidXP={200} kidStars={150} onClaim={vi.fn()} />);
    expect(screen.getByText('Extra Screen Time')).toBeInTheDocument();
    expect(screen.getAllByText(/100/).length).toBeGreaterThan(0);
  });

  it('shows star cost when present', () => {
    render(<RewardsShop rewards={mockRewards} claimedRewards={mockClaimed} kidXP={200} kidStars={150} onClaim={vi.fn()} />);
    expect(screen.getByText(/100 ⭐/)).toBeInTheDocument();
  });

  it('disables claim button when XP insufficient', () => {
    render(<RewardsShop rewards={mockRewards} claimedRewards={mockClaimed} kidXP={30} kidStars={0} onClaim={vi.fn()} />);
    const buttons = screen.getAllByRole('button', { name: /claim|not enough/i });
    expect(buttons.every(b => b.hasAttribute('disabled'))).toBe(true);
  });

  it('disables claim button for already claimed reward', () => {
    const claimed: ClaimedReward[] = [{ id: 'c1', kidId: 'k1', rewardId: 'r1', createdAt: 0 }];
    render(<RewardsShop rewards={[mockRewards[0]]} claimedRewards={claimed} kidXP={500} kidStars={500} onClaim={vi.fn()} />);
    expect(screen.getByRole('button', { name: /claimed/i })).toBeDisabled();
  });

  it('shows XP balance info', () => {
    render(<RewardsShop rewards={mockRewards} claimedRewards={mockClaimed} kidXP={200} kidStars={150} onClaim={vi.fn()} />);
    expect(screen.getByText(/200/)).toBeInTheDocument();
  });
});
