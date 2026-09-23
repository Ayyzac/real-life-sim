import { describe, expect, it } from 'vitest';

import { minutesDue, MS_PER_GAME_MINUTE } from '../../src/ui/clock';

describe('how much game time real time is worth (GDD §12)', () => {
  it('makes one game hour of one real minute at 1x', () => {
    let carry = 0;
    let minutes = 0;
    for (let i = 0; i < 240; i += 1) {
      const due = minutesDue(250, 1, carry);
      carry = due.carryMs;
      minutes += due.minutes;
    }
    expect(minutes).toBe(60);
    expect(MS_PER_GAME_MINUTE * 60).toBe(60_000);
  });

  it('runs faster at higher speeds and carries the remainder', () => {
    expect(minutesDue(250, 4, 0)).toEqual({ minutes: 1, carryMs: 0 });
    expect(minutesDue(250, 2, 0)).toEqual({ minutes: 0, carryMs: 500 });
    expect(minutesDue(250, 2, 500)).toEqual({ minutes: 1, carryMs: 0 });
  });

  it('never dumps a long stall on the player at once', () => {
    expect(minutesDue(3_600_000, 1, 0).minutes).toBe(1);
    expect(minutesDue(-50, 1, 0).minutes).toBe(0);
  });
});
