import { hashText } from '../core/hash';
import { lookOf } from '../core/look';
import { marriageCandidates, RELATIONSHIP_BALANCE } from '../core/relationships';
import {
  canAskOut,
  fillLine,
  firstName,
  openerFor,
  talkBlocker,
  traitKnown,
  traitOf,
  verdictFor,
} from '../core/talk';
import type { WorldState } from '../core/types';
import { LINES, REACTIONS, type ReplyStyle } from '../data/dialogue';
import { money } from './format';
import { Portrait } from './Portrait';
import { ProgressBar } from './ProgressBar';
import { runTimed, useProgress } from './progress';
import { closeTalk, setReaction, type OpenTalk } from './talk';
import { gameStore } from './useGame';

/**
 * A conversation (GDD §11.6): they open, you answer in one of three styles,
 * and how it lands depends on who they are. Their nature stays "???" until a
 * couple of answers have landed well.
 */

const STYLE_LABEL: Record<ReplyStyle, string> = { joke: 'Joke', sincere: 'Sincere', curious: 'Ask' };

export function TalkDialog({ world, open }: { world: WorldState; open: OpenTalk }): React.JSX.Element | null {
  const busy = useProgress() !== null;
  const person = world.people.find((p) => p.id === open.personId);
  if (!person) return null;

  const name = firstName(person);
  const trait = traitOf(person);
  const known = traitKnown(person);
  const blocker = talkBlocker(world, person);
  const opener = openerFor(world, person);
  const canPropose = marriageCandidates(world.people).some((p) => p.id === person.id);
  const affordWedding = world.character.stats.money >= RELATIONSHIP_BALANCE.weddingCost;

  const reply = (style: ReplyStyle): void => {
    const verdict = verdictFor(person, style);
    const pool = REACTIONS[style][verdict];
    const text = fillLine(pool[hashText(`${person.id}:${world.clockDay}:${style}`) % pool.length]!, person, world);
    setReaction(person.id, { text, verdict });
    runTimed(`Talking with ${name}`, 30, { type: 'talk', personId: person.id, style });
  };

  return (
    <section className="panel talk" aria-labelledby="talk-name">
      <header className="talk__head">
        <Portrait look={lookOf(person)} scale={4} className="person__face" />
        <div className="talk__who">
          <h2 className="talk__name" id="talk-name">
            {person.name} <span className="badge">{person.kind === 'dating' ? 'seeing' : person.kind}</span>
          </h2>
          <p className="talk__trait">
            {known ? (
              <>
                <strong>{trait.label}.</strong> {trait.hint}
              </>
            ) : (
              'Personality: ??? - see how your answers land.'
            )}
          </p>
          <div className="stat__track person__track">
            <div className="stat__fill stat__fill--mood" style={{ width: `${Math.round(person.closeness)}%` }} />
          </div>
          <span className="person__closeness">closeness {Math.round(person.closeness)}</span>
        </div>
      </header>

      <ProgressBar />
      {open.reaction && !busy ? (
        <p className={`talk__line talk__line--${open.reaction.verdict}`}>{open.reaction.text}</p>
      ) : blocker === 'Already talked today' ? (
        <p className="talk__line">{fillLine(LINES.talkedToday, person, world)}</p>
      ) : (
        <>
          <p className="talk__line">{fillLine(opener.text, person, world)}</p>
          <div className="talk__replies">
            {opener.replies.map((option) => (
              <button
                key={option.style}
                type="button"
                className="choice"
                disabled={busy || blocker !== null}
                onClick={() => reply(option.style)}
              >
                <span className="talk__style">{STYLE_LABEL[option.style]}</span>
                <span>{fillLine(option.text, person, world)}</span>
              </button>
            ))}
          </div>
          {blocker && <p className="action__why">{blocker}</p>}
        </>
      )}

      <div className="talk__actions">
        {canAskOut(world, person) && (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => runTimed(`Asking ${name} out`, 10, { type: 'askOut', personId: person.id })}
          >
            Ask {name} out
          </button>
        )}
        {canPropose && (
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy || !affordWedding}
            onClick={() => gameStore.dispatch({ type: 'marry', personId: person.id })}
          >
            {affordWedding ? `Propose · ${money(RELATIONSHIP_BALANCE.weddingCost)} wedding` : 'Propose (cannot afford the wedding)'}
          </button>
        )}
        <button type="button" className="btn btn--quiet" disabled={busy} onClick={closeTalk}>
          Leave
        </button>
      </div>
    </section>
  );
}
