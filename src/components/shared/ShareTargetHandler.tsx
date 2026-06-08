import { useEffect } from 'react';

export function ShareTargetHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const title = params.get('share_title') || '';
    const text = params.get('share_text') || '';
    const url = params.get('share_url') || '';

    if (!title && !text && !url) return;

    localStorage.setItem('kidtasker_shared_recipe_draft', JSON.stringify({
      title,
      text,
      url,
      capturedAt: Date.now(),
    }));
    window.history.replaceState({}, '', window.location.pathname);

    window.dispatchEvent(new CustomEvent('kidtasker:share'));
  }, []);

  return null;
}
