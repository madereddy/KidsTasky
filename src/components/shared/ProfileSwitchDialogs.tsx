import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { UserProfile } from '../../types';

type KidSwitchDialogProps = {
  pendingKidSwitch: UserProfile;
  kidSwitchPin: string;
  switchError: string;
  isDarkTheme: boolean;
  onPinChange: (pin: string) => void;
  onCancel: () => void;
  onSwitch: () => Promise<void>;
};

type ParentSwitchDialogProps = {
  parentName: string;
  parentSwitchPin: string;
  switchError: string;
  isDarkTheme: boolean;
  onPinChange: (pin: string) => void;
  onCancel: () => void;
  onSwitch: () => Promise<void>;
};

export function KidSwitchDialog({
  pendingKidSwitch,
  kidSwitchPin,
  switchError,
  isDarkTheme,
  onPinChange,
  onCancel,
  onSwitch,
}: KidSwitchDialogProps) {
  return (
    <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4">
      <div className={cn("w-full max-w-sm rounded-2xl p-5 border", isDarkTheme ? "bg-ui-deep border-ui-dark text-white" : "bg-white border-ui")}>
        <h3 className="text-lg font-bold">Switch to {pendingKidSwitch.name}</h3>
        <input
          type="password"
          value={kidSwitchPin}
          onChange={(e) => onPinChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4-digit PIN"
          className="w-full px-3 py-2 rounded-xl border border-ui mt-3"
        />
        {switchError ? <p className="text-sm text-rose-500 mt-2">{switchError}</p> : null}
        <div className="flex gap-2 mt-4">
          <button className="flex-1 px-3 py-2 rounded-xl border" onClick={onCancel}>Cancel</button>
          <button className="flex-1 px-3 py-2 rounded-xl bg-sky-500 text-white" onClick={() => void onSwitch()}>Switch</button>
        </div>
      </div>
    </div>
  );
}

export function ParentSwitchDialog({
  parentName,
  parentSwitchPin,
  switchError,
  isDarkTheme,
  onPinChange,
  onCancel,
  onSwitch,
}: ParentSwitchDialogProps) {
  return (
    <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4">
      <div className={cn("w-full max-w-sm rounded-2xl p-5 border", isDarkTheme ? "bg-ui-deep border-ui-dark text-white" : "bg-white border-ui")}>
        <h3 className="text-lg font-bold">Parent Unlock Required</h3>
        <input
          type="password"
          value={parentSwitchPin}
          onChange={(e) => onPinChange(e.target.value)}
          placeholder="PIN or password"
          className="w-full px-3 py-2 rounded-xl border border-ui mt-3"
          aria-label={`PIN or password for ${parentName}`}
        />
        {switchError ? <p className="text-sm text-rose-500 mt-2">{switchError}</p> : null}
        <div className="flex gap-2 mt-4">
          <button className="flex-1 px-3 py-2 rounded-xl border" onClick={onCancel}>Cancel</button>
          <button className="flex-1 px-3 py-2 rounded-xl bg-sky-500 text-white" onClick={() => void onSwitch()}>Switch</button>
        </div>
      </div>
    </div>
  );
}

type ProfileSwitcherSheetProps = {
  profile: UserProfile;
  kids: UserProfile[];
  parentSession: { profile: UserProfile } | null;
  isDarkTheme: boolean;
  onKidSelect: (kid: UserProfile) => void;
  onParentSelect: () => void;
  onClose: () => void;
};

export function ProfileSwitcherSheet({
  profile,
  kids,
  parentSession,
  isDarkTheme,
  onKidSelect,
  onParentSelect,
  onClose,
}: ProfileSwitcherSheetProps) {
  const switchableKids = kids.filter(k => k.uid !== profile.uid);
  const canSwitchToParent = parentSession && profile.role === 'kid';

  if (switchableKids.length === 0 && !canSwitchToParent) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="fixed inset-x-0 bottom-[4.25rem] p-4 z-[111]"
        onClick={e => e.stopPropagation()}
      >
        <div className={cn("mx-auto w-full max-w-sm rounded-[2rem] border p-5 shadow-2xl", isDarkTheme ? "bg-ui-deep border-ui-dark" : "bg-white border-ui")}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn("text-lg font-bold", isDarkTheme ? "text-white" : "text-ui-primary")}>Switch Profile</h3>
            <button
              onClick={onClose}
              className={cn("rounded-full p-1.5 transition-colors", isDarkTheme ? "text-ui-secondary hover:bg-ui-dark-2 hover:text-white" : "text-ui-muted hover:bg-ui-soft")}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-1">
            {switchableKids.map(k => (
              <button
                key={k.uid}
                onClick={() => onKidSelect(k)}
                className={cn("w-full text-left px-4 py-3 rounded-2xl text-sm font-semibold transition-colors flex items-center justify-between", isDarkTheme ? "hover:bg-ui-dark-2 text-white" : "hover:bg-ui-soft text-ui-primary")}
              >
                {k.name}
                <span className={cn("text-xs font-normal", isDarkTheme ? "text-ui-secondary" : "text-ui-muted")}>Kid</span>
              </button>
            ))}
            {canSwitchToParent ? (
              <button
                onClick={onParentSelect}
                className={cn("w-full text-left px-4 py-3 rounded-2xl text-sm font-semibold transition-colors flex items-center justify-between", isDarkTheme ? "hover:bg-ui-dark-2 text-white" : "hover:bg-ui-soft text-ui-primary")}
              >
                {parentSession.profile.name}
                <span className={cn("text-xs font-normal", isDarkTheme ? "text-ui-secondary" : "text-ui-muted")}>Parent</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
