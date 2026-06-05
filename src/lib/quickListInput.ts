import { AppList } from '../types';
import { getDefaultLocationOptions, getDefaultStoreNames } from './householdListPreferences';

type QuickListInputAnalysis = {
  cleanText: string;
  inferredStoreName?: string;
  inferredLocationName?: string;
  inferredStoreNames: string[];
  inferredLocationNames: string[];
  inferredExtraListIds: string[];
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function tokenize(value: string) {
  return normalize(value).split(' ').filter(Boolean);
}

function findPhraseStart(haystack: string[], needle: string[]) {
  if (needle.length === 0 || haystack.length < needle.length) return -1;
  for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    let matches = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) {
        matches = false;
        break;
      }
    }
    if (matches) return i;
  }
  return -1;
}

function stripPhrase(rawTokens: string[], phrase: string) {
  const phraseTokens = tokenize(phrase);
  const start = findPhraseStart(rawTokens, phraseTokens);
  if (start === -1) {
    return { matched: false, nextTokens: rawTokens };
  }

  return {
    matched: true,
    nextTokens: [...rawTokens.slice(0, start), ...rawTokens.slice(start + phraseTokens.length)],
  };
}

export function analyzeQuickListInput(
  rawText: string,
  availableLists: AppList[],
  primaryListId?: string | null,
  options?: { storeNames?: string[]; locationNames?: string[] },
): QuickListInputAnalysis {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { cleanText: '', inferredExtraListIds: [], inferredStoreNames: [], inferredLocationNames: [] };
  }

  const storeNames = options?.storeNames?.length ? options.storeNames : getDefaultStoreNames();
  const locationNames = options?.locationNames?.length ? options.locationNames : getDefaultLocationOptions().map((option) => option.label);

  const rawTokens = trimmed.split(/\s+/).filter(Boolean);
  const normalizedTokens = rawTokens.map(t => t.toLowerCase());

  let currentIndices = Array.from(rawTokens.keys());

  const strip = (phrase: string) => {
    const pTokens = tokenize(phrase);
    if (pTokens.length === 0) return false;
    
    let matchedAny = false;
    // Keep checking for the same phrase multiple times if it exists (e.g. "Costco Costco")
    let searchStart = 0;
    while (searchStart <= currentIndices.length - pTokens.length) {
      let matches = true;
      for (let j = 0; j < pTokens.length; j++) {
        if (normalizedTokens[currentIndices[searchStart + j]] !== pTokens[j]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        currentIndices.splice(searchStart, pTokens.length);
        matchedAny = true;
        // Don't increment searchStart, the next items have shifted down
      } else {
        searchStart++;
      }
    }
    return matchedAny;
  };

  // To avoid shorter names matching parts of longer names incorrectly, 
  // we must process ALL candidates (stores, locations, and list titles) 
  // in descending order of their token count/length.
  
  // Combine all candidates into a unified list to process by longest match first.
  // This prevents a shorter location (e.g., "School") from stealing tokens 
  // from a longer list title (e.g., "School Bus").
  type Candidate = {
    type: 'store' | 'location' | 'list';
    value: string;
    id?: string;
  };

  const candidates: Candidate[] = [
    ...storeNames.map(s => ({ type: 'store', value: s } as Candidate)),
    ...locationNames.map(l => ({ type: 'location', value: l } as Candidate)),
    ...availableLists
      .filter(l => l.id !== primaryListId)
      .map(l => ({ type: 'list', value: l.title, id: l.id } as Candidate))
  ];

  // Sort by token count DESC, then length DESC
  candidates.sort((a, b) => {
    const aTokens = tokenize(a.value).length;
    const bTokens = tokenize(b.value).length;
    if (aTokens !== bTokens) return bTokens - aTokens;
    return b.value.length - a.value.length;
  });

  const inferredStoreNames: string[] = [];
  const inferredLocationNames: string[] = [];
  const inferredExtraListIds: string[] = [];

  // 1. Always strip the primary list title first if it exists (highest priority)
  const primaryList = availableLists.find(l => l.id === primaryListId);
  if (primaryList) {
    strip(primaryList.title);
  }

  // 2. Process all other candidates in sorted order
  for (const candidate of candidates) {
    if (strip(candidate.value)) {
      if (candidate.type === 'store') inferredStoreNames.push(candidate.value);
      if (candidate.type === 'location') inferredLocationNames.push(candidate.value);
      if (candidate.type === 'list' && candidate.id) inferredExtraListIds.push(candidate.id);
    }
  }

  const cleanText = currentIndices.map(i => rawTokens[i]).join(' ').trim() || trimmed;

  return {
    cleanText,
    inferredStoreNames,
    inferredLocationNames,
    inferredExtraListIds: Array.from(new Set(inferredExtraListIds)),
    inferredStoreName: inferredStoreNames[0],
    inferredLocationName: inferredLocationNames[0],
  };
}
