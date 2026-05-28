import React, { useState } from 'react';
import { Calendar, KeyRound, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SyncCalendar } from '../../types';

interface Connection {
  id: string;
  provider: string;
}

interface Props {
  connections: Connection[];
  calendars?: SyncCalendar[];
  onConnect: (provider: string, data?: any) => void;
  onDisconnect: (connectionId: string) => void;
  onToggleCalendar?: (calendarId: string, enabled: boolean) => void;
}

export function ConnectedAccountsView({ connections, calendars = [], onConnect, onDisconnect, onToggleCalendar }: Props) {
  const [showManual, setShowManual] = useState(false);
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');

  const isGoogleConnected = connections.some(c => c.provider === 'google' || c.provider === 'google_manual');

  return (
    <div className="bg-white shadow-sm border border-ui-soft p-6 rounded-3xl overflow-hidden relative">
      <div className="relative z-10">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-500" />
          Mission Uplinks
        </h3>
        
        <div className="space-y-3">
          {connections.map(conn => (
            <div key={conn.id} className="space-y-3 p-3 bg-white shadow-sm border border-ui rounded-xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-ui-primary capitalize">{conn.provider.replace('_', ' ')} Link Active</span>
                </div>
                <button
                  onClick={() => onDisconnect(conn.id)}
                  className="text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded"
                >
                  Disconnect
                </button>
              </div>

              {conn.provider === 'google' && (
                <div className="border-t border-ui-soft pt-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-ui-muted uppercase tracking-widest font-black">
                      Synced calendars
                    </p>
                    {calendars.filter(calendar => calendar.connectionId === conn.id).length > 0 && (
                      <p className="text-xs text-ui-muted-2 font-bold">
                        {calendars.filter(calendar => calendar.connectionId === conn.id && Boolean(calendar.enabled)).length}/{calendars.filter(calendar => calendar.connectionId === conn.id).length} on
                      </p>
                    )}
                  </div>

                  {calendars.filter(calendar => calendar.connectionId === conn.id).length === 0 ? (
                    <p className="text-xs text-ui-muted bg-ui-soft rounded-xl px-3 py-2">
                      Calendars will appear after the next Google sync discovers them.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {calendars
                        .filter(calendar => calendar.connectionId === conn.id)
                        .map(calendar => {
                          const enabled = Boolean(calendar.enabled);
                          return (
                            <label
                              key={calendar.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-ui-soft bg-ui-soft px-3 py-2"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-ui-secondary">{calendar.name}</span>
                                <span className="block truncate text-xs text-ui-muted">{calendar.calendarId}</span>
                              </span>
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(event) => onToggleCalendar?.(calendar.id, event.target.checked)}
                                className="h-5 w-5 accent-emerald-500"
                                aria-label={`${enabled ? 'Disable' : 'Enable'} ${calendar.name}`}
                              />
                            </label>
                          );
                        })}
                    </div>
                  )}
                  <p className="text-xs text-ui-muted-2">
                    Turning a calendar off stops future imports and removes events imported from that calendar.
                  </p>
                </div>
              )}
            </div>
          ))}

          {!isGoogleConnected && (
            <div className="space-y-4 pt-2">
              <button 
                onClick={() => onConnect('google')}
                className="w-full bg-ui-soft-2 border border-ui text-ui-primary hover:bg-ui-dark-2 hover:text-white p-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-4 h-4" />
                Connect via Google OAuth
              </button>

              <div className="text-center">
                <button 
                  onClick={() => setShowManual(!showManual)}
                  className="text-xs text-ui-muted hover:text-emerald-400 uppercase tracking-widest font-black transition-colors"
                >
                  {showManual ? 'Hide Manual Options' : 'Other Options (App Password)'}
                </button>
              </div>

              <AnimatePresence>
                {showManual && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div className="bg-white/90 border border-ui-dark rounded-2xl p-4 space-y-3">
                      <div>
                        <label className="text-xs text-ui-muted uppercase font-black tracking-widest mb-1 block">Gmail Email</label>
                        <input 
                          type="email" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="pilot@gmail.com"
                          className="w-full bg-ui-soft border border-ui-dark rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 transition-colors"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs text-ui-muted uppercase font-black tracking-widest block">App Password Key</label>
                          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                            Guides <ExternalLink className="w-2 h-2" />
                          </a>
                        </div>
                        <input 
                          type="password" 
                          value={appPassword}
                          onChange={(e) => setAppPassword(e.target.value)}
                          placeholder="abcd efgh ijkl mnop"
                          className="w-full bg-ui-deep border border-ui-dark rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 transition-colors tracking-widest font-mono"
                        />
                      </div>
                      <button 
                        disabled={!email || !appPassword}
                        onClick={() => onConnect('manual', { email, appPassword })}
                        className="w-full bg-emerald-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <KeyRound className="w-4 h-4" /> Link Command
                      </button>
                      <p className="text-xs text-ui-muted italic text-center">
                        This enables AI task extraction from your emails without OAuth.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {connections.length === 0 && !showManual && (
             <p className="text-ui-muted text-xs uppercase tracking-widest font-black text-center pt-2">No active mission uplinks</p>
          )}
        </div>
      </div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10" />
    </div>
  );
}


