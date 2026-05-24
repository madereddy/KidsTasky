import { fetchAPI } from './http';
import { AllowanceEntry } from '../types';

export const allowanceClientService = {
  getPendingAllowances: (parentId: string): Promise<AllowanceEntry[]> =>
    fetchAPI(`/parents/${parentId}/allowances`),
  markPaid: (id: string): Promise<void> =>
    fetchAPI(`/allowances/${id}/pay`, { method: 'PUT' }),
};
