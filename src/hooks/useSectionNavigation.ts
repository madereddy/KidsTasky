import { useState, useCallback } from 'react';

export type AppSection = 'home' | 'tasks' | 'calendar' | 'shopping' | 'routines' | 'meals' | 'manage';

export function useSectionNavigation() {
  const [activeSection, setActiveSection] = useState<AppSection | string>('home');

  const goToSection = useCallback((section: AppSection) => {
    setActiveSection(section);
  }, []);

  return {
    activeSection,
    setActiveSection,
    goToSection
  };
}
