import {
  MAX_BUSINESS_LEVEL,
  meetsRequirements as meetsBusinessRequirements,
  profitPerDay,
  revenuePerDay,
  upgradeCost,
} from '../core/careers/business';
import { meetsRequirements, salaryPerDay } from '../core/careers/job';
import {
  ageFactor,
  matchStrength,
  meetsRequirements as meetsSportRequirements,
  winChance,
} from '../core/careers/sports';
import { ageInYears } from '../core/character';
import { DAYS_PER_WEEK } from '../core/clock';
import type { Character, WorldState } from '../core/types';
import { FOCUSES } from '../data/focuses';
import { ownedPossessions, replacedBy } from '../core/belongings';
import { BUSINESSES, findBusiness } from '../data/businesses';
import { LIFESTYLES, findLifestyle } from '../data/lifestyles';
import { POSSESSIONS } from '../data/possessions';
import { JOBS, findJob } from '../data/jobs';
import { SPORTS, findSport } from '../data/sports';
import { LOCATIONS } from '../data/locations';
import { actionBlocker, closedReason } from '../core/day';
import { findAction } from '../data/actions';
import { TOP_COLOURS } from '../data/looks';
import { runTimed, useProgress } from './progress';
import { characterLook, decodeLook, lookOf } from '../core/look';
import { whoIsHere } from '../core/schedule';
import { Portrait } from './Portrait';
import { openTalk } from './talk';
import { ActionList } from './ActionList';
import { duration, money, signed, signedMoney } from './format';
import { gameStore } from './useGame';
import { isGymMember } from '../core/gym';
import { Shop } from './Bag';
import { CasinoSection } from './Casino';
import { BALANCE } from '../data/balance';

/**
 * The place menus, reachable two ways: walk into a building on the map, or
 * click a tab here. Both are doors onto the same `character.location`, which
 * is why the open tab is read from the world state rather than kept in local
 * component state - otherwise the map and the tabs could disagree about where
 * the character is standing.
 */
