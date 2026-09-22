import { ageInYears } from '../core/character';
import type { Character } from '../core/types';
import { findFocus } from '../data/focuses';
import { findJob } from '../data/jobs';
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

function careerLine(character: Character): string {
  if (character.career.type !== 'job') return 'Unemployed';
  const job = findJob(character.career.jobId);
  const level = character.career.level > 0 ? ` (level ${character.career.level})` : '';
  return `${job.title}${level}`;
}

export function Dashboard({
  character,
  clockDay,
}: {
  character: Character;
  clockDay: number;
}): React.JSX.Element {
  const { stats, attributes } = character;

  return (
    <section className="panel dashboard">
      <header className="dashboard__head">
        <div>
          <h2 className="dashboard__name">{character.name}</h2>
          <p className="dashboard__meta">
            Age {ageInYears(character)} &middot; Week {weekNumber(clockDay)} &middot;{' '}
            {careerLine(character)}
          </p>
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
        Doing: <strong>{findFocus(character.focusId).label}</strong>
      </p>

      {stats.energy < BALANCE.lowEnergyThreshold && (
        <p className="warning" role="status">
          Running on empty. While energy stays this low you lose health every day. Rest at Home.
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
