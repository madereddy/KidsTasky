import { useState, useCallback } from 'react';

export type AppSection = 'home' | 'tasks' | 'calendar' | 'shopping' | 'routines' | 'meals' | 'manage';

export function useSectionNavigation() {
  const [activeSection, setActiveSection] = useState<AppSection | string>('home');
  const [, setNavRetryTick] = useState(0);

  const goToSection = useCallback((section: AppSection) => {
    setActiveSection(section);
    // Force re-render for lazy chunks that might have missed the Suspense retry ping
    setTimeout(() => setNavRetryTick(t => t + 1), 50);
  }, []);

  return {
    activeSection,
    setActiveSection,
    goToSection
  };
}