export function LocationMenu({ world }: { world: WorldState }): React.JSX.Element {
  const character = world.character;
  const openLocation = character.location;
  const location = LOCATIONS.find((l) => l.id === openLocation) ?? LOCATIONS[0]!;
  // Working a job you do not have, or minding a shop you do not own, is not
  // an option, so it is not offered.
  const focuses = FOCUSES.filter(
    (focus) =>
      focus.locationId === location.id &&
      (!focus.worksJob || character.career.type === 'job') &&
      (!focus.runsBusiness || character.career.type === 'business') &&
      (!focus.trainsSport || character.career.type === 'sports'),
  );

  return (
    <section className="places">
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
      {closedReason(location.id, world.minuteOfDay) && (
        <p className="closed" role="status">
          {closedReason(location.id, world.minuteOfDay)}
        </p>
      )}

      <HereNow world={world} />
      <ActionList world={world} />

      {location.id === 'home' && <HomeSection character={character} />}
      {location.id === 'mall' && <MallSection world={world} />}
      {location.id === 'gym' && <GymSection world={world} />}
      {location.id === 'supermarket' && <Shop world={world} />}
      {location.id === 'casino' && <CasinoSection world={world} />}
      {location.id === 'work' && <JobSection character={character} />}
      {location.id === 'business' && <BusinessSection character={character} />}
      {location.id === 'stadium' && <SportsSection character={character} />}

      {focuses.length > 0 && (
        <>
          <h3 className="panel__subtitle">How you spend your days</h3>
          <p className="panel__hint">
            Your days, 09:00&ndash;17:00, until you change it. Skipped days are lived this way too.
          </p>
        </>
      )}
      <div className="choices">
        {focuses.map((focus) => {
          const active = character.focusId === focus.id;
          const effects = Object.entries(focus.effects) as [string, number][];
          const locked = focus.membersOnly === true && !isGymMember(character);

          return (
            <button
              key={focus.id}
              type="button"
              className={`choice ${active ? 'choice--on' : ''}`}
              onClick={() => gameStore.dispatch({ type: 'setFocus', focusId: focus.id })}
              aria-pressed={active}
              disabled={locked}
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
                    {money(-focus.costPerDay * DAYS_PER_WEEK)}/wk
                  </span>
                )}
                {focus.worksJob && <span className="eff eff--up">salary</span>}
                {focus.socialises && <span className="eff eff--up">closeness with everyone</span>}
                {locked && <span className="eff eff--down">members only</span>}
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
          onClick={() => {
            if (confirm(`Quit your job as ${job.title}?`)) gameStore.dispatch({ type: 'quitJob' });
          }}
        >
          Quit
        </button>
      </div>
    );
  }

  if (character.career.type !== 'none') {
    // The store refuses this anyway; saying so beats a button that silently
    // does nothing.
    const where = character.career.type === 'business' ? 'Business' : 'Stadium';
    return (
      <p className="panel__hint">
        You already have a career. End it at {where} before taking a job &mdash; you cannot do
        both at once.
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

  if (career.type === 'job' || career.type === 'sports') {
    const where = career.type === 'job' ? 'Work' : 'Stadium';
    return (
      <p className="panel__hint">
        You already have a career. End it at {where} before opening a business &mdash; you cannot
        do both at once.
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

/**
 * The stadium menu (GDD 4.3).
 *
 * Shows the two numbers that actually decide an athlete's life: their current
 * form, and how far off the next fixture is. Age quietly eats the first one,
 * which is the whole reason a sporting career has a window.
 */
function SportsSection({ character }: { character: Character }): React.JSX.Element {
  const career = character.career;

  if (career.type === 'job' || career.type === 'business') {
    const where = career.type === 'job' ? 'Work' : 'Business';
    return (
      <p className="panel__hint">
        You already have a career. End it at {where} before taking up a sport &mdash; you cannot do
        both at once.
      </p>
    );
  }

  if (career.type === 'sports') {
    const sport = findSport(career.sportId);
    const age = ageInYears(character);
    const strength = matchStrength(sport, career.skill, character.attributes, age);
    const form = Math.round(winChance(strength, sport.opponentSkill) * 100);
    const dueIn = Math.max(0, sport.matchIntervalDays - career.daysSinceMatch);
    const past = ageFactor(age) < 1;

    return (
      <div className="job job--current">
        <div>
          <strong>{sport.name}</strong>
          <span className="badge">
            {career.wins}-{career.losses}
          </span>
          <p className="choice__text">
            Skill {Math.round(career.skill)} &middot; reputation {Math.round(career.reputation)}{' '}
            &middot; next fixture in {dueIn} training {dueIn === 1 ? 'day' : 'days'}
          </p>
          <p className="choice__effects">
            <span className={form >= 50 ? 'eff eff--up' : 'eff eff--down'}>form {form}%</span>
            <span className="eff eff--up">win {money(sport.winPrize)}</span>
            <span className="eff eff--down">lose {money(sport.losePrize)}</span>
          </p>
          {past && (
            <p className="job__req">
              You are past your peak. Your form falls a little every year from here.
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => {
            if (confirm(`Retire from ${sport.name}?`)) {
              gameStore.dispatch({ type: 'leaveSport' });
            }
          }}
        >
          Retire
        </button>
      </div>
    );
  }

  return (
    <div className="jobs">
      <h3 className="panel__subtitle">Take up a sport</h3>
      <p className="panel__hint">
        Prize money only &mdash; nothing comes in between fixtures, and nothing at all while you
        are not training.
      </p>
      {SPORTS.map((sport) => {
        const qualified = meetsSportRequirements(character.attributes, sport);
        const bars = Object.entries(sport.requirements) as [string, number][];

        return (
          <div key={sport.id} className={`job ${qualified ? '' : 'job--locked'}`}>
            <div>
              <strong>{sport.name}</strong>{' '}
              <span className="job__pay">{money(sport.winPrize)} a win</span>
              <p className="choice__text">{sport.blurb}</p>
              <p className="choice__effects">
                <span className="eff eff--up">win {money(sport.winPrize)}</span>
                <span className="eff eff--down">lose {money(sport.losePrize)}</span>
                <span className="eff eff--down">
                  a fixture every {sport.matchIntervalDays} training days
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
              disabled={!qualified}
              onClick={() => gameStore.dispatch({ type: 'joinSport', sportId: sport.id })}
            >
              {qualified ? 'Take it up' : 'Locked'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Home: how you live, and what you own (GDD 9).
 *
 * This is where the money finally goes. Until Phase 5 a careful player died
 * rich and with nothing to show for it.
 */
function HomeSection({ character }: { character: Character }): React.JSX.Element {
  const current = findLifestyle(character.lifestyleId);
  const belongings = ownedPossessions(character);
  // Only what the things themselves cost to run. The lifestyle is billed
  // separately, and mixing them made a bicycle look like it cost $210 a week
  // to keep.
  const upkeepPerDay = belongings.reduce((total, p) => total + (p.upkeepPerDay ?? 0), 0);

  return (
    <>
      <h3 className="panel__subtitle">How you live</h3>
      <div className="choices">
        {LIFESTYLES.map((lifestyle) => {
          const active = lifestyle.id === current.id;
          const effects = Object.entries(lifestyle.perDay) as [string, number][];

          return (
            <button
              key={lifestyle.id}
              type="button"
              className={`choice ${active ? 'choice--on' : ''}`}
              onClick={() => gameStore.dispatch({ type: 'setLifestyle', lifestyleId: lifestyle.id })}
              aria-pressed={active}
            >
              <strong className="choice__title">
                {lifestyle.label}
                {active && <span className="badge">current</span>}
              </strong>
              <span className="choice__text">{lifestyle.description}</span>
              <span className="choice__effects">
                <span
                  className={lifestyle.extraCostPerDay > 0 ? 'eff eff--down' : 'eff eff--up'}
                >
                  {lifestyle.extraCostPerDay === 0
                    ? 'no extra cost'
                    : `${signedMoney(-lifestyle.extraCostPerDay * DAYS_PER_WEEK)}/wk`}
                </span>
                {effects.map(([key, value]) => (
                  <span key={key} className={value >= 0 ? 'eff eff--up' : 'eff eff--down'}>
                    {key} {signed(value * DAYS_PER_WEEK)}/wk
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <h3 className="panel__subtitle">What you own</h3>
      {character.owned.length === 0 ? (
        <p className="panel__hint">Nothing yet. The Mall sells homes, vehicles and the rest, paid for outright.</p>
      ) : (
        <p className="panel__hint">
          {belongings.map((p) => p.name).join(' \u00b7 ')}
          {upkeepPerDay > 0 && <> &mdash; upkeep {money(upkeepPerDay * DAYS_PER_WEEK)}/wk</>}
        </p>
      )}

    </>
  );
}

/** The people the player knows who are here right now (GDD §11.4). */
function HereNow({ world }: { world: WorldState }): React.JSX.Element | null {
  const here = whoIsHere(world, world.character.location);
  if (here.length === 0) return null;

  return (
    <div className="here-now">
      <h3 className="panel__subtitle">Here now</h3>
      <ul className="survivors">
        {here.map((person) => (
          <li key={person.id} className="survivors__item">
            <Portrait look={lookOf(person)} scale={2} />
            <span>
              {person.name} <span className="here-now__kind">{person.kind === 'dating' ? 'seeing' : person.kind}</span>
            </span>
            <button type="button" className="btn btn--small" onClick={() => openTalk(person.id)}>
              Talk
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The Mall's shops (GDD §11.5): clothes that change how you look, and the
 * big things money buys - which used to be sold from the Home tab.
 */
function GymSection({ world }: { world: WorldState }): React.JSX.Element {
  const character = world.character;
  const member = isGymMember(character);
  const { fee, days } = BALANCE.gym;

  return (
    <>
      <h3 className="panel__subtitle">Membership</h3>
      <div className="job">
        <div>
          <strong>{member ? 'Member' : 'Not a member'}</strong>{' '}
          <span className="job__pay">{money(fee)} every {days} days</span>
          <p className="choice__text">
            {member
              ? `Renews by itself in ${Math.max(0, (character.gymPaidUntil ?? 0) - world.clockDay)} days. Cancel any time; nothing back for the rest of the month.`
              : 'Members only past the front desk: the machines, the showers and the water.'}
          </p>
        </div>
        <button
          type="button"
          className="btn"
          disabled={!member && character.stats.money < fee}
          onClick={() => gameStore.dispatch({ type: member ? 'leaveGym' : 'joinGym' })}
        >
          {member ? 'Cancel' : character.stats.money < fee ? 'Too dear' : 'Join'}
        </button>
      </div>
    </>
  );
}

function MallSection({ world }: { world: WorldState }): React.JSX.Element {
  const character = world.character;
  const busy = useProgress() !== null;
  const clothes = findAction('buy_clothes');
  const blocker = actionBlocker(world, clothes);
  const current = decodeLook(characterLook(character));

  return (
    <>
      <h3 className="panel__subtitle">Clothes shop</h3>
      <div className="clothes">
        <Portrait look={characterLook(character)} scale={3} className="person__face" />
        <div>
          <p className="panel__hint">
            A new top, {money(clothes.cost ?? 0)} and {duration(clothes.minutes)}.
            {blocker ? ` ${blocker}.` : ''}
          </p>
          <div className="look__row" role="group" aria-label="Tops">
            {TOP_COLOURS.map((ramp, top) =>
              ramp === null ? null : (
                <button
                  type="button"
                  key={top}
                  className={`swatch ${current.top === top ? 'swatch--on' : ''}`}
                  style={{ background: ramp[ramp.length - 2] }}
                  disabled={busy || blocker !== null || current.top === top}
                  onClick={() => runTimed(clothes.label, clothes.minutes, { type: 'buyClothes', top })}
                  aria-label={`Buy a top in colour ${top}`}
                  aria-pressed={current.top === top}
                />
              ),
            )}
          </div>
        </div>
      </div>

      <h3 className="panel__subtitle">Shops</h3>
      <div className="jobs">
        {POSSESSIONS.map((possession) => {
          const owned = character.owned.includes(possession.id);
          const affordable = character.stats.money >= possession.price;
          const replaces = replacedBy(character.owned, possession.id);
          const effects = Object.entries(possession.perDay) as [string, number][];

          return (
            <div key={possession.id} className={`job ${owned || affordable ? '' : 'job--locked'}`}>
              <div>
                <strong>{possession.name}</strong>{' '}
                <span className="job__pay">{money(possession.price)}</span>
                <p className="choice__text">{possession.blurb}</p>
                <p className="choice__effects">
                  {effects.map(([key, value]) => (
                    <span key={key} className={value >= 0 ? 'eff eff--up' : 'eff eff--down'}>
                      {key} {signed(value * DAYS_PER_WEEK)}/wk
                    </span>
                  ))}
                  {possession.restBonusPerDay !== undefined && (
                    <span className="eff eff--up">
                      rest +{possession.restBonusPerDay * DAYS_PER_WEEK} energy/wk
                    </span>
                  )}
                  {possession.upkeepPerDay !== undefined && (
                    <span className="eff eff--down">
                      upkeep {money(possession.upkeepPerDay * DAYS_PER_WEEK)}/wk
                    </span>
                  )}
                </p>
                {replaces && !owned && (
                  <p className="job__req">Replaces your {replaces.name}. Nothing back for it.</p>
                )}
              </div>
              <button
                type="button"
                className="btn"
                disabled={owned || !affordable}
                onClick={() =>
                  gameStore.dispatch({ type: 'buyPossession', possessionId: possession.id })
                }
              >
                {owned ? 'Owned' : affordable ? 'Buy' : 'Too dear'}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
