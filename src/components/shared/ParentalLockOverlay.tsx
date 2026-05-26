import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { PinPad } from '../parent/PinPad';
import { settingsClientService } from '../../services/settings';

interface Props {
  parentId: string;
  onUnlock: () => void;
}

export function ParentalLockOverlay({ parentId, onUnlock }: Props) {
  const [error, setError] = useState('');

  const onComplete = async (pin: string) => {
    try {
      await settingsClientService.unlockDisplay(parentId, pin);
      setError('');
      onUnlock();
    } catch {
      setError('Incorrect PIN');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-ui-dark-95 flex flex-col items-center justify-center gap-5">
      <div className="text-center text-white">
        <Lock className="w-10 h-10 mx-auto mb-2 text-ui-muted-2" />
        <h2 className="text-2xl font-bold">Display Locked</h2>
        <p className="text-sm text-ui-muted-2">Enter family PIN to unlock</p>
      </div>
      <PinPad onComplete={onComplete} />
      {error && <p className="text-rose-400 text-sm">{error}</p>}
    </div>
  );
}


