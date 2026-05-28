import React, { useRef } from 'react';
import { userService } from '../../services/users';

const PRESET_AVATARS = [
  '??', '??', '??', '??', '??', '??',
  '??', '??', '??', '??', '??', '??',
  '??', '??', '??', '??', '??', '??',
  '??', '??', '??', '??', '??', '??',
];

export interface AvatarState {
  avatarPreset?: string;
  avatarUrl?: string;
  name: string;
}

interface PickerProps {
  uid: string;
  current: AvatarState;
  onUpdated: (avatarPreset: string | null, avatarUrl: string | null) => void;
}

export function AvatarDisplay({ avatarPreset, avatarUrl, name, size = 40 }: AvatarState & { size?: number }) {
  const style: React.CSSProperties = { width: size, height: size, borderRadius: '50%' };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ ...style, objectFit: 'cover' }}
      />
    );
  }
  if (avatarPreset) {
    return (
      <div
        className="bg-ui-soft-2 text-ui-primary"
        style={{ ...style, fontSize: size * 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {avatarPreset}
      </div>
    );
  }
  return (
    <div
      className="bg-blue-500 text-white"
      style={{ ...style, fontSize: size * 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function AvatarPicker({ uid, current, onUpdated }: PickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isNew = uid === '__new__';

  async function selectPreset(emoji: string) {
    if (!isNew) {
      await userService.updateAvatar(uid, emoji, null);
    }
    onUpdated(emoji, null);
  }

  async function uploadPhoto(file: File) {
    const formData = new FormData();
    formData.append('photo', file);
    const res = await fetch('/api/photos/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('kidtasker_token')}` },
      body: formData,
    });
    if (!res.ok) {
      console.error('Photo upload failed');
      return;
    }
    const data = await res.json();
    if (data.url) {
      if (!isNew) {
        await userService.updateAvatar(uid, null, data.url);
      }
      onUpdated(null, data.url);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <AvatarDisplay {...current} size={48} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-xs text-blue-500 underline"
        >
          Upload Photo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadPhoto(file);
          }}
        />
      </div>
      <div className="grid grid-cols-6 gap-2">
        {PRESET_AVATARS.map((emoji, idx) => (
          <button
            key={`${emoji}-${idx}`}
            type="button"
            onClick={() => selectPreset(emoji)}
            className={`text-2xl rounded-lg p-1 hover:bg-ui-soft ${
              current.avatarPreset === emoji ? 'ring-2 ring-blue-500 bg-blue-50' : ''
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
