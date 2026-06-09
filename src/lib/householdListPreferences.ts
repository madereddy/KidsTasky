import { FamilySettings } from '../types';

export type HouseholdLocationOption = {
  id: string;
  label: string;
};

const DEFAULT_STORE_NAMES = ['Costco', 'Walmart', 'Target', 'Whole Foods'];
const DEFAULT_LOCATION_OPTIONS: HouseholdLocationOption[] = [
  { id: 'home', label: 'Home' },
  { id: 'car', label: 'Car' },
  { id: 'school', label: 'School' },
  { id: 'soccer', label: 'Soccer' },
  { id: 'stores', label: 'Stores' },
];

function normalizeTag(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeTagKey(value: string) {
  return normalizeTag(value).toLowerCase();
}

function slugify(value: string) {
  return normalizeTagKey(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'custom';
}

function mergeUnique(values: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const trimmed = normalizeTag(value);
    if (!trimmed) continue;
    const key = normalizeTagKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(trimmed);
  }
  return next;
}

export function getDefaultStoreNames() {
  return [...DEFAULT_STORE_NAMES];
}

export function getDefaultLocationOptions() {
  return [...DEFAULT_LOCATION_OPTIONS];
}

export function sanitizeStoreNames(values: string[]) {
  return mergeUnique(values);
}

export function sanitizeLocationNames(values: string[]) {
  return mergeUnique(values);
}

export function getHouseholdStoreNames(settings?: Pick<FamilySettings, 'customStoreNames'> | null) {
  if (settings && Array.isArray(settings.customStoreNames)) {
    return settings.customStoreNames;
  }
  return [...DEFAULT_STORE_NAMES];
}

export function getHouseholdLocationOptions(settings?: Pick<FamilySettings, 'customLocationNames'> | null) {
  const labels = (settings && Array.isArray(settings.customLocationNames))
    ? settings.customLocationNames
    : DEFAULT_LOCATION_OPTIONS.map((option) => option.label);

  return labels.map((label) => {
    const preset = DEFAULT_LOCATION_OPTIONS.find((option) => normalizeTagKey(option.label) === normalizeTagKey(label));
    return preset ?? { id: slugify(label), label };
  });
}

export function extractHouseholdTagFromText(
  rawText: string,
  storeNames: string[],
  locationNames: string[],
) {
  const match = rawText.match(/(.+?)(?:\s+@\s+|\s+at\s+)(.+)$/i);
  if (!match) {
    return { cleanText: rawText.trim() };
  }

  const cleanText = match[1].trim();
  const candidate = normalizeTag(match[2]);
  const candidateKey = normalizeTagKey(candidate);

  const matchedStore = storeNames.find((store) => normalizeTagKey(store) === candidateKey);
  if (matchedStore) {
    return { cleanText, storeName: matchedStore };
  }

  const matchedLocation = locationNames.find((location) => normalizeTagKey(location) === candidateKey);
  if (matchedLocation) {
    return { cleanText, locationName: matchedLocation };
  }

  return { cleanText: rawText.trim() };
}
