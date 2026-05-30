import { useState, useEffect } from 'react';

const LOCAL_PHOTO_PREFIXES = ['/api/photos/file/', '/uploads/photos/'];

function isLocalPhoto(url: string | null | undefined): boolean {
  if (!url) return false;
  return LOCAL_PHOTO_PREFIXES.some(prefix => url.startsWith(prefix));
}

export function useAuthImage(url: string | null | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      return;
    }

    if (!isLocalPhoto(url)) {
      // External URL (Google Photos, etc.) — use directly
      setBlobUrl(url);
      return;
    }

    const token = localStorage.getItem('kidtasker_token');
    let objectUrl: string | null = null;
    let cancelled = false;

    // Normalize legacy /uploads/photos/ URLs to the auth endpoint
    const authUrl = url.startsWith('/uploads/photos/')
      ? url.replace('/uploads/photos/', '/api/photos/file/')
      : url;

    fetch(authUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.blob();
      })
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return blobUrl;
}
