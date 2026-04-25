import { fetchAPI, HttpError } from './http';
import { UserProfile } from '../types';

export const authService = {
  async signIn(email: string, passwordString: string): Promise<{user: UserProfile, token: string} | null> {
    const res = await fetchAPI('/auth/login', {
      method: "POST",
      body: JSON.stringify({ email, password: passwordString })
    });
    return res; // returns { user, token }
  },

  async register(email: string, passwordString: string, name: string): Promise<{user: UserProfile, token: string} | null> {
    const res = await fetchAPI('/auth/register', {
      method: "POST",
      body: JSON.stringify({ email, password: passwordString, name })
    });
    return res;
  },

  async getMe(token: string): Promise<UserProfile | null> {
    try {
      const res = await fetchAPI('/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.user;
    } catch (e: any) {
      // Only treat 401 as definite logout
      if (e instanceof HttpError && e.status === 401) {
        return null;
      }
      // Otherwise re-throw so app knows it's a network/server issue
      throw e;
    }
  }
};
