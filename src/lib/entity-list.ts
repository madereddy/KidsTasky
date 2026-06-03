export function sortEntities<T>(items: T[], compare: (left: T, right: T) => number): T[] {
  return [...items].sort(compare);
}

export function removeEntityById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

export function replaceEntityById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

export function upsertEntityById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  const exists = items.some((item) => item.id === nextItem.id);
  return exists ? replaceEntityById(items, nextItem) : [...items, nextItem];
}

export function upsertEntityByIdSorted<T extends { id: string }>(
  items: T[],
  nextItem: T,
  compare: (left: T, right: T) => number,
): T[] {
  return sortEntities(upsertEntityById(items, nextItem), compare);
}
