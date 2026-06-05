import { useCallback, useEffect, useState } from 'react';
import { proofTemplatesClientService, ProofTemplate, ProofTemplateKind } from '../services/proofTemplates';

export function useQuickItemTemplates(kind: ProofTemplateKind) {
  const [templates, setTemplates] = useState<ProofTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const next = await proofTemplatesClientService.list(kind);
      setTemplates(next);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const saveTemplate = useCallback(async (name: string, text: string, pinned = false) => {
    const saved = await proofTemplatesClientService.upsert(kind, { name, questions: [text], pinned });
    setTemplates((prev) => {
      const withoutOld = prev.filter((template) => template.id !== saved.id && template.name !== saved.name);
      return [saved, ...withoutOld];
    });
    return saved;
  }, [kind]);

  const removeTemplate = useCallback(async (id: string) => {
    await proofTemplatesClientService.remove(kind, id);
    setTemplates((prev) => prev.filter((template) => template.id !== id));
  }, [kind]);

  const pinTemplate = useCallback(async (id: string, pinned: boolean) => {
    await proofTemplatesClientService.setPinned(kind, id, pinned);
    setTemplates((prev) => prev.map((template) => (
      template.id === id ? { ...template, pinned } : template
    )));
  }, [kind]);

  return {
    templates,
    loading,
    loadTemplates,
    saveTemplate,
    removeTemplate,
    pinTemplate,
  };
}
