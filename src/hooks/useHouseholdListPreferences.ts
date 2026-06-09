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

  const locationOptions = useMemo(
    () => getHouseholdLocationOptions(settings),
    [settings],
  );

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
    const customStoreNames = sanitizeStoreNames(nextStoreNames);
    await savePartial({ customStoreNames });
    return customStoreNames;
  };

  const saveLocationNames = async (nextLocationNames: string[]) => {
    const customLocationNames = sanitizeLocationNames(nextLocationNames);
    await savePartial({ customLocationNames });
    return customLocationNames;
  };

  return {
    settings,
    saving,
    storeNames,
    locationOptions,
    saveStoreNames,
    saveLocationNames,
  };
}
