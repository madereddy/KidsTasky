import React from 'react';
import { LogOut, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { THEMES } from '../constants';

export function ThemeSelectorModal({ 
  currentThemeId, 
  onSelect, 
  onClose 
}: { 
  currentThemeId: string, 
  onSelect: (id: string) => void, 
  onClose: () => void 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ui-deep-80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-panel w-full max-w-md rounded-[40px] p-10 shadow-2xl border-blue-500/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none">UI Customization</h3>
            <p className="text-[10px] text-ui-muted uppercase tracking-widest font-bold mt-1">Select your command aesthetic</p>
          </div>
          <button onClick={onClose} className="p-2 text-ui-muted hover:text-white"><LogOut className="w-5 h-5 rotate-180" /></button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {THEMES.map(theme => (
            <motion.button
              key={theme.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(theme.id)}
              className={cn(
                "p-5 rounded-3xl border-2 transition-all flex items-center gap-4 text-left relative overflow-hidden group",
                currentThemeId === theme.id 
                  ? `bg-${theme.primary}/10 border-${theme.primary} shadow-[0_0_20px_rgba(59,130,246,0.2)]` 
                  : "bg-ui-dark-50 border-ui-dark text-ui-muted-2 hover:border-ui-dark-2"
              )}
            >
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 transition-transform group-hover:scale-110",
                `bg-${theme.primary}/20 text-${theme.primary}`
              )}>
                {theme.icon}
              </div>
              <div>
                <p className="font-black text-white uppercase tracking-tight text-lg leading-none mb-1">{theme.name}</p>
                <p className="text-[10px] uppercase font-black tracking-widest opacity-60">Signature: {theme.primary.split('-')[0]}</p>
              </div>
              
              {currentThemeId === theme.id && (
                <div className="absolute top-4 right-4">
                  <CheckCircle2 className={cn("w-6 h-6", `text-${theme.primary}`)} />
                </div>
              )}
              
              <div 
                className="absolute inset-0 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity" 
                style={{ background: theme.bg }} 
              />
            </motion.button>
          ))}
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-8 py-4 bg-ui-dark border border-ui-dark text-ui-muted font-black rounded-2xl uppercase tracking-widest text-xs hover:text-white transition-colors"
        >
          Confirm Selection
        </button>
      </motion.div>
    </motion.div>
  );
}


