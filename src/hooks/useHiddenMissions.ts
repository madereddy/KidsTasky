import { format } from 'date-fns';
import { useEffect, useState } from 'react';

const HIDDEN_MISSIONS_KEY = 'kidtasker_hidden_missions';

function loadHiddenMissionIds(): Set<string> {
  const stored = localStorage.getItem(HIDDEN_MISSIONS_KEY);
  const today = format(new Date(), 'yyyy-MM-dd');
  if (!stored) return new Set();

  try {
    const parsed = JSON.parse(stored);
    if (parsed.date === today && Array.isArray(parsed.ids)) {
      return new Set(parsed.ids);
    }
  } catch {}

  return new Set();
}

export function useHiddenMissions() {
  const [hiddenMissionIds, setHiddenMissionIds] = useState<Set<string>>(loadHiddenMissionIds);

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    localStorage.setItem(
      HIDDEN_MISSIONS_KEY,
      JSON.stringify({ date: today, ids: Array.from(hiddenMissionIds) }),
    );
  }, [hiddenMissionIds]);

  return { hiddenMissionIds, setHiddenMissionIds };
}
