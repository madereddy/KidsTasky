import React, { useState, useEffect } from 'react';
import { FamilyPhoto } from '../../types';
import { photosClientService } from '../../services/photos';

interface ScreensaverProps {
  photos?: { id: string; url: string; caption?: string }[];
  parentId?: string;
  idleMinutes?: number;
  forceIdle?: boolean;
}

export function PhotoScreensaver({ photos = [], parentId, idleMinutes = 5, forceIdle = false }: ScreensaverProps) {
  const normalizePhotos = (items: { id: string; url: string; caption?: string }[]): FamilyPhoto[] =>
    items.map((p) => ({
      id: p.id,
      parentId: parentId ?? "",
      url: p.url,
      uploadedAt: "",
      caption: p.caption
    }));

  const [isIdle, setIsIdle] = useState(forceIdle);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedPhotos, setLoadedPhotos] = useState<FamilyPhoto[]>(normalizePhotos(photos));

  useEffect(() => {
    setLoadedPhotos(normalizePhotos(photos));
  }, [photos, parentId]);

  useEffect(() => {
    if (!parentId) return;
    photosClientService.getPhotos(parentId).then(setLoadedPhotos).catch(() => {});
  }, [parentId]);

  useEffect(() => {
    if (forceIdle) return;
    let timer: ReturnType<typeof setTimeout>;

    const resetIdle = () => {
      setIsIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIsIdle(true), idleMinutes * 60000);
    };

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('touchstart', resetIdle);
    resetIdle();

    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('touchstart', resetIdle);
      clearTimeout(timer);
    };
  }, [idleMinutes, forceIdle]);

  useEffect(() => {
    if (!isIdle || loadedPhotos.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % loadedPhotos.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [isIdle, loadedPhotos.length]);

  if (!isIdle || loadedPhotos.length === 0) return null;

  const current = loadedPhotos[currentIndex];
  return (
    <div className="fixed inset-0 z-[110] bg-black flex items-center justify-center">
      <img src={current.url} alt={current.caption || 'Screensaver'} className="w-full h-full object-cover transition-opacity duration-1000" />
      {current.caption && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-white text-center text-sm">
          {current.caption}
        </div>
      )}
    </div>
  );
}
