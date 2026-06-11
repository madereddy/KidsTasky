import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FrequentItemChips } from './FrequentItemChips';
import { describe, it, expect, vi } from 'vitest';

describe('FrequentItemChips', () => {
  it('renders nothing if items list is empty', () => {
    const { container } = render(<FrequentItemChips items={[]} onAdd={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a list of chips for the provided items', () => {
    const items = ['Milk', 'Bread', 'Eggs'];
    render(<FrequentItemChips items={items} onAdd={() => {}} />);
    
    expect(screen.getByText('+ Milk')).toBeInTheDocument();
    expect(screen.getByText('+ Bread')).toBeInTheDocument();
    expect(screen.getByText('+ Eggs')).toBeInTheDocument();
  });

  it('calls onAdd when a chip is clicked', () => {
    const items = ['Milk'];
    const onAdd = vi.fn();
    render(<FrequentItemChips items={items} onAdd={onAdd} />);
    
    fireEvent.click(screen.getByText('+ Milk'));
    expect(onAdd).toHaveBeenCalledWith('Milk');
  });
});
