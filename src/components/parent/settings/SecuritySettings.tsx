import React from 'react';
import { Lock, Users, Trash2 } from 'lucide-react';
import { authService } from '../../../services/auth';
import { userService } from '../../../services/users';
import { inviteService } from '../../../services/invites';
import { clientLogger } from '../../../services/clientLogger';

interface Props {
  parentId: string;
  hasPIN: boolean;
  pin: string;
  setPin: (pin: string) => void;
  showPinInput: boolean;
  setShowPinInput: (show: boolean) => void;
  onLockNow?: () => void;
  coParents: { uid: string; name: string; email: string }[];
  setCoParents: React.Dispatch<React.SetStateAction<{ uid: string; name: string; email: string }[]>>;
  coParentInvite: { id: string } | null;
  setCoParentInvite: (invite: { id: string } | null) => void;
}

export function SecuritySettings({
  parentId,
  hasPIN,
  pin,
  setPin,
  showPinInput,
  setShowPinInput,
  onLockNow,
  coParents,
  setCoParents,
  coParentInvite,
  setCoParentInvite,
}: Props) {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordChanging, setPasswordChanging] = React.useState(false);
  const [passwordChangeMessage, setPasswordChangeMessage] = React.useState('');
  const [generatingCoInvite, setGeneratingCoInvite] = React.useState(false);
  const [coInviteCopied, setCoInviteCopied] = React.useState(false);

  const handleChangePassword = async () => {
    const trimmedCurrent = currentPassword.trim();
    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedCurrent || !trimmedNew || !trimmedConfirm) {
      setPasswordChangeMessage('Fill out the current password and both new password fields.');
      return;
    }
    if (trimmedNew.length < 8) {
      setPasswordChangeMessage('New password must be at least 8 characters.');
      return;
    }
    if (trimmedNew !== trimmedConfirm) {
      setPasswordChangeMessage('New passwords do not match.');
      return;
    }

    setPasswordChanging(true);
    setPasswordChangeMessage('');
    try {
      const ok = await authService.changePassword(trimmedCurrent, trimmedNew);
      if (!ok) {
        setPasswordChangeMessage('Password change failed. Check your current password and try again.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordChangeMessage('Password updated.');
    } finally {
      setPasswordChanging(false);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Lock size={16} className="text-amber-500" />
          <h3 className="font-bold text-ui-secondary">Family PIN</h3>
        </div>
        {!showPinInput ? (
          <div className="flex items-center gap-3">
            {hasPIN ? (
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-4 h-4 rounded-full bg-amber-400" />
                ))}
              </div>
            ) : (
              <span className="text-sm text-ui-muted-2">No PIN set</span>
            )}
            <button
              onClick={() => setShowPinInput(true)}
              className="px-3 py-1.5 bg-ui-soft border border-ui text-amber-700 rounded-lg text-sm font-medium hover:bg-ui-soft-2 transition-colors"
            >
              {hasPIN ? 'Change PIN' : 'Set PIN'}
            </button>
          </div>
        ) : (
          <div>
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="4-digit PIN"
              className="w-32 border border-ui rounded-lg px-3 py-2 text-sm text-center tracking-widest font-mono bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <p className="text-xs text-ui-muted-2 mt-1">Enter a new 4-digit PIN</p>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Lock size={16} className="text-slate-500" />
          <h3 className="font-bold text-ui-secondary">Parent Password</h3>
        </div>
        <p className="text-xs text-ui-muted mb-3">Change the password used to sign in as a parent.</p>
        <div className="space-y-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            className="w-full border border-ui rounded-lg px-3 py-2 text-sm bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            className="w-full border border-ui rounded-lg px-3 py-2 text-sm bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className="w-full border border-ui rounded-lg px-3 py-2 text-sm bg-white text-ui-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleChangePassword}
            disabled={passwordChanging || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()}
            className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-600 disabled:opacity-60"
          >
            {passwordChanging ? 'Updating...' : 'Update Password'}
          </button>
          {passwordChangeMessage && (
            <p className={`text-xs ${passwordChangeMessage === 'Password updated.' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {passwordChangeMessage}
            </p>
          )}
        </div>
      </section>

      {/* Co-Parents */}
      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Users size={16} /> Co-Parents
        </h3>
        {coParents.length > 0 && (
          <ul className="mb-3 space-y-1">
            {coParents.map((cp) => (
              <li key={cp.uid} className="flex items-center justify-between text-sm bg-ui-soft rounded px-3 py-1.5">
                <span>
                  {cp.name} <span className="text-ui-muted-2">({cp.email})</span>
                </span>
                <button
                  onClick={async () => {
                    if (!confirm(`Remove ${cp.name} as co-parent?`)) return;
                    await userService.removeCoParent(cp.uid);
                    setCoParents((prev) => prev.filter((c) => c.uid !== cp.uid));
                  }}
                  className="text-red-500 hover:text-red-700 ml-2"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {coParentInvite ? (
          <div className="flex items-center gap-2">
            <span className="font-mono bg-ui-soft-2 px-2 py-1 rounded text-sm">{coParentInvite.id}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(coParentInvite.id);
                setCoInviteCopied(true);
                setTimeout(() => setCoInviteCopied(false), 2000);
              }}
              className="text-blue-500 text-xs"
            >
              {coInviteCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ) : (
          <button
            disabled={generatingCoInvite}
            onClick={async () => {
              setGeneratingCoInvite(true);
              try {
                const res = await inviteService.createCoParentInvite(parentId, 'Family');
                setCoParentInvite({ id: res });
              } catch (e) {
                clientLogger.errorWithException('settings_generate_coparent_invite_failed', e, { parentId });
              } finally {
                setGeneratingCoInvite(false);
              }
            }}
            className="text-sm bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {generatingCoInvite ? 'Generating…' : 'Generate Co-Parent Invite'}
          </button>
        )}
      </div>

      <section className="border-t pt-4">
        <h3 className="font-bold text-ui-secondary mb-2">Display Lock</h3>
        <p className="text-xs text-ui-muted mb-3">Lock this display in read-only mode.</p>
        <button
          onClick={() => onLockNow?.()}
          className="px-3 py-2 bg-ui-dark-2 text-white rounded-lg text-sm font-semibold"
        >
          Lock Display Now
        </button>
      </section>
    </div>
  );
}
