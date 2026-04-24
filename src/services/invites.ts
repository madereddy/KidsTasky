import { fetchAPI } from './http';
import { Invite } from '../types';

export const inviteService = {
  async createInvite(parentId: string, parentName: string): Promise<string> {
    const res = await fetchAPI('/invites', {
      method: "POST",
      body: JSON.stringify({ parentId, parentName })
    });
    return res.id;
  },

  async getActiveInvite(parentId: string): Promise<Invite | null> {
    return await fetchAPI('/parents/' + parentId + '/invites/active');
  },

  async validateInvite(code: string): Promise<Invite | null> {
    return await fetchAPI('/invites/' + code + '/validate');
  }
};
