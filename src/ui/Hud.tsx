import { profitPerDay } from '../core/careers/business';
import { ageInYears } from '../core/character';
import { DAYS_PER_WEEK } from '../core/clock';
import { characterLook } from '../core/look';
import { childrenOf, partnerOf } from '../core/relationships';
import type { Character, Person, WorldState } from '../core/types';
import { BALANCE } from '../data/balance';
import { findBusiness } from '../data/businesses';
import { findFocus } from '../data/focuses';
import { findJob } from '../data/jobs';
import { findLifestyle } from '../data/lifestyles';
import { findSport } from '../data/sports';
import { DayBar } from './DayBar';
import { clockTime, dayName, money, weekNumber } from './format';
import { Portrait } from './Portrait';
import { useShownMinute } from './progress';

/**
 * Everything about the character at a glance, always on screen: who, when,
 * money, and the six meters (GDD §11.7).
 */

type Tone = 'health' | 'energy' | 'mood' | 'hunger' | 'thirst' | 'hygiene';

function Meter({ label, value, tone }: { label: string; value: number; tone: Tone }): React.JSX.Element {
  const rounded = Math.round(value);
  const low = rounded < BALANCE.day.lowNeed;
  return (
    <div className={`meter ${low ? 'meter--low' : ''}`}>
      <div className="meter__head">
        <span>{label}</span>
        <span className="meter__value">{rounded}</span>
      </div>
      <div
        className="meter__track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
      >
        <div className={`meter__fill meter__fill--${tone}`} style={{ width: `${rounded}%` }} />
      </div>
    </div>
  );
}

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
    return `${findSport(career.sportId).name} ${career.wins}-${career.losses}`;
  }
  return 'Unemployed';
}

/**
 * What the business will make this week if nothing changes. There is no
 * automatic bankruptcy (user decision, 22 Sep 2026), so this warning is what
 * stops a business draining savings quietly.
 */
function businessWeek(character: Character): { name: string; profit: number } | null {
  const career = character.career;
  if (career.type !== 'business') return null;
  const business = findBusiness(career.businessId);
  const attended = findFocus(character.focusId).runsBusiness === true;
  return { name: business.name, profit: profitPerDay(business, career.level, attended) * DAYS_PER_WEEK };
}

export function Hud({ world }: { world: WorldState }): React.JSX.Element {
  const { character, people } = world;
  const { stats, needs, attributes } = character;
  const shownMinute = useShownMinute(world.minuteOfDay);
  const week = businessWeek(character);
  const losing = week && week.profit < 0 ? week : null;
  const home = household(people);

  return (
    <header className="hud panel">
      <div className="hud__top">
        <div className="hud__who">
          <Portrait look={characterLook(character)} scale={3} className="hud__face" />
          <div>
            <h2 className="hud__name">{character.name}</h2>
            <p className="hud__meta">
              Age {ageInYears(character)} &middot; {careerLine(character)}
            </p>
          </div>
        </div>

        <div className="hud__when" aria-live="off">
          <span className="hud__clock">{clockTime(shownMinute)}</span>
          <span className="hud__date">
            {dayName(world.clockDay, shownMinute)} &middot; Week {weekNumber(world.clockDay)}
          </span>
        </div>

        <div className={`hud__money ${stats.money < 0 ? 'hud__money--debt' : ''}`}>{money(stats.money)}</div>
      </div>

      <DayBar world={world} shownMinute={shownMinute} />

      <div className="hud__meters">
        <Meter label="Health" value={stats.health} tone="health" />
        <Meter label="Energy" value={stats.energy} tone="energy" />
        <Meter label="Mood" value={stats.mood} tone="mood" />
        <Meter label="Hunger" value={needs.hunger} tone="hunger" />
        <Meter label="Thirst" value={needs.thirst} tone="thirst" />
        <Meter label="Hygiene" value={needs.hygiene} tone="hygiene" />
      </div>

      <p className="hud__doing">
        <span>
          Days: <strong>{findFocus(character.focusId).label}</strong>
        </span>
        <span>
          Living <strong>{findLifestyle(character.lifestyleId).label.toLowerCase()}</strong>
        </span>
        {home && <span>{home}</span>}
        <span className="hud__attributes">
          Int {Math.round(attributes.intelligence)} &middot; Phy {Math.round(attributes.physical)} &middot; Cha{' '}
          {Math.round(attributes.charisma)}
        </span>
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
          You are living beyond your means. Debt wears on your mood and your health every day &mdash; cut
          back at Home, or earn more.
        </p>
      )}
      {stats.health < 35 && (
        <p className="warning" role="status">
          Your health is failing. The Hospital repairs it fastest, the Gym more cheaply.
        </p>
      )}
    </header>
  );
}
