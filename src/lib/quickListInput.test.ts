import { describe, expect, it } from 'vitest';
import { analyzeQuickListInput } from './quickListInput';

describe('analyzeQuickListInput', () => {
  it('infers custom household stores and locations', () => {
    const result = analyzeQuickListInput(
      'Water Bottle Publix Baseball',
      [{ id: 'routine-1', parentId: 'p1', title: 'Soccer', category: 'routine', isRoutine: 0, createdAt: '', updatedAt: '' }],
      null,
      { storeNames: ['Publix'], locationNames: ['Baseball'] },
    );

    expect(result.cleanText).toBe('Water Bottle');
    expect(result.inferredStoreName).toBe('Publix');
    expect(result.inferredLocationName).toBe('Baseball');
  });

  it('infers matching extra list ids after removing household tags', () => {
    const result = analyzeQuickListInput(
      'Water Bottle Publix Soccer',
      [
        { id: 'routine-1', parentId: 'p1', title: 'Morning', category: 'routine', isRoutine: 1, createdAt: '', updatedAt: '' },
        { id: 'routine-2', parentId: 'p1', title: 'Soccer', category: 'routine', isRoutine: 0, createdAt: '', updatedAt: '' },
      ],
      'routine-1',
      { storeNames: ['Publix'], locationNames: ['Home'] },
    );

    expect(result.cleanText).toBe('Water Bottle');
    expect(result.inferredStoreName).toBe('Publix');
    expect(result.inferredExtraListIds).toEqual(['routine-2']);
  });
});
