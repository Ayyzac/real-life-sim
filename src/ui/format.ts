/** Shared display helpers. Presentation only - no game rules live here. */

export function money(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = Math.abs(rounded).toLocaleString('en-US');
  return rounded < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function signed(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

/** Money with an explicit sign, for figures that can go either way. */
export function signedMoney(amount: number): string {
  return amount > 0 ? `+${money(amount)}` : money(amount);
}

export function weekNumber(clockDay: number): number {
  return Math.floor(clockDay / 7) + 1;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "18:30". Past midnight the clock keeps counting, so wrap it for display. */
export function clockTime(minuteOfDay: number): string {
  const minute = Math.floor(minuteOfDay) % (24 * 60);
  const hours = Math.floor(minute / 60);
  return `${String(hours).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

/** Day 0 of every life is a Monday. After midnight it is already tomorrow. */
export function dayName(clockDay: number, minuteOfDay = 0): string {
  const day = clockDay + (minuteOfDay >= 24 * 60 ? 1 : 0);
  return DAY_NAMES[day % 7]!;
}

/** "45 min", "1 h", "1 h 30" - how long something takes. */
export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

