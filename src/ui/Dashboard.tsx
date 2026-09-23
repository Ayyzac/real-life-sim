import { ageInYears } from '../core/character';
import type { Character, Person } from '../core/types';
import { findFocus } from '../data/focuses';
import { findJob } from '../data/jobs';
import { findBusiness } from '../data/businesses';
import { findSport } from '../data/sports';
import { findLifestyle } from '../data/lifestyles';
import { childrenOf, partnerOf } from '../core/relationships';
import { characterLook } from '../core/look';
import { Portrait } from './Portrait';
import { profitPerDay } from '../core/careers/business';
import { DAYS_PER_WEEK } from '../core/clock';
import { BALANCE } from '../data/balance';
import { money, weekNumber } from './format';

interface StatBarProps {
  label: string;
  value: number;
  tone: 'health' | 'energy' | 'mood';
}

function StatBar({ label, value, tone }: StatBarProps): React.JSX.Element {
  const rounded = Math.round(value);
  return (
    <div className="stat">
      <div className="stat__head">
        <span>{label}</span>
        <span className="stat__value">{rounded}</span>
      </div>
      <div className="stat__track">
        <div
          className={`stat__fill stat__fill--${tone} ${rounded <= 20 ? 'stat__fill--low' : ''}`}
          style={{ width: `${rounded}%` }}
        />
      </div>
    </div>
  );
}

/** Partner and children, if there are any. Empty for someone living alone. */
function household(people: readonly Person[]): string {
  const partner = partnerOf(people);
  const children = childrenOf(people).length;
  const parts: string[] = [];

  if (partner) parts.push(`married to ${partner.name}`);
  if (children > 0) parts.push(`${children} ${children === 1 ? 'child' : 'children'}`);
  return parts.join(', ');
}

function careerLine(character: Character): string {
  const career = character.career;

  if (career.type === 'job') {
    const job = findJob(career.jobId);
    return `${job.title}${career.level > 0 ? ` (level ${career.level})` : ''}`;
  }

  if (career.type === 'business') {
    const business = findBusiness(career.businessId);
    return `${business.name}${career.level > 0 ? ` (level ${career.level})` : ''}`;
  }

  if (career.type === 'sports') {
    const sport = findSport(career.sportId);
    return `${sport.name} ${career.wins}-${career.losses}`;
  }

  return 'Unemployed';
}

/**
 * What the business will make this week if nothing changes.
 *
 * There is no automatic bankruptcy (user decision, 22 Sep 2026), so a business
 * left alone can quietly drain a lifetime of savings. This is the warning that
 * stops "quietly".
 */
function businessWeek(character: Character): { name: string; profit: number } | null {
  const career = character.career;
  if (career.type !== 'business') return null;

  const business = findBusiness(career.businessId);
  const attended = findFocus(character.focusId).runsBusiness === true;
  return {
    name: business.name,
    profit: profitPerDay(business, career.level, attended) * DAYS_PER_WEEK,
  };
}

export function Dashboard({
  character,
  clockDay,
  people,
}: {
  character: Character;
  clockDay: number;
  people: readonly Person[];
}): React.JSX.Element {
  const { stats, attributes } = character;
  const week = businessWeek(character);
  const losing = week && week.profit < 0 ? week : null;

  return (
    <section className="panel dashboard">
      <header className="dashboard__head">
        <div className="dashboard__who">
          <Portrait look={characterLook(character)} scale={2} />
          <div>
          <h2 className="dashboard__name">{character.name}</h2>
          <p className="dashboard__meta">
            Age {ageInYears(character)} &middot; Week {weekNumber(clockDay)} &middot;{' '}
            {careerLine(character)}
          </p>
          </div>
        </div>
        <div className={`dashboard__money ${stats.money < 0 ? 'dashboard__money--debt' : ''}`}>
          {money(stats.money)}
        </div>
      </header>

      <div className="dashboard__stats">
        <StatBar label="Health" value={stats.health} tone="health" />
        <StatBar label="Energy" value={stats.energy} tone="energy" />
        <StatBar label="Mood" value={stats.mood} tone="mood" />
      </div>

      <dl className="attributes">
        <div className="attributes__item">
          <dt>Intelligence</dt>
          <dd>{Math.round(attributes.intelligence)}</dd>
        </div>
        <div className="attributes__item">
          <dt>Physical</dt>
          <dd>{Math.round(attributes.physical)}</dd>
        </div>
        <div className="attributes__item">
          <dt>Charisma</dt>
          <dd>{Math.round(attributes.charisma)}</dd>
        </div>
      </dl>

      <p className="dashboard__focus">
        Doing: <strong>{findFocus(character.focusId).label}</strong> &middot; living{' '}
        <strong>{findLifestyle(character.lifestyleId).label.toLowerCase()}</strong>
        {household(people) && <> &middot; {household(people)}</>}
      </p>

      {stats.energy < BALANCE.lowEnergyThreshold && (
        <p className="warning" role="status">
          Running on empty. While energy stays this low you lose health every day. Rest at Home.
        </p>
      )}

      {losing !== null && (
        <p className="warning" role="status">
          {losing.name} is losing {money(-losing.profit)} a week. Mind the shop, or close it.
        </p>
      )}

      {stats.money < 0 && (
        <p className="warning" role="status">
          You are living beyond your means. Debt wears on your mood and your health every day
          &mdash; cut back at Home, or earn more.
        </p>
      )}

      {stats.health < 35 && (
        <p className="warning" role="status">
          Your health is failing. The Hospital repairs it fastest, the Gym more cheaply.
        </p>
      )}
    </section>
  );
}
