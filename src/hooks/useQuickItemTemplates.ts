import { useCallback, useEffect, useState } from 'react';
import { proofTemplatesClientService, ProofTemplate } from '../services/proofTemplates';

export function useQuickItemTemplates() {
  const [templates, setTemplates] = useState<ProofTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const next = await proofTemplatesClientService.list('list');
      setTemplates(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const saveTemplate = useCallback(async (name: string, text: string, pinned = false) => {
    const saved = await proofTemplatesClientService.upsert('list', { name, questions: [text], pinned });
    setTemplates((prev) => {
      const withoutOld = prev.filter((template) => template.id !== saved.id && template.name !== saved.name);
      return [saved, ...withoutOld];
    });
    return saved;
  }, []);

  const removeTemplate = useCallback(async (id: string) => {
    await proofTemplatesClientService.remove('list', id);
    setTemplates((prev) => prev.filter((template) => template.id !== id));
  }, []);

  const pinTemplate = useCallback(async (id: string, pinned: boolean) => {
    await proofTemplatesClientService.setPinned('list', id, pinned);
    setTemplates((prev) => prev.map((template) => (
      template.id === id ? { ...template, pinned } : template
    )));
  }, []);

  return {
    templates,
    loading,
    loadTemplates,
    saveTemplate,
    removeTemplate,
    pinTemplate,
  };
}
