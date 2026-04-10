/**
 * Date utility for appointments/teleconsultations.
 *
 * The DB stores timestamps WITHOUT timezone (timestamp without time zone).
 * Prisma serializes them with a "Z" suffix, making browsers interpret them
 * as UTC and apply local timezone offset (+1h in West Africa).
 *
 * All display functions force timeZone:'UTC' so the stored time is shown as-is.
 */

/** Format a scheduled date for display (e.g. "lundi 14 avril 2026") */
export function formatScheduledDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Format a scheduled time for display (e.g. "14:00") */
export function formatScheduledTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

/** Format date + time together (e.g. "14/04/2026 14:00") */
export function formatScheduledDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

/** Format short date + time (e.g. "14 avr. 2026, 14:00") */
export function formatScheduledDateTimeLong(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}
