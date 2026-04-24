import { fetchAPI } from './http';
import { UserProfile } from '../types';

export const userService = {
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      return await fetchAPI('/users/' + uid);
    } catch (e) {
      return null;
    }
  },

  async createUserProfile(profile: UserProfile): Promise<void> {
    await fetchAPI('/users', {
      method: "POST",
      body: JSON.stringify(profile)
    });
  },

  async addBadge(uid: string, badgeId: string): Promise<void> {
    await fetchAPI('/users/' + uid + '/badge', {
      method: "POST",
      body: JSON.stringify({ badgeId })
    });
  },

  async updateUserXP(uid: string, xpChange: number): Promise<void> {
    await fetchAPI('/users/' + uid + '/xp', {
      method: "POST",
      body: JSON.stringify({ xpChange })
    });
  },

  async updateUserTheme(uid: string, themeId: string): Promise<void> {
    await fetchAPI('/users/' + uid + '/theme', {
      method: "POST",
      body: JSON.stringify({ themeId })
    });
  },

  async getKidsForParent(parentId: string): Promise<UserProfile[]> {
    return await fetchAPI('/parents/' + parentId + '/kids');
  }
};
