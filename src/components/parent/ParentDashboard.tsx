import { userService } from '../../services/users';
import React, { useState } from 'react';
import { Bell, Plus } from 'lucide-react';
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
import { fetchAPI } from '../../services/http';
import { ParentDashboardSkeleton } from '../shared/Skeleton';

export function ParentDashboard({
  profile,
  onOpenSettings: _onOpenSettings,
}: {
  profile: UserProfile,
  onOpenSettings?: () => void,
}) {
  const isDarkMode = !!profile.themeId && profile.themeId !== 'light_blue' && profile.themeId !== 'light_green' && profile.themeId !== 'light_rose';
  const toneSecondary = isDarkMode ? 'text-ui-muted-2' : 'text-ui-muted';
  const [showNotifications, setShowNotifications] = useState(false);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [editingAvatarFor, setEditingAvatarFor] = useState<UserProfile | null>(null);
  const familyId = profile.parentId || profile.uid;
  const {
    kids,
    setKids,
    notifications,
    loading,
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

  if (loading) return <ParentDashboardSkeleton />;

  const summaryCards = [
    { label: 'Pending approvals', value: todaySummary.pendingApprovals, tone: 'text-amber-600' },
    { label: 'Homework due', value: todaySummary.homeworkDue, tone: 'text-rose-600' },
    { label: 'Events today', value: todaySummary.eventsToday, tone: 'text-sky-600' },
    { label: 'Active chores', value: todaySummary.activeChores, tone: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-8">
      <RewardManager parentId={familyId} rewards={rewards} onUpdate={refreshRewards} />

      {/* Summary cards — mobile */}
      <section className="grid grid-cols-2 gap-3 sm:hidden">
        {summaryCards.map((item) => (
          <div key={item.label} className="rounded-2xl border border-ui bg-white p-3">
            <p className="text-xs font-bold uppercase text-ui-muted">{item.label}</p>
            <p className={cn("mt-2 text-2xl font-black", item.tone)}>{item.value}</p>
          </div>
        ))}
      </section>

      {/* Summary cards — desktop */}
      <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => (
          <div key={item.label} className="rounded-2xl border border-ui bg-white p-3">
            <p className="text-xs uppercase text-ui-muted font-bold">{item.label}</p>
            <p className={cn("text-2xl font-black", item.tone)}>{item.value}</p>
          </div>
        ))}
      </div>

      <AllowanceLedger parentId={familyId} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Command panel — simplified */}
        <div className="relative overflow-hidden rounded-3xl border border-ui-soft bg-white p-5 shadow-sm md:col-span-2 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="font-bold text-ui-primary text-xl">{profile.name}</p>
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label={showNotifications ? 'Hide notifications' : 'Show notifications'}
                aria-expanded={showNotifications}
                className="relative p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-ui bg-ui-soft transition-colors hover:border-amber-400"
              >
                <Bell className={cn('w-5 h-5', notifications.length > 0 ? 'text-amber-500 animate-pulse' : 'text-ui-muted')} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white" />
                )}
              </button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 max-h-[300px] overflow-y-auto rounded-2xl border border-ui bg-white shadow-2xl z-[100] w-64"
                  >
                    <div className="p-3 border-b border-ui flex justify-between items-center bg-white/90 backdrop-blur-md sticky top-0 z-10">
                      <span className="text-xs font-black uppercase tracking-widest text-ui-muted">Notifications</span>
                      {notifications.length > 0 && (
                        <span className="text-xs font-bold text-amber-500">{notifications.length} new</span>
                      )}
                    </div>
                    <div className="p-1 space-y-1">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center">
                          <p className="text-xs text-ui-muted">Nothing new</p>
                        </div>
                      ) : (
                        notifications.map((n: AppNotification) => (
                          <div key={n.id} className="p-3 bg-white hover:bg-ui-soft rounded-xl border border-ui-soft flex flex-col gap-2">
                            <div>
                              <p className="text-ui-primary font-bold text-xs leading-tight truncate">{n.taskTitle}</p>
                              <p className="text-ui-muted text-xs">{n.kidName}</p>
                            </div>
                            <button
                              onClick={() => markRead(n.id)}
                              className="text-xs font-bold text-sky-500 hover:text-sky-600 text-left"
                            >
                              Mark handled
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10" />
        </div>

        {/* Kids panel */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col justify-center relative overflow-hidden">
          <p className={cn('text-xs uppercase tracking-widest font-black mb-3', toneSecondary)}>Kids</p>
          <div className="flex -space-x-2 mb-4 flex-wrap">
            {kids.length > 0 ? kids.map((k: UserProfile) => (
              <div key={k.uid} className="relative group/kid mb-2">
                <button onClick={() => setEditingAvatarFor(k)} title={`${k.name} — Level ${levelForXp(k.xp ?? 0)}`}>
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
