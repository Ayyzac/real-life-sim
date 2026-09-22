import { meetsRequirements, salaryPerDay } from '../core/careers/job';
import { DAYS_PER_WEEK } from '../core/clock';
import type { Character } from '../core/types';
import { FOCUSES } from '../data/focuses';
import { JOBS, findJob } from '../data/jobs';
import { LOCATIONS } from '../data/locations';
import { money, signed } from './format';
import { gameStore } from './useGame';

/**
 * The place menus, reachable two ways: walk into a building on the map, or
 * click a tab here. Both are doors onto the same `character.location`, which
 * is why the open tab is read from the world state rather than kept in local
 * component state - otherwise the map and the tabs could disagree about where
 * the character is standing.
 */
export function LocationMenu({ character }: { character: Character }): React.JSX.Element {
  const openLocation = character.location;
  const location = LOCATIONS.find((l) => l.id === openLocation) ?? LOCATIONS[0]!;
  const focuses = FOCUSES.filter((focus) => focus.locationId === location.id);

  return (
    <section className="panel places">
      <nav className="tabs" aria-label="Places in town">
        {LOCATIONS.map((place) => (
          <button
            key={place.id}
            type="button"
            className={`tab ${place.id === openLocation ? 'tab--on' : ''}`}
            onClick={() => gameStore.dispatch({ type: 'enterLocation', locationId: place.id })}
            aria-current={place.id === openLocation}
          >
            {place.label}
          </button>
        ))}
      </nav>

      <p className="panel__hint">{location.blurb}</p>

      {location.id === 'work' && <JobSection character={character} />}

      <div className="choices">
        {focuses.map((focus) => {
          const active = character.focusId === focus.id;
          const effects = Object.entries(focus.effects) as [string, number][];

          return (
            <button
              key={focus.id}
              type="button"
              className={`choice ${active ? 'choice--on' : ''}`}
              onClick={() => gameStore.dispatch({ type: 'setFocus', focusId: focus.id })}
              aria-pressed={active}
            >
              <strong className="choice__title">
                {focus.label}
                {active && <span className="badge">current</span>}
              </strong>
              <span className="choice__text">{focus.description}</span>
              <span className="choice__effects">
                {effects.map(([key, value]) => (
                  <span key={key} className={value >= 0 ? 'eff eff--up' : 'eff eff--down'}>
                    {key} {signed(value * DAYS_PER_WEEK)}/wk
                  </span>
                ))}
                {focus.costPerDay !== undefined && (
                  <span className="eff eff--down">
                    {money(focus.costPerDay * DAYS_PER_WEEK)}/wk
                  </span>
                )}
                {focus.worksJob && <span className="eff eff--up">salary</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function JobSection({ character }: { character: Character }): React.JSX.Element {
  if (character.career.type === 'job') {
    const job = findJob(character.career.jobId);
    const { level, tenureDays } = character.career;

    return (
      <div className="job job--current">
        <div>
          <strong>{job.title}</strong>
          {level > 0 && <span className="badge">level {level}</span>}
          <p className="choice__text">
            {money(salaryPerDay(job, level) * DAYS_PER_WEEK)}/week worked &middot;{' '}
            {Math.floor(tenureDays / DAYS_PER_WEEK)} weeks served
          </p>
        </div>
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => gameStore.dispatch({ type: 'quitJob' })}
        >
          Quit
        </button>
      </div>
    );
  }

  return (
    <div className="jobs">
      <h3 className="panel__subtitle">Job board</h3>
      {JOBS.map((job) => {
        const eligible = meetsRequirements(character.attributes, job);
        const bars = Object.entries(job.requirements) as [string, number][];

        return (
          <div key={job.id} className={`job ${eligible ? '' : 'job--locked'}`}>
            <div>
              <strong>{job.title}</strong> <span className="job__pay">{money(job.salaryPerDay * DAYS_PER_WEEK)}/wk</span>
              <p className="choice__text">{job.blurb}</p>
              {bars.length > 0 && (
                <p className="job__req">
                  Needs {bars.map(([attribute, min]) => `${attribute} ${min}`).join(', ')}
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn"
              disabled={!eligible}
              onClick={() => gameStore.dispatch({ type: 'takeJob', jobId: job.id })}
            >
              {eligible ? 'Take it' : 'Locked'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
