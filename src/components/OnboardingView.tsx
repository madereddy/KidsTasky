import React, { useState } from 'react';
import { ShieldCheck, Baby } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { taskService } from '../services/taskService';
import { cn } from '../lib/utils';

export function OnboardingView({ user, onComplete }: { user: any, onComplete: (p: UserProfile) => void }) {
  const [role, setRole] = useState<'parent' | 'kid' | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [name, setName] = useState(user.name || '');
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
      const invite = await taskService.validateInvite(inviteCode);
      if (!invite) {
        setError('Invalid mission access code. Please check with your commander.');
        setLoading(false);
        return;
      }
      parentId = invite.parentId;
    }

    const profile: UserProfile = {
      uid: user.uid,
      role,
      name,
      email: user.email || '',
      parentId
    };
    
    await taskService.createUserProfile(profile);
    setLoading(false);
    onComplete(profile);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md glass-panel p-10 rounded-[40px]">
        <h2 className="title-immersive text-3xl mb-2">Identify Payload</h2>
        <p className="text-slate-500 mb-8 uppercase text-[10px] font-bold tracking-widest">Scanning user credentials...</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button 
            onClick={() => setRole('parent')}
            className={cn(
              "p-6 rounded-3xl border-2 transition-all text-left flex flex-col gap-4",
              role === 'parent' ? "border-blue-500 bg-blue-500/10 glow-blue" : "border-slate-800 bg-slate-900/50"
            )}
          >
            <div className={cn("p-3 rounded-2xl w-fit", role === 'parent' ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-500")}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black uppercase tracking-tight text-sm">Ground Control</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase">Coordinate Missions</p>
            </div>
          </button>

          <button 
            onClick={() => setRole('kid')}
            className={cn(
              "p-6 rounded-3xl border-2 transition-all text-left flex flex-col gap-4",
              role === 'kid' ? "border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.2)]" : "border-slate-800 bg-slate-900/50"
            )}
          >
            <div className={cn("p-3 rounded-2xl w-fit", role === 'kid' ? "bg-purple-500 text-white" : "bg-slate-800 text-slate-500")}>
              <Baby className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black uppercase tracking-tight text-sm">Space Cadet</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase">Execute Objectives</p>
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
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Personnel Name</label>
                <input 
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  className="input-immersive"
                  placeholder="Enter name..."
                />
              </div>

              {role === 'kid' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Mission Access Code</label>
                  <input 
                    value={inviteCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteCode(e.target.value.toUpperCase())}
                    className="input-immersive font-mono tracking-widest text-xl text-center uppercase"
                    placeholder="X7R9Z2"
                    maxLength={6}
                  />
                  <p className="text-[10px] text-slate-500 mt-2 italic text-center">Your Ground Control officer will provide this code.</p>
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
                  "w-full btn-immersive-primary bg-blue-600 mt-4 glow-blue",
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
