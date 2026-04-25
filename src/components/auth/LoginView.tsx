import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export function LoginView({ onLogin }: { onLogin: (email: string, passwordString: string, isRegister: boolean, name?: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
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
            className="input-immersive mb-4 text-center"
          />
        )}
        <input 
          type="email" 
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          placeholder="Contact Frequency (Email)" 
          className="input-immersive mb-4 text-center"
        />
        <input 
          type="password" 
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          placeholder="Access Code (Password)" 
          className="input-immersive mb-4 text-center"
        />

        <button 
          onClick={() => { if (email.trim() && password.trim()) onLogin(email.trim(), password.trim(), isRegister, name.trim()) }}
          disabled={!email.trim() || !password.trim() || (isRegister && !name.trim())}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-lg glow-blue active:scale-[0.98] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {isRegister ? 'Register' : 'Enter Star System'}
        </button>
        
        <button 
          onClick={() => setIsRegister(!isRegister)}
          className="text-slate-400 text-sm hover:text-white"
        >
          {isRegister ? 'Already have access?' : 'Need to register?'}
        </button>
      </motion.div>
    </div>
  );
}
