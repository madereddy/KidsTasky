import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IntelligenceHeader } from './IntelligenceHeader';
import { DailyIntelligence } from '../../types';

describe('IntelligenceHeader', () => {
  const mockData: DailyIntelligence = {
    nextUp: {
      title: 'Soccer Practice',
      startTime: Date.now() + 1000 * 60 * 30, // 30 mins from now
      memberName: 'Alex',
      memberColor: '#ff0000',
    },
    meal: {
      id: 'meal-1',
      title: 'Taco Tuesday',
      ingredients: ['Shells', 'Beef', 'Cheese'],
    },
  };

  it('renders nothing if no data is provided', () => {
    const { container } = render(
      <IntelligenceHeader 
        data={{ nextUp: null, meal: null }} 
        onAddIngredients={() => {}} 
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders next up event', () => {
    render(
      <IntelligenceHeader 
        data={{ ...mockData, meal: null }} 
        onAddIngredients={() => {}} 
      />
    );
    expect(screen.getByText('Soccer Practice')).toBeInTheDocument();
    expect(screen.getByText(/Alex/)).toBeInTheDocument();
  });

  it('renders meal info', () => {
    render(
      <IntelligenceHeader 
        data={{ ...mockData, nextUp: null }} 
        onAddIngredients={() => {}} 
      />
    );
    expect(screen.getByText('Taco Tuesday')).toBeInTheDocument();
    expect(screen.getByText('Add ingredients to list')).toBeInTheDocument();
  });

  it('calls onAddIngredients when button is clicked', () => {
    const onAddIngredients = vi.fn();
    render(
      <IntelligenceHeader 
        data={mockData} 
        onAddIngredients={onAddIngredients} 
      />
    );
    fireEvent.click(screen.getByText('Add ingredients to list'));
    expect(onAddIngredients).toHaveBeenCalled();
  });

  it('applies evening prominence classes after 3:00 PM', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 16, 0)); // 4:00 PM
    
    const { container } = render(
      <IntelligenceHeader 
        data={mockData} 
        onAddIngredients={() => {}} 
      />
    );
    
    const mealCard = container.querySelector('.border-orange-200');
    expect(mealCard).toBeInTheDocument();
    expect(mealCard).toHaveClass('ring-4');
    
    vi.useRealTimers();
  });

  it('does not apply evening prominence classes before 3:00 PM', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 10, 0)); // 10:00 AM
    
    const { container } = render(
      <IntelligenceHeader 
        data={mockData} 
        onAddIngredients={() => {}} 
      />
    );
    
    const mealCard = container.querySelector('.border-gray-100');
    expect(mealCard).toBeInTheDocument();
    expect(mealCard).not.toHaveClass('ring-4');
    
    vi.useRealTimers();
  });
});
