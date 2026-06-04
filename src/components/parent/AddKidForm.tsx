import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { userService } from '../../services/users';
import { AvatarPicker } from '../shared/AvatarPicker';
import { clientLogger } from '../../services/clientLogger';

export function AddKidForm({ parentId, onAdded }: { parentId: string, onAdded: () => void }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [kidAvatar, setKidAvatar] = useState<{ preset: string | null; url: string | null }>({ preset: null, url: null });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || pin.length !== 4) return;

    setLoading(true);
    try {
      const uid = 'kid_' + self.crypto.randomUUID();
      await userService.createManagedUser({
        uid,
        name: name.trim(),
        parentId,
        role: 'kid',
        isManaged: true,
        pin
      });
      if (kidAvatar.preset || kidAvatar.url) {
        await userService.updateAvatar(uid, kidAvatar.preset, kidAvatar.url).catch((error) => {
          clientLogger.warn('add_kid_avatar_update_failed', { parentId, uid, error });
        });
      }
      setName('');
      setPin('');
      setKidAvatar({ preset: null, url: null });
      onAdded();
    } catch (err) {
      clientLogger.errorWithException('add_kid_failed', err, { parentId, name });
      alert('Failed to add cadet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New Cadet Name"
          className="w-full bg-white shadow-sm border border-ui rounded-xl px-3 py-2 text-xs text-ui-primary focus:border-purple-500 transition-colors"
          required
        />
        <input
          type="text"
          maxLength={4}
          pattern="\d{4}"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="4-Digit Identity Key (PIN)"
          className="w-full bg-ui-dark border border-ui-dark rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 transition-colors"
          required
        />
        <div className="mt-2">
          <label className="text-xs text-ui-muted">Avatar (optional)</label>
          <AvatarPicker
            uid="__new__"
            current={{ avatarPreset: kidAvatar.preset ?? undefined, avatarUrl: kidAvatar.url ?? undefined, name: name || '?' }}
            onUpdated={(preset, url) => setKidAvatar({ preset, url })}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading || !name.trim() || pin.length !== 4}
        className="w-full bg-purple-600/20 border border-purple-500/50 text-purple-400 hover:bg-purple-600/40 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
      >
        <UserPlus className="w-4 h-4" />
        {loading ? 'Adding...' : 'Commission Cadet'}
      </button>
    </form>
  );
}

