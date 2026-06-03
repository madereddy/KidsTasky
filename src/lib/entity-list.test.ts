import { describe, expect, it } from 'vitest';
import {
  removeEntityById,
  replaceEntityById,
  sortEntities,
  upsertEntityById,
  upsertEntityByIdSorted,
} from './entity-list';

describe('entity-list helpers', () => {
  it('removes an entity by id', () => {
    expect(removeEntityById([{ id: 'a' }, { id: 'b' }], 'a')).toEqual([{ id: 'b' }]);
  });

  it('replaces an entity by id', () => {
    expect(replaceEntityById([{ id: 'a', value: 1 }, { id: 'b', value: 2 }], { id: 'b', value: 3 })).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 3 },
    ]);
  });

  it('upserts an entity by id', () => {
    expect(upsertEntityById([{ id: 'a' }], { id: 'b' })).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(upsertEntityById([{ id: 'a', value: 1 }], { id: 'a', value: 2 })).toEqual([{ id: 'a', value: 2 }]);
  });

  it('upserts and sorts entities', () => {
    const compare = (left: { id: string; order: number }, right: { id: string; order: number }) => left.order - right.order;
    expect(upsertEntityByIdSorted([{ id: 'a', order: 2 }], { id: 'b', order: 1 }, compare)).toEqual([
      { id: 'b', order: 1 },
      { id: 'a', order: 2 },
    ]);
  });

  it('sorts entities with the provided comparator', () => {
    const compare = (left: { value: number }, right: { value: number }) => left.value - right.value;
    expect(sortEntities([{ value: 3 }, { value: 1 }, { value: 2 }], compare)).toEqual([
      { value: 1 },
      { value: 2 },
      { value: 3 },
    ]);
  });
});
