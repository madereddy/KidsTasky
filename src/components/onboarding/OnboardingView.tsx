import { userService } from '../../services/users';
import { inviteService } from '../../services/invites';
import { fetchAPI } from '../../services/http';
import React, { useState } from 'react';
import { ShieldCheck, Baby, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../../types';
import { cn } from '../../lib/utils';

export function OnboardingView({ user, onComplete }: { user: any, onComplete: (p: UserProfile, creds?: { email: string, pass: string }) => void }) {
  const [role, setRole] = useState<'parent' | 'kid' | 'coparent' | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!role || !name) return;
    setError(null);
    setLoading(true);
    
    let parentId: string | undefined;
    
    if (role === 'kid') {
      if (!inviteCode) {
        setError('Mission access code required.');
        setLoading(false);
        return;
      }
      const invite = await inviteService.validateInvite(inviteCode);
      if (!invite) {
        setError('Invalid mission access code. Please check with your commander.');
        setLoading(false);
        return;
      }
      parentId = invite.parentId;
    }

    if (role === 'coparent') {
      if (!inviteCode) {
        setError('Co-Parent Invite Code required.');
        setLoading(false);
        return;
      }
      const invite = await inviteService.validateInvite(inviteCode);
      if (!invite || invite.type !== 'coparent') {
        setError('Invalid Co-Parent Invite Code.');
        setLoading(false);
        return;
      }
      
      try {
        const profile = await fetchAPI('/users', { 
          method: 'POST', 
          body: JSON.stringify({ 
            uid: user.uid, 
            name, 
            email, 
            password, 
            code: inviteCode 
          }) 
        });
        setLoading(false);
        onComplete(profile, { email, pass: password });
        return;
      } catch (e: any) {
        setError(e.message || 'Failed to join as co-parent.');
        setLoading(false);
        return;
      }
    }

    const profile: UserProfile = {
      uid: user.uid,
      role,
      name,
      email: user.email || '',
      parentId
    };
    
    try {
      await userService.createUserProfile(profile);
      setLoading(false);
      onComplete(profile);
    } catch (e: any) {
      setError(e.message || 'Failed to create profile.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md glass-panel p-10 rounded-[40px]">
        <h2 className="title-immersive text-3xl mb-2">Identify Payload</h2>
        <p className="text-ui-muted mb-8 uppercase text-[10px] font-bold tracking-widest">Scanning user credentials...</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button 
            onClick={() => setRole('parent')}
            className={cn(
              "p-4 rounded-3xl border-2 transition-all text-left flex flex-col gap-3",
              role === 'parent' ? "border-blue-500 bg-blue-500/10 glow-blue" : "border-ui-dark bg-ui-dark-50"
            )}
          >
            <div className={cn("p-2 rounded-xl w-fit", role === 'parent' ? "bg-blue-500 text-white" : "bg-ui-dark-2 text-ui-muted")}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-black uppercase tracking-tight text-[10px]">Ground Control</p>
              <p className="text-[8px] text-ui-muted mt-0.5 uppercase">Coordinate</p>
            </div>
          </button>

          <button 
            onClick={() => setRole('kid')}
            className={cn(
              "p-4 rounded-3xl border-2 transition-all text-left flex flex-col gap-3",
              role === 'kid' ? "border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.2)]" : "border-ui-dark bg-ui-dark-50"
            )}
          >
            <div className={cn("p-2 rounded-xl w-fit", role === 'kid' ? "bg-purple-500 text-white" : "bg-ui-dark-2 text-ui-muted")}>
              <Baby className="w-5 h-5" />
            </div>
            <div>
              <p className="font-black uppercase tracking-tight text-[10px]">Space Cadet</p>
              <p className="text-[8px] text-ui-muted mt-0.5 uppercase">Execute</p>
            </div>
          </button>

          <button 
            onClick={() => setRole('coparent')}
            className={cn(
              "p-4 rounded-3xl border-2 transition-all text-left flex flex-col gap-3",
              role === 'coparent' ? "border-emerald-500 bg-emerald-500/10 glow-emerald" : "border-ui-dark bg-ui-dark-50"
            )}
          >
            <div className={cn("p-2 rounded-xl w-fit", role === 'coparent' ? "bg-emerald-500 text-white" : "bg-ui-dark-2 text-ui-muted")}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="font-black uppercase tracking-tight text-[10px]">Co-Parent</p>
              <p className="text-[8px] text-ui-muted mt-0.5 uppercase">Collaborate</p>
            </div>
          </button>
        </div>

        <AnimatePresence>
          {role && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="space-y-6 overflow-hidden"
            >
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-ui-muted mb-2 block">Personnel Name</label>
                <input 
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  className="input-immersive"
                  placeholder="Enter name..."
                />
              </div>

              {role === 'coparent' && (
                <>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-ui-muted mb-2 block">Email Address</label>
                    <input 
                      type="email"
                      value={email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                      className="input-immersive"
                      placeholder="Enter email..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-ui-muted mb-2 block">Password</label>
                    <input 
                      type="password"
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      className="input-immersive"
                      placeholder="Enter password..."
                    />
                  </div>
                </>
              )}

              {(role === 'kid' || role === 'coparent') && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-ui-muted mb-2 block">
                    {role === 'coparent' ? 'Co-Parent Invite Code' : 'Mission Access Code'}
                  </label>
                  <input 
                    value={inviteCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteCode(e.target.value.toUpperCase())}
                    className="input-immersive font-mono tracking-widest text-xl text-center uppercase"
                    placeholder="X7R9Z2"
                    maxLength={6}
                  />
                  <p className="text-[10px] text-ui-muted mt-2 italic text-center">
                    {role === 'coparent' 
                      ? 'Enter the 6-digit code shared by the primary parent.' 
                      : 'Your Ground Control officer will provide this code.'}
                  </p>
                </div>
              )}

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs text-center font-bold">
                  {error}
                </div>
              )}

              <button 
                onClick={handleSubmit}
                disabled={loading}
                className={cn(
                  "w-full btn-immersive-primary mt-4",
                  role === 'parent' && "bg-blue-600 glow-blue",
                  role === 'kid' && "bg-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.3)]",
                  role === 'coparent' && "bg-emerald-600 glow-emerald",
                  loading && "opacity-50 cursor-not-allowed"
                )}
              >
                {loading ? "Initializing..." : "Board Station"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


