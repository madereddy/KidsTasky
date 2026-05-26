import { fetchAPI } from './http';
import { Invite } from '../types';

export const inviteService = {
  async createInvite(parentId: string, parentName: string, type: 'kid' | 'coparent' = 'kid'): Promise<string> {
    const res = await fetchAPI('/invites', {
      method: "POST",
      body: JSON.stringify({ parentId, parentName, type })
    });
    return res.id;
  },

  async createCoParentInvite(parentId: string, parentName: string): Promise<string> {
    return this.createInvite(parentId, parentName, 'coparent');
  },

  async getActiveInvite(parentId: string): Promise<Invite | null> {
    return await fetchAPI('/parents/' + parentId + '/invites/active');
  },

  async getActiveCoParentInvite(parentId: string): Promise<Invite | null> {
    return await fetchAPI(`/parents/${parentId}/invites/coparent/active`);
  },

  async validateInvite(code: string): Promise<Invite | null> {
    return await fetchAPI('/invites/' + code + '/validate');
  }
};
