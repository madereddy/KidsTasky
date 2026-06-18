import { useState, useCallback, startTransition } from 'react';

export type AppSection = 'home' | 'tasks' | 'calendar' | 'shopping' | 'routines' | 'meals' | 'manage';

export function useSectionNavigation() {
  const [activeSection, setActiveSection] = useState<AppSection | string>('home');
  const [mountedSections, setMountedSections] = useState<Set<string>>(() => new Set(['home']));

  const goToSection = useCallback((section: AppSection) => {
    startTransition(() => {
      setMountedSections(prev => prev.has(section) ? prev : new Set([...prev, section]));
      setActiveSection(section);
    });
  }, []);

  const premountSection = useCallback((section: AppSection) => {
    setMountedSections(prev => prev.has(section) ? prev : new Set([...prev, section]));
  }, []);

  return {
    activeSection,
    setActiveSection,
    mountedSections,
    goToSection,
    premountSection
  };
}
