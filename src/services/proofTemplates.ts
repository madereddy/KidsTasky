import { fetchAPI } from './http';

export type ProofTemplateKind = 'task' | 'homework' | 'list' | 'shopping' | 'routine';
export type ProofTemplate = {
  id: string;
  parentId: string;
  kind: ProofTemplateKind;
  name: string;
  questions: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

export const proofTemplatesClientService = {
  list(kind: ProofTemplateKind): Promise<ProofTemplate[]> {
    return fetchAPI(`/proof-templates/${kind}`);
  },
  upsert(kind: ProofTemplateKind, payload: { name: string; questions: string[]; pinned?: boolean }): Promise<ProofTemplate> {
    return fetchAPI(`/proof-templates/${kind}`, { method: 'POST', body: JSON.stringify(payload) });
  },
  remove(kind: ProofTemplateKind, id: string): Promise<{ success: boolean }> {
    return fetchAPI(`/proof-templates/${kind}/${id}`, { method: 'DELETE' });
  },
  setPinned(kind: ProofTemplateKind, id: string, pinned: boolean): Promise<{ success: boolean }> {
    return fetchAPI(`/proof-templates/${kind}/${id}/pin`, { method: 'PATCH', body: JSON.stringify({ pinned }) });
  },
  import(kind: ProofTemplateKind, templates: Array<{ name: string; questions: string[]; pinned?: boolean }>): Promise<{ success: boolean; imported: number }> {
    return fetchAPI(`/proof-templates/${kind}/import`, { method: 'POST', body: JSON.stringify({ templates }) });
  },
};
