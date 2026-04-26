import { rewardService } from '../../services/rewards';
import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Reward } from '../../types';

export function RewardManager({ parentId, rewards, onUpdate }: { parentId: string, rewards: Reward[], onUpdate: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [xpCost, setXpCost] = useState(100);

  const addReward = async () => {
    if (!title) return;
    await rewardService.createReward({ parentId, title, description, xpCost });
    setTitle('');
    setDescription('');
    setXpCost(100);
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
                  <p className="text-slate-500 text-xs">{r.description} - <span className="text-yellow-500 font-bold">{r.xpCost} XP</span></p>
                </div>
                <button onClick={() => deleteReward(r.id)} className="text-red-500 hover:text-red-400 p-2">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input placeholder="Title" value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} className="input-immersive" />
        <input placeholder="Description" value={description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} className="input-immersive" />
        <input type="number" value={xpCost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setXpCost(parseInt(e.target.value))} className="input-immersive" />
        <button onClick={addReward} className="btn-immersive-primary bg-yellow-600 hover:bg-yellow-500 text-white font-bold">Add Reward</button>
      </div>
    </div>
  );
}
