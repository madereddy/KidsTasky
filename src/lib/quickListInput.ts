import { COMMON_LOCATIONS, COMMON_STORES } from '../constants';
import { AppList } from '../types';

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
): QuickListInputAnalysis {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { cleanText: '', inferredExtraListIds: [] };
  }

  let workingTokens = tokenize(trimmed);

  let inferredStoreName: string | undefined;
  for (const store of [...COMMON_STORES].sort((a, b) => b.length - a.length)) {
    const { matched, nextTokens } = stripPhrase(workingTokens, store);
    if (matched) {
      inferredStoreName = store;
      workingTokens = nextTokens;
      break;
    }
  }

  let inferredLocationName: string | undefined;
  for (const location of [...COMMON_LOCATIONS].sort((a, b) => b.label.length - a.label.length)) {
    const { matched, nextTokens } = stripPhrase(workingTokens, location.label);
    if (matched) {
      inferredLocationName = location.label;
      workingTokens = nextTokens;
      break;
    }
  }

  const inferredExtraListIds: string[] = [];
  for (const list of [...availableLists].sort((a, b) => b.title.length - a.title.length)) {
    if (list.id === primaryListId) continue;
    const { matched, nextTokens } = stripPhrase(workingTokens, list.title);
    if (matched) {
      inferredExtraListIds.push(list.id);
      workingTokens = nextTokens;
    }
  }

  const cleanText = workingTokens.join(' ').trim() || trimmed;

  return {
    cleanText,
    inferredStoreName,
    inferredLocationName,
    inferredExtraListIds: Array.from(new Set(inferredExtraListIds)),
  };
}
