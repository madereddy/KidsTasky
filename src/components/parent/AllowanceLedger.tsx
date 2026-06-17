import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { allowanceClientService } from '../../services/allowances';
import { AllowanceEntry } from '../../types';

interface Props {
  parentId: string;
}

export function AllowanceLedger({ parentId }: Props) {
  const [entries, setEntries] = useState<AllowanceEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    allowanceClientService.getPendingAllowances(parentId)
      .then(e => { setEntries(e || []); setLoaded(true); })
      .catch(() => { setLoaded(true); });
  }, [parentId]);

  const handleMarkPaid = async (id: string) => {
    setPaying(id);
    try {
      await allowanceClientService.markPaid(id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } finally {
      setPaying(null);
    }
  };

  const totalCents = entries.reduce((sum, e) => sum + e.amountCents, 0);

  if (!loaded || entries.length === 0) return null;

  return (
    <div className="bg-white shadow-sm border border-ui-soft p-6 rounded-3xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-black italic tracking-tighter uppercase text-emerald-600 flex items-center gap-2">
          <DollarSign className="w-5 h-5" /> Allowances Owed
        </h3>
        {totalCents > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Total Owed</p>
            <p className="text-xl font-black text-emerald-700">${(totalCents / 100).toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Mobile Card Layout */}
      <div className="sm:hidden space-y-3">
        <AnimatePresence>
          {entries.map(entry => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-4 rounded-2xl border border-ui-soft bg-ui-soft/30 space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-ui-primary">{entry.kidName}</p>
                  <p className="text-sm text-ui-secondary truncate max-w-[200px]">{entry.rewardTitle}</p>
                </div>
                <p className="font-black text-emerald-600 text-lg">${(entry.amountCents / 100).toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-ui-soft/50">
                <p className="text-ui-muted-2 text-xs">
                  Claimed {format(new Date(entry.claimedAt), 'MMM d')}
                </p>
                <button
                  onClick={() => handleMarkPaid(entry.id)}
                  disabled={paying === entry.id}
                  className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-60"
                >
                  <CheckCircle2 size={16} />
                  {paying === entry.id ? 'Marking…' : 'Mark Paid'}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ui-soft">
                <th className="text-left py-2 px-2 text-xs font-bold text-ui-muted uppercase tracking-wider">Kid</th>
                <th className="text-left py-2 px-2 text-xs font-bold text-ui-muted uppercase tracking-wider">Reward</th>
                <th className="text-left py-2 px-2 text-xs font-bold text-ui-muted uppercase tracking-wider">Amount</th>
                <th className="text-left py-2 px-2 text-xs font-bold text-ui-muted uppercase tracking-wider">Claimed</th>
                <th className="py-2 px-2" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {entries.map(entry => (
                  <motion.tr
                    key={entry.id}
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-b border-ui-soft hover:bg-ui-soft"
                  >
                    <td className="py-2 px-2 font-semibold text-ui-secondary">{entry.kidName}</td>
                    <td className="py-2 px-2 text-ui-secondary truncate max-w-[140px]">{entry.rewardTitle}</td>
                    <td className="py-2 px-2 font-bold text-emerald-600">${(entry.amountCents / 100).toFixed(2)}</td>
                    <td className="py-2 px-2 text-ui-muted-2 text-xs">
                      {format(new Date(entry.claimedAt), 'MMM d')}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => handleMarkPaid(entry.id)}
                        disabled={paying === entry.id}
                        className="flex items-center gap-1 px-4 py-2 min-h-[44px] bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-60 ml-auto"
                      >
                        <CheckCircle2 size={16} />
                        {paying === entry.id ? 'Marking…' : 'Mark Paid'}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
    </div>
  );
}
