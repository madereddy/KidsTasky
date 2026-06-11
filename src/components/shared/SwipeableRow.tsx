// src/components/shared/SwipeableRow.tsx
import React from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SwipeableRowProps {
  children: React.ReactNode;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onClick?: () => void;
  rightLabel?: string;
  leftLabel?: string;
  className?: string;
}

export function SwipeableRow({ children, onSwipeRight, onSwipeLeft, onClick, rightLabel = "Done", leftLabel = "Dismiss", className }: SwipeableRowProps) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, 0, 100], [0.5, 1, 0.5]);
  const background = useTransform(x, [-100, 0, 100], ['#f59e0b', 'transparent', '#10b981']);
  const doneOpacity = useTransform(x, [0, 40], [0, 1]);
  const dismissOpacity = useTransform(x, [-40, 0], [1, 0]);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) onSwipeRight();
    else if (info.offset.x < -100) onSwipeLeft();
  };

  return (
    <div className={cn("relative rounded-xl", className)}>
      <motion.div style={{ background }} className="absolute inset-0 flex items-center justify-between px-6 rounded-xl">
        <motion.div style={{ opacity: doneOpacity }} className="flex items-center gap-2 text-white font-bold">
          <Check size={20} /> {rightLabel}
        </motion.div>
        <motion.div style={{ opacity: dismissOpacity }} className="flex items-center gap-2 text-white font-bold">
          {leftLabel} <X size={20} />
        </motion.div>
      </motion.div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        style={{ x, opacity }}
        onDragEnd={handleDragEnd}
        onTap={() => onClick?.()}
        className="relative bg-white border border-ui p-4 rounded-xl cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}
