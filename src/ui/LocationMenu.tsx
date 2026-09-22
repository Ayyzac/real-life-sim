import {
  MAX_BUSINESS_LEVEL,
  meetsRequirements as meetsBusinessRequirements,
  profitPerDay,
  revenuePerDay,
  upgradeCost,
} from '../core/careers/business';
import { meetsRequirements, salaryPerDay } from '../core/careers/job';
import { DAYS_PER_WEEK } from '../core/clock';
import type { Character } from '../core/types';
import { FOCUSES } from '../data/focuses';
import { BUSINESSES, findBusiness } from '../data/businesses';
import { JOBS, findJob } from '../data/jobs';
import { LOCATIONS } from '../data/locations';
import { money, signed, signedMoney } from './format';
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
  // Minding a shop you do not own is not an option, so it is not offered.
  const focuses = FOCUSES.filter(
    (focus) =>
      focus.locationId === location.id &&
      (!focus.runsBusiness || character.career.type === 'business'),
  );

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
      {location.id === 'business' && <BusinessSection character={character} />}

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

  if (character.career.type === 'business') {
    // The store refuses this anyway; saying so beats a button that silently
    // does nothing.
    return (
      <p className="panel__hint">
        You are running your own business. Close it at Business before taking a job &mdash; you
        cannot do both at once.
      </p>
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

/**
 * The business menu (GDD §4.2).
 *
 * Only one career at a time, so this deliberately refuses to do anything while
 * the character holds a job: giving one up has to be its own decision, not a
 * side effect of clicking something else.
 */
function BusinessSection({ character }: { character: Character }): React.JSX.Element {
  const career = character.career;

  if (career.type === 'job') {
    return (
      <p className="panel__hint">
        You already have a job. Quit it at Work before opening a business &mdash; you cannot do
        both at once.
      </p>
    );
  }

  if (career.type === 'business') {
    const business = findBusiness(career.businessId);
    const attended = profitPerDay(business, career.level, true) * DAYS_PER_WEEK;
    const ignored = profitPerDay(business, career.level, false) * DAYS_PER_WEEK;
    const nextCost = upgradeCost(career.level);
    const affordable = nextCost !== null && character.stats.money >= nextCost;

    return (
      <div className="job job--current">
        <div>
          <strong>{business.name}</strong>
          {career.level > 0 && <span className="badge">level {career.level}</span>}
          <p className="choice__text">
            {Math.floor(career.daysOpen / DAYS_PER_WEEK)} weeks open &middot; takings{' '}
            {money(revenuePerDay(business, career.level) * DAYS_PER_WEEK)}/wk &middot; costs{' '}
            {money(business.costPerDay * DAYS_PER_WEEK)}/wk
          </p>
          <p className="choice__effects">
            <span className={attended >= 0 ? 'eff eff--up' : 'eff eff--down'}>
              minding it {signedMoney(attended)}/wk
            </span>
            <span className={ignored >= 0 ? 'eff eff--up' : 'eff eff--down'}>
              left alone {signedMoney(ignored)}/wk
            </span>
          </p>
        </div>
        <div className="business__actions">
          <button
            type="button"
            className="btn"
            disabled={!affordable}
            onClick={() => gameStore.dispatch({ type: 'upgradeBusiness' })}
          >
            {nextCost === null
              ? `Level ${MAX_BUSINESS_LEVEL} - fully grown`
              : `Invest ${money(nextCost)}`}
          </button>
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => {
              if (confirm(`Close ${business.name}? You get nothing back.`)) {
                gameStore.dispatch({ type: 'closeBusiness' });
              }
            }}
          >
            Close it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="jobs">
      <h3 className="panel__subtitle">Open a business</h3>
      {BUSINESSES.map((business) => {
        const qualified = meetsBusinessRequirements(character.attributes, business);
        const affordable = character.stats.money >= business.startupCost;
        const bars = Object.entries(business.requirements) as [string, number][];

        return (
          <div key={business.id} className={`job ${qualified && affordable ? '' : 'job--locked'}`}>
            <div>
              <strong>{business.name}</strong>{' '}
              <span className="job__pay">{money(business.startupCost)} to open</span>
              <p className="choice__text">{business.blurb}</p>
              <p className="choice__effects">
                <span className="eff eff--up">
                  takings {money(business.revenuePerDay * DAYS_PER_WEEK)}/wk
                </span>
                <span className="eff eff--down">
                  costs {money(business.costPerDay * DAYS_PER_WEEK)}/wk
                </span>
                <span className={profitPerDay(business, 0, false) >= 0 ? 'eff eff--up' : 'eff eff--down'}>
                  left alone {signedMoney(profitPerDay(business, 0, false) * DAYS_PER_WEEK)}/wk
                </span>
              </p>
              {bars.length > 0 && (
                <p className="job__req">
                  Needs {bars.map(([attribute, min]) => `${attribute} ${min}`).join(', ')}
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn"
              disabled={!qualified || !affordable}
              onClick={() => gameStore.dispatch({ type: 'openBusiness', businessId: business.id })}
            >
              {!qualified ? 'Locked' : affordable ? 'Open it' : 'Cannot afford'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
