import { useState, useCallback, startTransition } from 'react';

export type AppSection = 'home' | 'tasks' | 'calendar' | 'shopping' | 'routines' | 'meals' | 'manage';

const VALID_SECTIONS: AppSection[] = ['home', 'tasks', 'calendar', 'shopping', 'routines', 'meals', 'manage'];

function getSectionFromPath(): AppSection {
  const segment = window.location.pathname.replace(/^\//, '').split('/')[0];
  return (VALID_SECTIONS.includes(segment as AppSection) ? segment : 'home') as AppSection;
}

export function useSectionNavigation() {
  const [activeSection, setActiveSection] = useState<AppSection | string>(() => getSectionFromPath());
  const [mountedSections, setMountedSections] = useState<Set<string>>(() => {
    const initial = getSectionFromPath();
    return new Set([initial]);
  });

  const goToSection = useCallback((section: AppSection) => {
    startTransition(() => {
      setMountedSections(prev => prev.has(section) ? prev : new Set([...prev, section]));
      setActiveSection(section);
    });
    const newPath = section === 'home' ? '/' : `/${section}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
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
