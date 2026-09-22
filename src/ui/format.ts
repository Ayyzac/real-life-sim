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

export function weekNumber(clockDay: number): number {
  return Math.floor(clockDay / 7) + 1;
}
