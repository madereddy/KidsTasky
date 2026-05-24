import { rewardService } from '../../services/rewards';
import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Reward } from '../../types';

export function RewardManager({ parentId, rewards, onUpdate }: { parentId: string, rewards: Reward[], onUpdate: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [xpCost, setXpCost] = useState(100);
  const [starCost, setStarCost] = useState(0);
  const [allowanceDollars, setAllowanceDollars] = useState(0);

  const addReward = async () => {
    if (!title) return;
    const allowanceCents = allowanceDollars > 0 ? Math.round(allowanceDollars * 100) : 0;
    await rewardService.createReward({ parentId, title, description, xpCost, starCost: starCost || undefined, allowanceCents: allowanceCents || undefined });
    setTitle('');
    setDescription('');
    setXpCost(100);
    setStarCost(0);
    setAllowanceDollars(0);
    onUpdate();
  };

  const deleteReward = async (id: string) => {
    await rewardService.deleteReward(id);
    onUpdate();
  };

  return (
    <div className="bg-white shadow-sm border border-slate-100 p-6 rounded-3xl mb-6 border-l-4 border-l-yellow-500">
      <h3 className="text-xl font-black italic tracking-tighter uppercase mb-6 text-yellow-500">Mission Rewards</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {rewards.map(r => (
            <div key={r.id} className="bg-white shadow-sm p-4 rounded-xl flex justify-between items-center border border-slate-200">
                <div>
                  <p className="font-bold text-slate-200">{r.title}</p>
                  <p className="text-slate-500 text-xs">
                    {r.description} · <span className="text-yellow-500 font-bold">{r.xpCost} XP</span>
                    {r.starCost ? <span className="text-amber-400 font-bold"> · ⭐ {r.starCost}</span> : null}
                    {r.allowanceCents ? <span className="text-emerald-400 font-bold"> · ${(r.allowanceCents / 100).toFixed(2)}</span> : null}
                  </p>
                </div>
                <button onClick={() => deleteReward(r.id)} className="text-red-500 hover:text-red-400 p-2">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <input placeholder="Title" value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} className="input-immersive" />
        <input placeholder="Description" value={description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} className="input-immersive" />
        <input type="number" value={xpCost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setXpCost(parseInt(e.target.value))} placeholder="XP Cost" className="input-immersive" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <input
            type="number"
            min={0}
            value={starCost}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStarCost(Number(e.target.value))}
            placeholder="⭐ Stars to redeem (0 = XP only)"
            className="input-immersive w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-bold">$</span>
          <input
            type="number"
            min={0}
            step={0.25}
            value={allowanceDollars}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllowanceDollars(Number(e.target.value))}
            placeholder="Allowance (0 = none)"
            className="input-immersive flex-1"
          />
        </div>
        <button onClick={addReward} className="btn-immersive-primary bg-yellow-600 hover:bg-yellow-500 text-slate-800 font-bold">Add Reward</button>
      </div>
    </div>
  );
}
