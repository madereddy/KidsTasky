import { CalendarEvent, UserProfile, NextUpEvent } from "../types";

export type TimeFormatPref = "12h" | "24h";
export type TemperatureUnitPref = "celsius" | "fahrenheit";

export function toDisplayTemp(celsius: number, unit: TemperatureUnitPref): number {
  if (unit === "fahrenheit") return (celsius * 9) / 5 + 32;
  return celsius;
}

export function formatTimeWithPrefs(
  value: Date | number,
  timezone: string,
  timeFormat: TimeFormatPref
): string {
  const date = typeof value === "number" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12h"
  }).format(date);
}

export function formatDateTimeWithPrefs(
  value: Date | number,
  timezone: string,
  timeFormat: TimeFormatPref,
  withWeekday = false
): string {
  const date = typeof value === "number" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: withWeekday ? "short" : undefined,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12h"
  }).format(date);
}

export const calculateNextUp = (
  allEvents: CalendarEvent[], 
  familyKids: UserProfile[], 
  parentProfile?: UserProfile
): NextUpEvent | null => {
  const now = Date.now();
  const allFamily = parentProfile ? [parentProfile, ...familyKids] : familyKids;
  
  // Filter for upcoming events (haven't started yet) and not all-day
  const upcoming = allEvents
    .filter(e => e.startTime > now && !e.isAllDay)
    .sort((a, b) => a.startTime - b.startTime);

  if (upcoming.length === 0) return null;

  const event = upcoming[0];
  const member = allFamily.find(m => m.uid === event.assignedToId);

  return {
    title: event.title,
    startTime: event.startTime,
    memberName: member ? member.name : 'Family',
    memberColor: member ? (member.color || '#4F46E5') : (event.color || '#4F46E5')
  };
};
