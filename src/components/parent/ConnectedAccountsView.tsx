// src/components/parent/ConnectedAccountsView.tsx
import React from 'react';
import { Calendar } from 'lucide-react';

interface Connection {
  id: string;
  provider: string;
}

interface Props {
  connections: Connection[];
  onConnect: (provider: string) => void;
  onDisconnect: (connectionId: string) => void;
}

export function ConnectedAccountsView({ connections, onConnect, onDisconnect }: Props) {
  return (
    <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-emerald-500 overflow-hidden relative">
      <div className="relative z-10">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-500" />
          Sync Connections
        </h3>
        
        <div className="space-y-3">
          {connections.map(conn => (
            <div key={conn.id} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <div>
                <span className="font-bold text-white capitalize">{conn.provider} Calendar Sync Active</span>
              </div>
              <button 
                onClick={() => onDisconnect(conn.id)}
                className="text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded"
              >
                Disconnect
              </button>
            </div>
          ))}

          {connections.length === 0 && (
             <p className="text-slate-500 text-sm italic">No external calendars synced.</p>
          )}

          <div className="pt-4">
            <button 
              onClick={() => onConnect('google')}
              className="btn-immersive-primary !w-auto bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 px-6 py-2 text-[10px] flex items-center gap-2"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-4 h-4" />
              CONNECT GOOGLE CALENDAR
            </button>
          </div>
        </div>
      </div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10" />
    </div>
  );
}
