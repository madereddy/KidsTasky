import { COMMON_LOCATIONS, COMMON_STORES } from '../constants';
import { AppList } from '../types';

type QuickListInputAnalysis = {
  cleanText: string;
  inferredStoreName?: string;
  inferredLocationName?: string;
  inferredExtraListIds: string[];
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removePhrase(source: string, phrase: string) {
  return source.replace(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i'), ' ');
}

export function analyzeQuickListInput(
  rawText: string,
  availableLists: AppList[],
  primaryListId?: string | null,
): QuickListInputAnalysis {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { cleanText: '', inferredExtraListIds: [] };
  }

  let working = trimmed;

  const matchedStore = [...COMMON_STORES]
    .sort((a, b) => b.length - a.length)
    .find((store) => new RegExp(`\\b${escapeRegExp(store)}\\b`, 'i').test(working));
  if (matchedStore) {
    working = removePhrase(working, matchedStore);
  }

  const matchedLocation = [...COMMON_LOCATIONS]
    .sort((a, b) => b.label.length - a.label.length)
    .find((location) => new RegExp(`\\b${escapeRegExp(location.label)}\\b`, 'i').test(working));
  if (matchedLocation) {
    working = removePhrase(working, matchedLocation.label);
  }

  const inferredExtraListIds: string[] = [];
  for (const list of [...availableLists].sort((a, b) => b.title.length - a.title.length)) {
    if (list.id === primaryListId) continue;
    if (!list.title.trim()) continue;
    if (new RegExp(`\\b${escapeRegExp(list.title)}\\b`, 'i').test(working)) {
      inferredExtraListIds.push(list.id);
      working = removePhrase(working, list.title);
    }
  }

  const cleanText = working.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').trim() || trimmed;

  return {
    cleanText,
    inferredStoreName: matchedStore,
    inferredLocationName: matchedLocation?.label,
    inferredExtraListIds: Array.from(new Set(inferredExtraListIds)),
  };
}
