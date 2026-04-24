import { fetchAPI } from './http';
import { UserProfile } from '../types';

export const authService = {
  async signIn(name: string): Promise<UserProfile | null> {
    const res = await fetchAPI('/auth/login', {
      method: "POST",
      body: JSON.stringify({ name })
    });
    return res.user;
  },

  async getMe(uid: string): Promise<UserProfile | null> {
    try {
      const res = await fetchAPI('/auth/me', {
        headers: { 'Authorization': uid }
      });
      return res.user;
    } catch (e) {
      return null;
    }
  }
};
