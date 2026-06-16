import React from 'react';
import { motion } from 'motion/react';
import { DailyIntelligence, PowerMission, WallMode } from '../../types';
import { IntelligenceHeader } from '../shared/IntelligenceHeader';
import { PowerMissionCard } from './PowerMissionCard';
import { GroceryChips } from './GroceryChips';

interface Props {
  onDismiss: () => void;
  intelligence: DailyIntelligence;
  powerMission: PowerMission | null;
  frequentItems: string[];
  wallMode: WallMode;
  onAddIngredients: () => void;
  onQuickAdd: (text: string) => void;
}

export function WallWakeOverlay({
  onDismiss,
  intelligence,
  powerMission,
  frequentItems,
  wallMode,
  onAddIngredients,
  onQuickAdd,
}: Props) {
  const showPowerMission = wallMode === 'morning' || wallMode === 'afterschool';
  const showGrocery = wallMode !== 'night';

  return (
    <motion.div
      className="absolute inset-x-0 top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-ui-soft p-6 cursor-pointer"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4 }}
      onClick={onDismiss}
    >
      <IntelligenceHeader data={intelligence} onAddIngredients={onAddIngredients} />
      {showPowerMission && (
        <div className="mt-3">
          <PowerMissionCard mission={powerMission} isWallMode />
        </div>
      )}
      {showGrocery && (
        <div className="mt-3">
          <GroceryChips items={frequentItems} onAdd={onQuickAdd} isWallMode />
        </div>
      )}
    </motion.div>
  );
}
