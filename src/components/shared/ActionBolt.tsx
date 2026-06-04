// src/components/shared/ActionBolt.tsx
import React, { useState } from 'react';
import { Zap, ShoppingBasket, ClipboardCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../../types';

export function ActionBolt({ onAction, profile }: { onAction: (type: string) => void, profile: UserProfile }) {
  const [isOpen, setIsOpen] = useState(false);
  const isKid = profile.role === 'kid';

  return (
    <div className="fixed bottom-20 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-[-1]"
            />
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex flex-col gap-3 mb-4 items-end"
            >
              <button onClick={() => { onAction('grocery'); setIsOpen(false); }} className="flex items-center gap-2 bg-white p-3 rounded-full shadow-lg border border-ui font-bold">
                Add Grocery <ShoppingBasket size={20} className="text-amber-500" />
              </button>
              {!isKid && (
                <button onClick={() => { onAction('task'); setIsOpen(false); }} className="flex items-center gap-2 bg-white p-3 rounded-full shadow-lg border border-ui font-bold">
                  New Task <ClipboardCheck size={20} className="text-sky-500" />
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-blue-500 transition-colors"
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <Zap size={32} />
        </motion.div>
      </button>
    </div>
  );
}
