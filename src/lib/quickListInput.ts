import { AppList } from '../types';
import { getDefaultLocationOptions, getDefaultStoreNames } from './householdListPreferences';

type QuickListInputAnalysis = {
  cleanText: string;
  inferredStoreName?: string;
  inferredLocationName?: string;
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
    return { cleanText: '', inferredExtraListIds: [] };
  }

  const storeNames = options?.storeNames?.length ? options.storeNames : getDefaultStoreNames();
  const locationNames = options?.locationNames?.length ? options.locationNames : getDefaultLocationOptions().map((option) => option.label);

  const rawTokens = trimmed.split(/\s+/).filter(Boolean);
  const normalizedTokens = rawTokens.map(t => t.toLowerCase());

  let currentIndices = Array.from(rawTokens.keys());

  const strip = (phrase: string) => {
    const pTokens = tokenize(phrase);
    if (pTokens.length === 0) return false;
    
    for (let i = 0; i <= currentIndices.length - pTokens.length; i++) {
      let matches = true;
      for (let j = 0; j < pTokens.length; j++) {
        if (normalizedTokens[currentIndices[i + j]] !== pTokens[j]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        currentIndices.splice(i, pTokens.length);
        return true;
      }
    }
    return false;
  };

  let inferredStoreName: string | undefined;
  for (const store of [...storeNames].sort((a, b) => b.length - a.length)) {
    if (strip(store)) {
      inferredStoreName = store;
      break;
    }
  }

  let inferredLocationName: string | undefined;
  for (const location of [...locationNames].sort((a, b) => b.length - a.length)) {
    if (strip(location)) {
      inferredLocationName = location;
      break;
    }
  }

  const inferredExtraListIds: string[] = [];
  for (const list of [...availableLists].sort((a, b) => b.title.length - a.title.length)) {
    if (list.id === primaryListId) continue;
    if (strip(list.title)) {
      inferredExtraListIds.push(list.id);
    }
  }

  const cleanText = currentIndices.map(i => rawTokens[i]).join(' ').trim() || trimmed;

  return {
    cleanText,
    inferredStoreName,
    inferredLocationName,
    inferredExtraListIds: Array.from(new Set(inferredExtraListIds)),
  };
}
