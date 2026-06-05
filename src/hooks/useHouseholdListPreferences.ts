import { useEffect, useMemo, useState } from 'react';
import { settingsClientService } from '../services/settings';
import { FamilySettings } from '../types';
import {
  getHouseholdLocationOptions,
  getHouseholdStoreNames,
  getDefaultLocationOptions,
  getDefaultStoreNames,
  sanitizeLocationNames,
  sanitizeStoreNames,
} from '../lib/householdListPreferences';

export function useHouseholdListPreferences(parentId: string) {
  const [settings, setSettings] = useState<FamilySettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!parentId) {
      setSettings(null);
      return;
    }

    settingsClientService.getSettings(parentId)
      .then((nextSettings) => {
        if (!cancelled) setSettings(nextSettings);
      })
      .catch(() => {
        if (!cancelled) setSettings(null);
      });

    return () => {
      cancelled = true;
    };
  }, [parentId]);

  const storeNames = useMemo(
    () => getHouseholdStoreNames(settings),
    [settings],
  );
  const customStoreNames = settings?.customStoreNames ?? [];

  const locationOptions = useMemo(
    () => getHouseholdLocationOptions(settings),
    [settings],
  );
  const customLocationNames = settings?.customLocationNames ?? [];

  const savePartial = async (partial: Partial<FamilySettings>) => {
    if (!parentId) return;
    setSaving(true);
    try {
      await settingsClientService.saveSettings(parentId, partial);
      setSettings((prev) => ({ ...(prev ?? { parentId }), ...partial } as FamilySettings));
    } finally {
      setSaving(false);
    }
  };

  const saveStoreNames = async (nextStoreNames: string[]) => {
    const defaultStores = new Set(getDefaultStoreNames().map((value) => value.toLowerCase()));
    const customStoreNames = sanitizeStoreNames(nextStoreNames)
      .filter((value) => !defaultStores.has(value.toLowerCase()));
    await savePartial({ customStoreNames });
    return customStoreNames;
  };

  const saveLocationNames = async (nextLocationNames: string[]) => {
    const defaultLabels = new Set(getDefaultLocationOptions().map((option) => option.label.toLowerCase()));
    const customLocationNames = sanitizeLocationNames(nextLocationNames)
      .filter((value) => !defaultLabels.has(value.toLowerCase()));
    await savePartial({ customLocationNames });
    return customLocationNames;
  };

  return {
    settings,
    saving,
    storeNames,
    customStoreNames,
    locationOptions,
    customLocationNames,
    saveStoreNames,
    saveLocationNames,
  };
}
