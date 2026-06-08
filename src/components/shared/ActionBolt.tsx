// src/components/shared/ActionBolt.tsx
import React, { useEffect, useId, useState } from 'react';
import { Zap, ShoppingBasket, ClipboardCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../../types';

export function ActionBolt({ onAction, profile }: { onAction: (type: string) => void, profile: UserProfile }) {
  const [isOpen, setIsOpen] = useState(false);
  const isKid = profile.role === 'kid';
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-[48]"
          />
        )}
      </AnimatePresence>
      <div className="fixed bottom-24 right-4 z-[49] sm:right-6">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              id={menuId}
              role="menu"
              aria-label="Quick actions"
              className="mb-4 flex flex-col items-end gap-3"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => { onAction('grocery'); setIsOpen(false); }}
                className="flex min-h-11 items-center gap-2 rounded-full border border-ui bg-ui-soft px-4 py-3 font-bold text-ui-primary shadow-lg"
              >
                Add Grocery <ShoppingBasket size={20} className="text-amber-500" />
              </button>
              {!isKid && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { onAction('task'); setIsOpen(false); }}
                  className="flex min-h-11 items-center gap-2 rounded-full border border-ui bg-ui-soft px-4 py-3 font-bold text-ui-primary shadow-lg"
                >
                  New Task <ClipboardCheck size={20} className="text-sky-500" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
          aria-expanded={isOpen}
          aria-controls={menuId}
          aria-haspopup="menu"
          className="flex h-16 w-16 items-center justify-center rounded-full border border-ui bg-ui-primary text-white shadow-xl transition-colors hover:bg-ui-primary/90"
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
          >
            <Zap size={32} />
          </motion.div>
        </button>
      </div>
    </>
  );
}
