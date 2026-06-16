// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WallWakeOverlay } from './WallWakeOverlay';
import type { PowerMission } from '../../types';

vi.mock('../shared/IntelligenceHeader', () => ({
  IntelligenceHeader: () => <div data-testid="intelligence-header">IntelligenceHeader</div>,
}));
vi.mock('./PowerMissionCard', () => ({
  PowerMissionCard: ({ mission }: any) => mission ? <div data-testid="power-mission">PowerMission</div> : null,
}));
vi.mock('./GroceryChips', () => ({
  GroceryChips: ({ items }: any) => items.length > 0 ? <div data-testid="grocery-chips">GroceryChips</div> : null,
}));

const baseProps = {
  onDismiss: vi.fn(),
  intelligence: { nextUp: null, meal: null },
  powerMission: null,
  frequentItems: [],
  wallMode: 'ambient' as const,
  onAddIngredients: vi.fn(),
  onQuickAdd: vi.fn(),
};

describe('WallWakeOverlay', () => {
  it('renders IntelligenceHeader', () => {
    render(<WallWakeOverlay {...baseProps} />);
    expect(screen.getByTestId('intelligence-header')).toBeInTheDocument();
  });

  it('calls onDismiss when clicked', () => {
    const onDismiss = vi.fn();
    render(<WallWakeOverlay {...baseProps} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('intelligence-header'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders PowerMissionCard in morning wallMode', () => {
    render(
      <WallWakeOverlay
        {...baseProps}
        wallMode="morning"
        powerMission={{ taskId: '1', title: 'Clean room', xpReward: 50, assignedKidId: 'k1', assignedKidName: 'Emma' } as PowerMission}
      />
    );
    expect(screen.getByTestId('power-mission')).toBeInTheDocument();
  });

  it('hides PowerMissionCard in ambient wallMode', () => {
    render(
      <WallWakeOverlay
        {...baseProps}
        wallMode="ambient"
        powerMission={{ taskId: '1', title: 'Clean room', xpReward: 50, assignedKidId: 'k1', assignedKidName: 'Emma' } as PowerMission}
      />
    );
    expect(screen.queryByTestId('power-mission')).not.toBeInTheDocument();
  });

  it('renders GroceryChips when items present and not night', () => {
    render(
      <WallWakeOverlay
        {...baseProps}
        wallMode="morning"
        frequentItems={['milk', 'eggs']}
      />
    );
    expect(screen.getByTestId('grocery-chips')).toBeInTheDocument();
  });

  it('hides GroceryChips in night wallMode', () => {
    render(
      <WallWakeOverlay
        {...baseProps}
        wallMode="night"
        frequentItems={['milk', 'eggs']}
      />
    );
    expect(screen.queryByTestId('grocery-chips')).not.toBeInTheDocument();
  });
});
