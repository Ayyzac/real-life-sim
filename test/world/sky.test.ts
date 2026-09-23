import { describe, expect, it } from 'vitest';

import { SKY, skyAt } from '../../src/world/sky';

describe('the sky over the day (GDD §11.1)', () => {
  it('leaves the middle of the day in plain daylight', () => {
    expect(skyAt(12 * 60).alpha).toBe(0);
  });

  it('darkens steadily through the evening into night', () => {
    const dusk = skyAt(18 * 60).alpha;
    const evening = skyAt(20 * 60).alpha;
    const night = skyAt(23 * 60).alpha;
    expect(dusk).toBeLessThan(evening);
    expect(evening).toBeLessThan(night);
  });

  it('holds its first and last colours outside the stops', () => {
    expect(skyAt(0).alpha).toBe(SKY[0]!.alpha);
    expect(skyAt(99 * 60).alpha).toBe(SKY[SKY.length - 1]!.alpha);
  });
});
