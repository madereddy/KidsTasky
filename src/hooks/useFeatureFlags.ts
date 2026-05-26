import { useState, useEffect, useCallback } from 'react';
import { FeatureFlags } from '../types.js';

const API_BASE = '/api';

const DEFAULTS: FeatureFlags = {
  wall_v2_layout: true,
  sync_diagnostics: true,
  calendar_visibility_profiles: true,
};

export function useFeatureFlags(parentId: string | undefined): {
  flags: FeatureFlags;
  setFlag: (flag: keyof FeatureFlags, enabled: boolean) => Promise<void>;
  loading: boolean;
} {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    if (!parentId) { setLoading(false); return; }
    try {
      const token = localStorage.getItem('kidtasker_token');
      const res = await fetch(`${API_BASE}/settings/${parentId}/flags`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setFlags(await res.json());
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const setFlag = useCallback(async (flag: keyof FeatureFlags, enabled: boolean) => {
    if (!parentId) return;
    const token = localStorage.getItem('kidtasker_token');
    const res = await fetch(`${API_BASE}/settings/${parentId}/flags/${flag}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) setFlags((prev) => ({ ...prev, [flag]: enabled }));
  }, [parentId]);

  return { flags, setFlag, loading };
}
