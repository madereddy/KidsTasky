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
