import { useCallback, useState } from 'react';
import { authService } from '../services/auth';
import { settingsClientService } from '../services/settings';
import { UserProfile } from '../types';

interface AppUser {
  uid: string;
  email?: string;
  name: string;
}

interface ParentSession {
  token: string;
  user: AppUser;
  profile: UserProfile;
}

interface UseProfileSwitchControllerOptions {
  profile: UserProfile | null;
  user: AppUser | null;
  parentSession: ParentSession | null;
  persistParentSession: (session: ParentSession | null) => void;
  loadProfileData: (profile: UserProfile, options?: { fastKidSwitch?: boolean }) => Promise<any>;
  warmProfile: (profile: UserProfile) => void;
  setUser: (user: AppUser) => void;
  setProfile: (profile: UserProfile) => void;
  setIsLocked: (locked: boolean) => void;
}

export function useProfileSwitchController({
  profile,
  user,
  parentSession,
  persistParentSession,
  loadProfileData,
  warmProfile,
  setUser,
  setProfile,
  setIsLocked,
}: UseProfileSwitchControllerOptions) {
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [pendingKidSwitch, setPendingKidSwitch] = useState<UserProfile | null>(null);
  const [kidSwitchPin, setKidSwitchPin] = useState('');
  const [showParentSwitchPin, setShowParentSwitchPin] = useState(false);
  const [parentSwitchPin, setParentSwitchPin] = useState('');
  const [switchError, setSwitchError] = useState('');
  const [switchingProfileLabel, setSwitchingProfileLabel] = useState('');

  const switchToKidProfile = useCallback(async (kid: UserProfile, pin: string) => {
    if (!profile || !user) return;
    const parentToken = localStorage.getItem('kidtasker_token') || '';
    if ((profile.role === 'parent' || profile.role === 'coparent') && parentToken) {
      persistParentSession({ token: parentToken, user, profile });
    }
    setSwitchingProfileLabel(`Switching to ${kid.name}...`);
    const res = await authService.signInKid(kid.uid, pin);
    if (!res) throw new Error('Invalid Access Key');
    const { user: next, token } = res;
    localStorage.setItem('kidtasker_token', token);
    setUser({ uid: next.uid, name: next.name, email: next.email });
    setProfile(next);
    setShowProfileSwitcher(false);
    setPendingKidSwitch(null);
    setKidSwitchPin('');
    setSwitchError('');
    void loadProfileData(next, { fastKidSwitch: true });
    warmProfile(next);
    setSwitchingProfileLabel('');
  }, [loadProfileData, persistParentSession, profile, setProfile, setUser, user, warmProfile]);

  const switchToParentProfile = useCallback(async (pin: string) => {
    if (!parentSession) throw new Error('No parent session available');
    const parentId = parentSession.profile.parentId || parentSession.profile.uid;
    if (!parentId) throw new Error('Invalid parent session');
    setSwitchingProfileLabel('Switching to parent...');
    await settingsClientService.unlockDisplay(parentId, pin);
    localStorage.setItem('kidtasker_token', parentSession.token);
    const refreshed = await authService.getMe(parentSession.token);
    const next = refreshed && (refreshed.role === 'parent' || refreshed.role === 'coparent') ? refreshed : parentSession.profile;
    setUser({ uid: next.uid, name: next.name, email: next.email });
    setProfile(next);
    setShowParentSwitchPin(false);
    setParentSwitchPin('');
    setSwitchError('');
    setShowProfileSwitcher(false);
    setIsLocked(false);
    await loadProfileData(next);
    warmProfile(next);
    setSwitchingProfileLabel('');
  }, [loadProfileData, parentSession, setIsLocked, setProfile, setUser, warmProfile]);

  return {
    showProfileSwitcher,
    setShowProfileSwitcher,
    pendingKidSwitch,
    setPendingKidSwitch,
    kidSwitchPin,
    setKidSwitchPin,
    showParentSwitchPin,
    setShowParentSwitchPin,
    parentSwitchPin,
    setParentSwitchPin,
    switchError,
    setSwitchError,
    switchingProfileLabel,
    setSwitchingProfileLabel,
    switchToKidProfile,
    switchToParentProfile,
  };
}
