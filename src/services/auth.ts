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

  async signInKid(uid: string, pin: string): Promise<{user: UserProfile, token: string} | null> {
    return fetchAPI('/auth/login/kid', {
      method: 'POST',
      body: JSON.stringify({ uid, pin })
    });
  },

  async getProfilesByEmail(email: string): Promise<any[]> {
    try {
      const data = await fetchAPI(`/auth/profiles/${encodeURIComponent(email)}`);
      return data.kids || [];
    } catch {
      return [];
    }
  },

  async setPin(pin: string): Promise<boolean> {
    const token = localStorage.getItem('kidtasker_token');
    try {
      await fetchAPI('/auth/set-pin', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pin })
      });
      return true;
    } catch {
      return false;
    }
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
