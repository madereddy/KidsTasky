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
              <div className="bg-gradient-to-br from-sky-400 to-blue-500 w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-lg">
                <ShieldCheck className="text-white w-12 h-12" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-800 mb-2">Family Hub</h1>
              <p className="text-slate-500 mb-8 font-medium">Chore Charts & Rewards</p>
              
              {isRegister && (
                <input 
                  type="text" 
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder="Parent Name" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 text-center font-medium focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                />
              )}
              <input 
                type="email" 
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder="Email Address" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 text-center font-medium focus:ring-2 focus:ring-sky-500 outline-none transition-all"
              />
              {!isRegister && (
                <p className="text-xs text-slate-500 mb-4 font-medium">Enter email for kid's profile, or password for parent login.</p>
              )}
              <input 
                type="password" 
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="Parent Password (Optional for Kids)" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 text-center font-medium focus:ring-2 focus:ring-sky-500 outline-none transition-all"
              />

              <button 
                onClick={handleNext}
                disabled={!email.trim() || (isRegister && (!password.trim() || !name.trim()))}
                className="w-full bg-sky-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-sky-400 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              >
                {isRegister ? 'Register' : (password ? 'Log In' : 'Find My Account')}
              </button>
              
              <button 
                onClick={() => setIsRegister(!isRegister)}
                className="text-slate-500 text-sm hover:text-sky-500 pt-4 font-medium"
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
                <button onClick={() => setView('login')} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 shadow-sm">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-slate-800">Who's logging in?</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {familyProfiles.map(kid => (
                  <button
                    key={kid.uid}
                    onClick={() => handleKidSelect(kid)}
                    className="p-6 bg-white border border-slate-200 rounded-[2rem] hover:border-sky-300 hover:shadow-md transition-all group flex flex-col items-center gap-3 shadow-sm"
                  >
                    <div className="w-16 h-16 bg-sky-50 rounded-full flex items-center justify-center text-3xl font-bold text-sky-500 group-hover:bg-sky-100 transition-all">
                      {kid.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-800">{kid.name}</span>
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
                <button onClick={() => setView('family')} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 shadow-sm">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-left">
                  <h2 className="text-xl font-bold text-slate-800">{selectedKid.name}</h2>
                  <p className="text-xs text-slate-500 font-medium">Enter your 4-digit PIN</p>
                </div>
              </div>

              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map(i => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-14 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-bold transition-all",
                      pin.length > i ? "border-sky-500 text-sky-500 bg-sky-50" : "border-slate-200 text-slate-300 bg-white"
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
                    className="h-16 rounded-full bg-white border border-slate-200 text-xl font-bold hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center text-slate-700 shadow-sm"
                  >
                    {n === '←' ? <ArrowLeft className="w-6 h-6" /> : n}
                  </button>
                ))}
              </div>

              <button
                disabled={pin.length < 4}
                onClick={handlePinSubmit}
                className="w-full bg-sky-500 text-white py-4 rounded-[2rem] font-bold text-lg hover:bg-sky-400 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-md"
              >
                <KeyRound className="w-5 h-5" /> Let's Go!
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
