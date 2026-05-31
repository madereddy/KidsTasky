import React, { useState, useEffect, useRef } from 'react';

type SlideKey = 'chores' | 'calendar' | 'weather' | 'photos';

interface DisplayCarouselProps {
  slides: SlideKey[];
  intervalSec: number;
  children: Partial<Record<SlideKey, React.ReactNode>>;
}

export function DisplayCarousel({ slides, intervalSec, children }: DisplayCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => {
      setCurrentIndex(i => (i + 1) % slides.length);
    }, intervalSec * 1000);
    return () => clearInterval(id);
  }, [slides.length, intervalSec]);

  const advance = () => setCurrentIndex(i => (i + 1) % slides.length);
  const retreat = () => setCurrentIndex(i => (i - 1 + slides.length) % slides.length);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) delta < 0 ? advance() : retreat();
    touchStartX.current = null;
  };

  const currentSlide = slides[currentIndex];

  return (
    <div
      className="relative w-full"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div key={currentSlide} className="animate-fade-in">
        {children[currentSlide]}
      </div>
      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? 'bg-sky-500' : 'bg-ui-muted/40'}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
