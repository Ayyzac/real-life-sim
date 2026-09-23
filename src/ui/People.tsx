import {
  RELATIONSHIP_BALANCE,
  ageYearsOf,
  dependentChildren,
  marriageCandidates,
} from '../core/relationships';
import { DAYS_PER_WEEK } from '../core/clock';
import { lookOf } from '../core/look';
import type { Memory, Person, WorldState } from '../core/types';
import { OUTINGS, firstName, inviteBlocker, inviteMinutes, traitKnown, traitOf, type Outing } from '../core/talk';
import { money } from './format';
import { runTimed, useProgress } from './progress';
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
  dating: 'seeing',
  partner: 'partner',
  child: 'child',
};

function PersonRow({
  world,
  person,
  canMarry,
  affordable,
}: {
  world: WorldState;
  person: Person;
  canMarry: boolean;
  affordable: boolean;
}): React.JSX.Element {
  const closeness = Math.round(person.closeness);
  const busy = useProgress() !== null;
  const trait = traitOf(person);
  const cooling = person.kind === 'dating' && person.closeness < RELATIONSHIP_BALANCE.breakupBelow + 10;

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
        <span className="person__closeness">
          closeness {closeness} &middot; {traitKnown(person) ? trait.label : 'personality ???'}
        </span>
        {cooling && <p className="job__req">Things are cooling between you. Spend time together, or it will end.</p>}
        <div className="person__actions">
          {(Object.keys(OUTINGS) as Outing[]).map((outing) => {
            const why = inviteBlocker(world, person, outing);
            return (
              <button
                key={outing}
                type="button"
                className="btn btn--small"
                disabled={busy || why !== null}
                title={why ?? `Call ${firstName(person)}: ${OUTINGS[outing].label}, ${money(RELATIONSHIP_BALANCE.invite.cost)} for two`}
                onClick={() =>
                  runTimed(`${OUTINGS[outing].label} with ${firstName(person)}`, inviteMinutes(world, person), {
                    type: 'invite',
                    personId: person.id,
                    outing,
                  })
                }
              >
                {outing === 'dinner' ? 'Invite to dinner' : 'Invite to a film'}
              </button>
            );
          })}
          {canMarry && (
            <button
              type="button"
              className="btn btn--small btn--primary"
              disabled={busy || !affordable}
              onClick={() => gameStore.dispatch({ type: 'marry', personId: person.id })}
            >
              {affordable ? `Propose \u00b7 ${money(RELATIONSHIP_BALANCE.weddingCost)}` : 'Propose (cannot afford)'}
            </button>
          )}
        </div>
      </div>
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
        Closeness fades on its own. Talk to people where you find them, call them to go out, or
        spend your days Socialising to lift everyone at once.
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
              world={world}
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
