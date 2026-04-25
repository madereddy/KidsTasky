// src/components/shared/PhotoScreensaver.tsx
import React, { useState, useEffect } from 'react';

interface ScreensaverProps {
  photos: { id: string, url: string }[];
  idleMinutes?: number;
  forceIdle?: boolean; // For testing
}

export function PhotoScreensaver({ photos, idleMinutes = 5, forceIdle = false }: ScreensaverProps) {
  const [isIdle, setIsIdle] = useState(forceIdle);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (forceIdle) return;
    let timer: NodeJS.Timeout;
    
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
    if (!isIdle || photos.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % photos.length);
    }, 10000); // 10 sec slideshow
    return () => clearInterval(interval);
  }, [isIdle, photos.length]);

  if (!isIdle || photos.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black flex items-center justify-center">
      <img 
        src={photos[currentIndex].url} 
        alt="Screensaver" 
        className="w-full h-full object-cover transition-opacity duration-1000"
      />
    </div>
  );
}
