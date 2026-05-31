import React, { useState, useEffect } from 'react';
import { FamilyPhoto } from '../../types';
import { photosClientService } from '../../services/photos';
import { AuthImage } from './AuthImage';

interface ScreensaverProps {
  photos?: { id: string; url: string; caption?: string }[];
  parentId?: string;
  idleMinutes?: number;
  forceIdle?: boolean;
  onDismiss?: () => void;
  shuffleEnabled?: boolean;
  displayDurationSec?: number;
  showCaptions?: boolean;
}

export function PhotoScreensaver({ photos = [], parentId, idleMinutes = 5, forceIdle = false, onDismiss, shuffleEnabled = false, displayDurationSec = 10, showCaptions = true }: ScreensaverProps) {
  const normalizePhotos = (items: { id: string; url: string; caption?: string }[]): FamilyPhoto[] => {
    const normalized = items.map((p) => ({
      id: p.id,
      parentId: parentId ?? "",
      url: p.url,
      uploadedAt: "",
      caption: p.caption
    }));
    if (shuffleEnabled) {
      for (let i = normalized.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [normalized[i], normalized[j]] = [normalized[j], normalized[i]];
      }
    }
    return normalized;
  };

  const [isIdle, setIsIdle] = useState(forceIdle);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedPhotos, setLoadedPhotos] = useState<FamilyPhoto[]>(normalizePhotos(photos));

  useEffect(() => {
    if (forceIdle) {
      setIsIdle(true);
    } else {
      setIsIdle(false);
    }
  }, [forceIdle]);

  useEffect(() => {
    setLoadedPhotos(normalizePhotos(photos));
  }, [photos, parentId]);

  useEffect(() => {
    if (!parentId) return;
    if (!isIdle && !forceIdle) return;
    photosClientService.getPhotos(parentId).then(setLoadedPhotos).catch(() => {});
  }, [parentId, isIdle, forceIdle]);

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
    }, displayDurationSec * 1000);
    return () => clearInterval(interval);
  }, [isIdle, loadedPhotos.length, displayDurationSec]);

  useEffect(() => {
    if (!forceIdle || !onDismiss) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [forceIdle, onDismiss]);

  if (!isIdle || loadedPhotos.length === 0) return null;

  const current = loadedPhotos[currentIndex];
  const handleDismiss = () => {
    if (forceIdle && onDismiss) {
      onDismiss();
      return;
    }
    setIsIdle(false);
  };
  return (
    <div
      className="fixed inset-0 z-[110] bg-ui-deep flex items-center justify-center"
      onClick={handleDismiss}
    >
      <AuthImage src={current.url} alt={current.caption || 'Screensaver'} className="w-full h-full object-cover transition-opacity duration-1000 ken-burns" />
      {forceIdle && onDismiss && (
        <div className="absolute top-4 right-4 text-xs text-white/90 bg-black/50 rounded-md px-2 py-1">
          Preview mode: click or press Esc to exit
        </div>
      )}
      {showCaptions && current.caption && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-white text-center text-sm">
          {current.caption}
        </div>
      )}
    </div>
  );
}
