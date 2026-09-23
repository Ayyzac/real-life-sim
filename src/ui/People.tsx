import {
  RELATIONSHIP_BALANCE,
  ageYearsOf,
  dependentChildren,
  marriageCandidates,
} from '../core/relationships';
import { DAYS_PER_WEEK } from '../core/clock';
import { lookOf } from '../core/look';
import type { Memory, Person, WorldState } from '../core/types';
import { money } from './format';
import { Portrait } from './Portrait';
import { gameStore } from './useGame';

/**
 * Everyone the player knows (GDD 10).
 *
 * Lives at the Cafe because that is where Socialising happens, and Socialising
 * is the only thing that keeps closeness up. The dead and departed are shown
 * underneath as single lines - that is all the save keeps of them, on purpose.
 */

const KIND_LABEL: Record<Person['kind'], string> = {
  family: 'family',
  friend: 'friend',
  colleague: 'colleague',
  partner: 'partner',
  child: 'child',
};

function PersonRow({
  person,
  canMarry,
  affordable,
}: {
  person: Person;
  canMarry: boolean;
  affordable: boolean;
}): React.JSX.Element {
  const closeness = Math.round(person.closeness);

  return (
    <div className="person">
      <Portrait look={lookOf(person)} scale={3} className="person__face" />
      <div className="person__main">
        <strong>{person.name}</strong> <span className="badge">{KIND_LABEL[person.kind]}</span>
        <p className="choice__text">
          {ageYearsOf(person)} years old
          {person.job ? ` \u00b7 ${person.job}` : ''}
        </p>
        <div className="stat__track person__track">
          <div
            className={`stat__fill stat__fill--mood ${closeness <= 20 ? 'stat__fill--low' : ''}`}
            style={{ width: `${closeness}%` }}
          />
        </div>
        <span className="person__closeness">closeness {closeness}</span>
      </div>
      {canMarry && (
        <button
          type="button"
          className="btn"
          disabled={!affordable}
          onClick={() => gameStore.dispatch({ type: 'marry', personId: person.id })}
        >
          {affordable ? `Marry \u00b7 ${money(RELATIONSHIP_BALANCE.weddingCost)}` : 'Cannot afford'}
        </button>
      )}
    </div>
  );
}

function MemoryRow({ memory }: { memory: Memory }): React.JSX.Element {
  return (
    <li className="log__item">
      <span className="log__week">wk {Math.floor(memory.day / DAYS_PER_WEEK) + 1}</span>
      <span>{memory.text}</span>
    </li>
  );
}

export function People({ world }: { world: WorldState }): React.JSX.Element {
  const { people, memories, character } = world;
  const candidates = marriageCandidates(people);
  const affordable = character.stats.money >= RELATIONSHIP_BALANCE.weddingCost;
  const dependents = dependentChildren(people);

  return (
    <>
      <h3 className="panel__subtitle">People</h3>
      <p className="panel__hint">
        Closeness fades on its own. Socialising is what keeps it up &mdash; and it lifts everyone
        you know at once.
        {dependents.length > 0 && (
          <>
            {' '}
            Your {dependents.length === 1 ? 'child costs' : 'children cost'}{' '}
            {money(dependents.length * RELATIONSHIP_BALANCE.childCostPerDay * DAYS_PER_WEEK)}/wk.
          </>
        )}
      </p>

      {people.length === 0 ? (
        <p className="panel__hint">Nobody left. That happens, if you let it.</p>
      ) : (
        <div className="people">
          {people.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              canMarry={candidates.some((c) => c.id === person.id)}
              affordable={affordable}
            />
          ))}
        </div>
      )}

      {memories.length > 0 && (
        <>
          <h3 className="panel__subtitle">Gone</h3>
          <ul className="log__list">
            {memories.map((memory, index) => (
              <MemoryRow key={`${memory.name}-${memory.day}-${index}`} memory={memory} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
