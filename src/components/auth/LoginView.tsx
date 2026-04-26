import React, { useState } from 'react';
import { ShieldCheck, ArrowLeft, KeyRound, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authService } from '../../services/auth';
import { cn } from '../../lib/utils';

export function LoginView({ onLogin, onKidLogin }: { 
  onLogin: (email: string, passwordString: string, isRegister: boolean, name?: string) => void,
  onKidLogin: (uid: string, pin: string) => void
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [view, setView] = useState<'login' | 'family' | 'pin'>('login');
  const [familyProfiles, setFamilyProfiles] = useState<any[]>([]);
  const [selectedKid, setSelectedKid] = useState<any>(null);
  const [pin, setPin] = useState('');

  const handleNext = async () => {
    if (isRegister) {
      onLogin(email.trim(), password.trim(), true, name.trim());
      return;
    }

    // Check if user wants to see family profiles
    if (email.trim() && !password.trim()) {
      const kids = await authService.getProfilesByEmail(email.trim());
      if (kids.length > 0) {
        setFamilyProfiles(kids);
        setView('family');
        return;
      }
    }
    
    if (email.trim() && password.trim()) {
      onLogin(email.trim(), password.trim(), false);
    }
  };

  const handleKidSelect = (kid: any) => {
    setSelectedKid(kid);
    setView('pin');
  };

  const handlePinSubmit = () => {
    if (pin.length === 4) {
      onKidLogin(selectedKid.uid, pin);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <AnimatePresence mode="wait">
          {view === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-xl glow-blue">
                <ShieldCheck className="text-white w-12 h-12" />
              </div>
              <h1 className="title-immersive text-5xl mb-4">KidTasker</h1>
              <p className="text-slate-400 mb-8 italic uppercase tracking-widest text-xs font-bold">Stellar Mission Command</p>
              
              {isRegister && (
                <input 
                  type="text" 
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder="Commander Name" 
                  className="input-immersive text-center"
                />
              )}
              <input 
                type="email" 
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder="Frequency (Email)" 
                className="input-immersive text-center"
              />
              {!isRegister && (
                <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-4">Enter email for profile access or password for full command</p>
              )}
              <input 
                type="password" 
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="Access Code (Optional for Kids)" 
                className="input-immersive text-center"
              />

              <button 
                onClick={handleNext}
                disabled={!email.trim() || (isRegister && (!password.trim() || !name.trim()))}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-lg glow-blue active:scale-[0.98] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRegister ? 'Register' : (password ? 'Enter Star System' : 'Find Fleet')}
              </button>
              
              <button 
                onClick={() => setIsRegister(!isRegister)}
                className="text-slate-400 text-sm hover:text-white pt-4"
              >
                {isRegister ? 'Already have access?' : 'Need to register?'}
              </button>
            </motion.div>
          )}

          {view === 'family' && (
            <motion.div
              key="family"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setView('login')} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold uppercase tracking-widest text-blue-400">Select Pilot</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {familyProfiles.map(kid => (
                  <button
                    key={kid.uid}
                    onClick={() => handleKidSelect(kid)}
                    className="p-6 bg-slate-900 border border-slate-800 rounded-3xl hover:border-blue-500/50 transition-all group flex flex-col items-center gap-3"
                  >
                    <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-2xl font-black text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-all">
                      {kid.name[0].toUpperCase()}
                    </div>
                    <span className="font-bold text-sm">{kid.name}</span>
                    <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold">Lvl {kid.level}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {view === 'pin' && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="flex items-center gap-4">
                <button onClick={() => setView('family')} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-left">
                  <h2 className="text-xl font-bold uppercase tracking-widest text-blue-400">{selectedKid.name}</h2>
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em]">Enter 4-Digit Identity Key</p>
                </div>
              </div>

              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map(i => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-12 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all",
                      pin.length > i ? "border-blue-500 text-blue-400 glow-blue bg-blue-500/5" : "border-slate-800 text-slate-700 bg-slate-900/50"
                    )}
                  >
                    {pin[i] ? '•' : ''}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map((n, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (n === 'C') setPin('');
                      else if (n === '←') setPin(pin.slice(0, -1));
                      else if (pin.length < 4) setPin(pin + n);
                    }}
                    className="h-16 rounded-2xl bg-slate-900 border border-slate-800 text-xl font-black hover:bg-slate-800 hover:border-slate-700 active:scale-95 transition-all flex items-center justify-center text-slate-300"
                  >
                    {n === '←' ? <ArrowLeft className="w-6 h-6" /> : n}
                  </button>
                ))}
              </div>

              <button
                disabled={pin.length < 4}
                onClick={handlePinSubmit}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
              >
                <KeyRound className="w-5 h-5" /> Verify Link
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
