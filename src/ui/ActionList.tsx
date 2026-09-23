import { actionBlocker, actionsHere } from '../core/day';
import type { WorldState } from '../core/types';
import { duration, money, signed } from './format';
import { runTimed, useProgress } from './progress';

/**
 * What can be done here, now (GDD §11). Each says how long it takes, what it
 * costs, and what it does - and when it cannot be done, why not.
 */
export function ActionList({ world }: { world: WorldState }): React.JSX.Element | null {
  const busy = useProgress() !== null;
  const actions = actionsHere(world);
  if (actions.length === 0) return null;

  return (
    <div className="actions">
      <h3 className="panel__subtitle">Things to do here</h3>
      <div className="actions__list">
        {actions.map((action) => {
          const blocker = actionBlocker(world, action);
          const treatUsed = world.doneToday.includes(action.id);
          const needs = Object.entries(action.needs ?? {}) as [string, number][];
          const treat = Object.entries(action.effects ?? {}) as [string, number][];

          return (
            <button
              key={action.id}
              type="button"
              className="action"
              disabled={busy || blocker !== null}
              onClick={() => runTimed(action.label, action.minutes, { type: 'doAction', actionId: action.id })}
              title={action.description}
            >
              <span className="action__head">
                <strong>{action.label}</strong>
                <span className="action__time">{duration(action.minutes)}</span>
              </span>
              <span className="choice__effects">
                {action.cost !== undefined && <span className="eff eff--down">{money(-action.cost)}</span>}
                {needs.map(([key, value]) => (
                  <span key={key} className={value >= 0 ? 'eff eff--up' : 'eff eff--down'}>
                    {key} {signed(value)}
                  </span>
                ))}
                {treat.map(([key, value]) => (
                  <span
                    key={key}
                    className={`eff ${value >= 0 ? 'eff--up' : 'eff--down'} ${treatUsed ? 'eff--spent' : ''}`}
                  >
                    {key} {signed(value)}
                  </span>
                ))}
              </span>
              {blocker && <span className="action__why">{blocker}</span>}
              {!blocker && treatUsed && treat.length > 0 && (
                <span className="action__why action__why--soft">Already had the treat today</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
