import { hasBlock } from '../core/day';
import type { WorldState } from '../core/types';
import { BALANCE } from '../data/balance';
import { findFocus } from '../data/focuses';
import { SKY_BAND } from '../world/sky';
import { clockTime } from './format';

/**
 * The day at a glance (GDD §11.1): waking to 02:00 as a strip of sky, the
 * working day marked on it, and a lamp for "now" that runs along while
 * something takes time.
 */

const D = BALANCE.day;
const SPAN = D.latest - D.wake;
const TICKS = [7, 9, 12, 17, 21, 24, 26].map((hour) => hour * 60);

function at(minute: number): number {
  return ((Math.min(D.latest, Math.max(D.wake, minute)) - D.wake) / SPAN) * 100;
}

const SKY_GRADIENT = `linear-gradient(90deg, ${SKY_BAND.map(([minute, colour]) => `${colour} ${at(minute)}%`).join(', ')})`;

export function DayBar({ world, shownMinute }: { world: WorldState; shownMinute: number }): React.JSX.Element {
  const focus = findFocus(world.character.focusId);
  const block = hasBlock(focus.id);
  const blockDone = world.minuteOfDay >= D.blockEnd;
  const summary = block
    ? `${focus.label} 09:00 to 17:00${blockDone ? ', done' : ''}`
    : 'A free day';

  return (
    <div className="daybar" role="img" aria-label={`Now ${clockTime(shownMinute)}. ${summary}.`}>
      <div className="daybar__sky" style={{ backgroundImage: SKY_GRADIENT }}>
        <div className="daybar__late" style={{ left: `${at(D.midnight)}%` }} />
        {block && (
          <div
            className={`daybar__block ${blockDone ? 'daybar__block--done' : ''}`}
            style={{ left: `${at(D.blockStart)}%`, width: `${at(D.blockEnd) - at(D.blockStart)}%` }}
          >
            {focus.label}
          </div>
        )}
        <div className="daybar__past" style={{ width: `${at(shownMinute)}%` }} />
        <div className="daybar__now" style={{ left: `${at(shownMinute)}%` }} />
      </div>
      <div className="daybar__ticks" aria-hidden="true">
        {TICKS.map((minute) => (
          <span key={minute} style={{ left: `${at(minute)}%` }}>
            {clockTime(minute).slice(0, 2)}
          </span>
        ))}
      </div>
    </div>
  );
}
