import { fetchAPI } from '../../services/http';
import { userService } from '../../services/users';
import React, { useState } from 'react';
import { ShieldCheck, Bell, Send, CheckCircle2, Copy, Plus, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { UserProfile, Notification as AppNotification } from '../../types';
import { MEMBER_COLORS } from '../../constants';
import { levelForXp } from '../../lib/xp';
import { AddKidForm } from './AddKidForm';
import { RewardManager } from './RewardManager';
import { AllowanceLedger } from './AllowanceLedger';
import { ConnectedAccountsView } from './ConnectedAccountsView';
import { StaleDataEvent, useSocketStaleData } from '../../hooks/useSocket';
import { FamilyNote } from '../shared/FamilyNote';
import { AvatarDisplay, AvatarPicker } from '../shared/AvatarPicker';
import { useParentDashboardController } from '../../hooks/useParentDashboardController';
import { clientLogger } from '../../services/clientLogger';

export function ParentDashboard({
  profile,
  onOpenSettings,
}: {
  profile: UserProfile,
  onOpenSettings?: () => void,
}) {
  const isDarkMode = !!profile.themeId && profile.themeId !== 'light_blue' && profile.themeId !== 'light_green' && profile.themeId !== 'light_rose';
  const toneSecondary = isDarkMode ? 'text-ui-muted-2' : 'text-ui-muted';
  const [showNotifications, setShowNotifications] = useState(false);
  const [copied, setCopied] = useState(false);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [editingAvatarFor, setEditingAvatarFor] = useState<UserProfile | null>(null);
  const familyId = profile.parentId || profile.uid;
  const {
    kids,
    setKids,
    invite,
    notifications,
    loading,
    generatingInvite,
    connections,
    syncCalendars,
    rewards,
    todaySummary,
    fetchData,
    refreshNotifications,
    refreshKids,
    refreshConnectionsAndCalendars,
    refreshTodaySummary,
    markRead,
    generateInvite,
    refreshRewards,
    handleDisconnect,
    handleToggleCalendar,
  } = useParentDashboardController({ familyId });

  useSocketStaleData(['all'], (data: StaleDataEvent) => {
    const signal = data.type || data.entity;
    if (signal === 'notifications') {
      refreshNotifications().catch((e) => clientLogger.errorWithException('parent_dashboard_refresh_notifications_failed', e, { familyId }));
      return;
    }
    if (signal === 'users' || signal === 'kids') {
      refreshKids().catch((e) => clientLogger.errorWithException('parent_dashboard_refresh_kids_failed', e, { familyId }));
      return;
    }
    if (signal === 'sync' || signal === 'calendars' || signal === 'connections') {
      refreshConnectionsAndCalendars().catch((e) => clientLogger.errorWithException('parent_dashboard_refresh_sync_failed', e, { familyId }));
      return;
    }
    if (signal === 'rewards') {
      refreshRewards().catch((e) => clientLogger.errorWithException('parent_dashboard_refresh_rewards_failed', e, { familyId }));
      return;
    }
    if (signal === 'tasks' || signal === 'completions' || signal === 'events' || signal === 'homework') {
      refreshTodaySummary().catch((e) => clientLogger.errorWithException('parent_dashboard_refresh_today_summary_failed', e, { familyId, signal }));
      return;
    }
    fetchData().catch((e) => clientLogger.errorWithException('parent_dashboard_full_refresh_failed', e, { familyId, signal }));
  });

  const handleCopy = () => {
    if (invite) {
      navigator.clipboard.writeText(invite.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return null;

  const summaryCards = [
    { label: 'Pending approvals', value: todaySummary.pendingApprovals, tone: 'text-amber-600' },
    { label: 'Homework due', value: todaySummary.homeworkDue, tone: 'text-rose-600' },
    { label: 'Events today', value: todaySummary.eventsToday, tone: 'text-sky-600' },
    { label: 'Active chores', value: todaySummary.activeChores, tone: 'text-emerald-600' },
  ];

  const focusItem = summaryCards.reduce((current, item) => (item.value > current.value ? item : current), summaryCards[0]);

  return (
    <div className="space-y-8">
      <RewardManager parentId={familyId} rewards={rewards} onUpdate={refreshRewards} />
      <section className="space-y-3 sm:hidden">
        <div className="rounded-3xl border border-ui bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-ui-muted">Needs Attention Now</p>
              <h3 className="mt-2 text-xl font-black text-ui-primary">{focusItem.value} {focusItem.label.toLowerCase()}</h3>
              <p className="mt-1 text-sm text-ui-muted">Keep the family day moving with the highest-pressure items first.</p>
            </div>
            <span className={cn("rounded-full bg-ui-soft px-3 py-1 text-xs font-black uppercase tracking-wide", focusItem.tone)}>
              Focus
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {summaryCards.map((item) => (
            <div key={item.label} className="rounded-2xl border border-ui bg-white p-3">
              <p className="text-[11px] font-bold uppercase text-ui-muted">{item.label}</p>
              <p className={cn("mt-2 text-2xl font-black", item.tone)}>{item.value}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-ui bg-white p-3"><p className="text-[11px] uppercase text-ui-muted font-bold">Events Today</p><p className="text-2xl font-black text-ui-primary">{todaySummary.eventsToday}</p></div>
        <div className="rounded-2xl border border-ui bg-white p-3"><p className="text-[11px] uppercase text-ui-muted font-bold">Homework Due</p><p className="text-2xl font-black text-ui-primary">{todaySummary.homeworkDue}</p></div>
        <div className="rounded-2xl border border-ui bg-white p-3"><p className="text-[11px] uppercase text-ui-muted font-bold">Pending Approvals</p><p className="text-2xl font-black text-ui-primary">{todaySummary.pendingApprovals}</p></div>
        <div className="rounded-2xl border border-ui bg-white p-3"><p className="text-[11px] uppercase text-ui-muted font-bold">Active Chores</p><p className="text-2xl font-black text-ui-primary">{todaySummary.activeChores}</p></div>
      </div>
      <AllowanceLedger parentId={familyId} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="relative overflow-hidden rounded-3xl border border-ui-soft bg-white p-5 shadow-sm md:col-span-2 sm:p-6">
          <div className="relative z-10 flex flex-col gap-5 sm:gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
            <h3 className="text-lg font-bold mb-2">Ground Control Command</h3>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="relative rounded-2xl border border-ui bg-white p-3 shadow-sm">
                <ShieldCheck className="w-6 h-6 text-ui-primary" />
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label={showNotifications ? 'Hide notifications' : 'Show notifications'}
                  aria-expanded={showNotifications}
                  className="absolute -right-2 -top-2 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-ui bg-ui-soft-2 transition-colors hover:border-amber-500"
                >
                  <Bell className={cn('w-3 h-3', notifications.length > 0 ? 'text-amber-500 animate-pulse' : 'text-ui-muted')} />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white" />
                  )}
                </button>
              </div>
              <div>
                <p className="text-xs text-ui-muted font-black uppercase tracking-widest leading-none mb-1">Sector Commander</p>
                <p className="font-bold text-ui-primary leading-none">{profile.name}</p>
              </div>
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="group inline-flex min-h-11 items-center gap-2 rounded-xl border border-ui bg-ui-soft px-3 py-2.5 text-ui-muted transition-all hover:border-sky-300 hover:text-sky-500 sm:ml-2"
                  title="App & Display Settings"
                >
                  <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">System Settings</span>
                </button>
              )}
            </div>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="mt-4 max-h-[300px] overflow-y-auto rounded-2xl border border-ui bg-white shadow-2xl sm:absolute sm:left-0 sm:right-auto sm:top-full sm:z-[100] sm:mt-4 sm:w-64"
                >
                  <div className="p-3 border-b border-ui flex justify-between items-center bg-white/90 backdrop-blur-md sticky top-0 z-10">
                    <span className="text-xs font-black uppercase tracking-widest text-ui-muted">Tactical Alerts</span>
                    <span className="text-xs font-bold text-amber-500">{notifications.length} NEW</span>
                  </div>
                  <div className="p-1 space-y-1">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center">
                        <p className="text-xs text-ui-muted uppercase font-bold">No breaches detected</p>
                      </div>
                    ) : (
                      notifications.map((n: AppNotification) => (
                        <div key={n.id} className="p-3 bg-white hover:bg-ui-soft rounded-xl border border-ui-soft flex flex-col gap-2 group">
                          <div>
                            <p className="text-[7px] font-black text-amber-600 uppercase mb-0.5">Overdue Objective</p>
                            <p className="text-ui-primary font-bold text-xs leading-tight truncate">{n.taskTitle}</p>
                            <p className="text-ui-muted text-xs uppercase font-bold tracking-tight">Cadet: {n.kidName}</p>
                          </div>
                          <button
                            onClick={() => markRead(n.id)}
                            className="text-xs font-bold text-sky-500 hover:text-sky-600 uppercase tracking-widest text-left"
                          >
                            Mark Handled
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

            <div className="relative z-10 flex w-full flex-col items-stretch gap-3 lg:max-w-sm lg:items-end">
            {!invite ? (
              <button
                onClick={() => generateInvite(profile.name)}
                disabled={generatingInvite}
                className="min-h-11 rounded-2xl border border-ui-primary bg-ui-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all hover:bg-ui-primary/90"
              >
                {generatingInvite ? 'GENERATING...' : 'GENERATE MISSION CODE'}
              </button>
            ) : (
              <div className="text-left lg:text-right">
                <p className="mb-2 flex items-center gap-1 text-xs font-black uppercase tracking-widest text-ui-muted lg:justify-end">
                  <Send className="w-3 h-3" /> Mission Access Code
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
                  <div className="rounded-2xl border border-ui bg-ui-soft px-4 py-2 font-mono text-2xl font-black tracking-[0.22em] text-ui-primary shadow-inner">
                    {invite.id}
                  </div>
                  <button
                    onClick={handleCopy}
                    className={cn(
                      'flex min-h-11 items-center justify-center rounded-2xl border p-3 transition-all sm:self-auto',
                      copied ? 'border border-emerald-200 bg-emerald-50 text-emerald-600' : 'border border-ui bg-white text-ui-secondary hover:bg-ui-soft'
                    )}
                    title="Copy Code"
                  >
                    {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-2 inline-block rounded-lg bg-ui-soft px-2 py-1 text-xs font-bold uppercase tracking-wide text-ui-primary"
                >
                  {copied ? 'COORDINATES COPIED!' : 'SHARE CODE WITH SPACE CADET'}
                </motion.p>
              </div>
            )}
          </div>
          </div>

          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10" />
        </div>

        <div className="glass-panel p-6 rounded-3xl flex flex-col justify-center relative overflow-hidden">
          <p className={cn('text-xs uppercase tracking-widest font-black mb-3', toneSecondary)}>Linked Cadets</p>
          <div className="flex -space-x-2 mb-4 flex-wrap">
            {kids.length > 0 ? kids.map((k: UserProfile) => (
              <div key={k.uid} className="relative group/kid mb-2">
                <button onClick={() => setEditingAvatarFor(k)} title={`${k.name} - LVL ${levelForXp(k.xp ?? 0)}`}>
                  <AvatarDisplay
                    avatarPreset={k.avatarPreset}
                    avatarUrl={k.avatarUrl}
                    name={k.name}
                    size={40}
                  />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setColorPickerFor(colorPickerFor === k.uid ? null : k.uid); }}
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: k.color ?? MEMBER_COLORS[0] }}
                  title="Set color"
                />
                {colorPickerFor === k.uid && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-ui rounded-xl p-2 shadow-xl grid grid-cols-4 gap-1" onClick={e => e.stopPropagation()}>
                    {MEMBER_COLORS.map(c => (
                      <button key={c} onClick={async () => { await userService.setMemberColor(k.uid, c); setColorPickerFor(null); fetchData(); }}
                        className="w-6 h-6 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                )}
              </div>
            )) : (
              <div className="w-10 h-10 rounded-full bg-ui-dark border-2 border-dashed border-ui-dark-2 flex items-center justify-center text-ui-secondary mb-2">
                <Plus className="w-4 h-4" />
              </div>
            )}
          </div>

          <AddKidForm parentId={familyId} onAdded={fetchData} />
          <div className="mt-4">
            <FamilyNote parentId={familyId} readOnly={false} />
          </div>

          <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-purple-500/5 blur-xl rounded-full" />
        </div>
      </div>
      {editingAvatarFor && (
        <div className="fixed inset-0 bg-ui-deep-80 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80">
            <h3 className="font-semibold mb-3">{editingAvatarFor.name}'s Avatar</h3>
            <AvatarPicker
              uid={editingAvatarFor.uid}
              current={{ ...editingAvatarFor, name: editingAvatarFor.name }}
              onUpdated={(preset, url) => {
                setKids((prev) => prev.map((kid) => (
                  kid.uid === editingAvatarFor.uid
                    ? { ...kid, avatarPreset: preset ?? undefined, avatarUrl: url ?? undefined }
                    : kid
                )));
                setEditingAvatarFor(null);
              }}
            />
            <button onClick={() => setEditingAvatarFor(null)} className="mt-3 text-sm text-ui-muted">Cancel</button>
          </div>
        </div>
      )}

      <ConnectedAccountsView
        connections={connections}
        calendars={syncCalendars}
        onToggleCalendar={handleToggleCalendar}
        onConnect={async (provider, data) => {
          const tk = localStorage.getItem('kidtasker_token');
          if (provider === 'google') {
            window.location.href = `/api/sync/connect/google?token=${tk}`;
          } else if (provider === 'manual') {
            try {
              await fetchAPI('/sync/connect/manual', {
                method: 'POST',
                body: JSON.stringify(data)
              });
              alert('Manual sync connection established!');
              fetchData();
            } catch {
              alert('Failed to connect');
            }
          }
        }}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
}
