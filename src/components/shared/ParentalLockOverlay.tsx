import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { PinPad } from '../parent/PinPad';
import { settingsClientService } from '../../services/settings';

interface Props {
  parentId: string;
  onUnlock: () => void;
  onCancel?: () => void;
}

export function ParentalLockOverlay({ parentId, onUnlock, onCancel }: Props) {
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const onComplete = async (pin: string) => {
    try {
      await settingsClientService.unlockDisplay(parentId, pin);
      setError('');
      onUnlock();
    } catch {
      setError('Incorrect PIN or password');
    }
  };

  const submitPassword = async () => {
    if (!password.trim()) return;
    setSubmittingPassword(true);
    try {
      await settingsClientService.unlockDisplay(parentId, password);
      setError('');
      setPassword('');
      onUnlock();
    } catch {
      setError('Incorrect PIN or password');
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-ui-dark-95 flex flex-col items-center justify-center gap-5">
      <div className="text-center text-white">
        <Lock className="w-10 h-10 mx-auto mb-2 text-ui-muted-2" />
        <h2 className="text-2xl font-bold">Display Locked</h2>
        <p className="text-sm text-ui-muted-2">Enter family PIN or parent password to unlock</p>
      </div>
      <PinPad onComplete={onComplete} />
      <div className="w-full max-w-xs space-y-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key !== 'Enter' || !password.trim()) return;
            e.preventDefault();
            await submitPassword();
          }}
          placeholder="Parent password"
          autoComplete="current-password"
          className="w-full rounded-xl border border-ui-dark bg-ui-dark px-4 py-3 text-white placeholder:text-ui-muted-2"
        />
        <button
          onClick={() => { void submitPassword(); }}
          disabled={!password.trim() || submittingPassword}
          className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submittingPassword ? 'Unlocking...' : 'Unlock with Password'}
        </button>
      </div>
      {error && <p className="text-rose-400 text-sm">{error}</p>}
      {onCancel && (
        <button
          onClick={onCancel}
          className="text-sm text-ui-muted-2 hover:text-white underline underline-offset-2"
        >
          Continue in read-only mode
        </button>
      )}
    </div>
  );
}


