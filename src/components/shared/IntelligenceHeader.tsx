import React from 'react';
import { Clock, Utensils, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DailyIntelligence } from '../../types';
import { cn } from '../../lib/utils';

export function IntelligenceHeader({ data, onAddIngredients }: { data: DailyIntelligence, onAddIngredients: () => void }) {
  const { nextUp, meal } = data;
  const isEvening = new Date().getHours() >= 15;

  if (!nextUp && !meal) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {/* Next Up Ticker */}
      {nextUp ? (
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-gray-800 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
            <Clock size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Next Up</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                {formatDistanceToNow(new Date(nextUp.startTime), { addSuffix: true })}
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate leading-tight">
              {nextUp.title}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: nextUp.memberColor }} />
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{nextUp.memberName}</span>
            </div>
          </div>
        </div>
      ) : <div className="hidden md:block" />}

      {/* Daily Meal Card */}
      {meal && (
        <div className={cn(
          "flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-white/5 border shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 delay-100 transition-all",
          isEvening 
            ? "border-orange-200 dark:border-orange-900/50 shadow-orange-100 dark:shadow-orange-900/20 ring-4 ring-orange-50 dark:ring-orange-900/10" 
            : "border-gray-100 dark:border-gray-800"
        )}>
          <div className={cn(
            "p-3 rounded-xl transition-colors",
            isEvening ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300" : "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
          )}>
            <Utensils size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">Today's Meal</span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate leading-tight">
              {meal.title}
            </h3>
            <button
              onClick={onAddIngredients}
              className="mt-1 flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              <Plus size={14} />
              Add ingredients to list
            </button>
          </div>
          {meal.imageUrl && (
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-gray-100 dark:border-gray-800">
              <img src={meal.imageUrl} alt={meal.title} className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
